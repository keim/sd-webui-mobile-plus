"""Workbench actions backend for the Mobile+ extension.

Implements the illu SD Workbench action contract (the same 22
client-facing actions the Muse Space "illu-sd-wakusupesu-v2"
exposed) directly inside Forge's FastAPI app:

  POST /mobileplus/actions        {"action": <name>, "args": {...}}
  GET  /mobileplus/files/<key>    stored image files (jobs/uploads/saved)

State lives in the extension's own workbench-data/ directory: a
SQLite database (jobs, upload library, saved images, editor source,
workspace state, word dictionary, text snippets, save counter,
generation stats) plus image files under workbench-data/files/.
Generation runs against Forge's own SD API on loopback
(127.0.0.1:7860) from a worker thread per job — payload composition
and guardrails port composePayload (Space actions.ts) and
sd_job_priv.py: per-model parameter table, standard positive base
from the two weights, editable negative verbatim (legacy fallback:
standard negative + extra), minor-tag fail-closed check, forced
"adult" insertion, forced "loli, child" negative insertion for
every model, checkpoint allowlist, restore-afterwards forced on.

Loaded by scripts/mobile-plus.py via importlib; registering must
never break WebUI startup, so the caller wraps it in try/except.
"""

import base64
import hashlib
import io
import json
import os
import re
import sqlite3
import threading
import time
import urllib.request
from datetime import datetime, timezone

SDAPI_BASE = "http://127.0.0.1:7860"
FILES_PREFIX = "/mobileplus/files/"
SAVE_COUNTER_INITIAL = 12713
MAX_IMAGE_BYTES = 25 * 1024 * 1024
JOB_TIMEOUT_SECONDS = 300

STANDARD_NEGATIVE = (
    "(heavy makeup, muscle, worst quality, low quality, lowres: 1.5), "
    "huge breasts, body hair, ugly, bad anatomy, bad hands, futanari, "
    "missing fingers, extra digit, long neck, long body, missing arms, "
    "missing legs, extra arms, extra legs, painting, sketch, "
    "illustration, flat color, monochrome, greyscale, watermark, "
    "text, loli, child"
)

MODEL_TABLE = {
    "wai": {
        "checkpoint": "waiNSFWIllustrious_v140",
        "cfg": 5.5, "steps": 20, "sampler": "DPM++ 2M", "scheduler": "Karras",
    },
    "pornmaster": {
        "checkpoint": "pornmasterPro_realismILV4",
        "cfg": 5.5, "steps": 20, "sampler": "DPM++ 2M", "scheduler": "Karras",
    },
    "zimage": {
        "checkpoint": "z-image-turbo-quant-bundle",
        "cfg": 1, "steps": 10, "sampler": "Euler", "scheduler": "Beta",
    },
}

MINOR_TAGS = ["loli", "child", "shota", "minor", "underage"]
NEGATIVE_GUARD_TAGS = ["loli", "child"]
CHECKPOINT_ALLOWLIST = {
    "waiNSFWIllustrious_v140",
    "pornmasterPro_realismILV4",
    "z-image-turbo-quant-bundle",
}
GUARD_MAX_DIM = 2048
GUARD_MAX_PIXELS = 4194304

PNG_SIG = b"\x89PNG\r\n\x1a\n"
JPEG_SIG = b"\xff\xd8\xff"

_STATE = {"root": None, "data_dir": None, "db_path": None}
_DB_LOCK = threading.RLock()
_THREADS = {}
_THREADS_LOCK = threading.Lock()


def _now_iso():
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


def _db():
    conn = sqlite3.connect(_STATE["db_path"], timeout=30)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db():
    os.makedirs(os.path.join(_STATE["data_dir"], "files"), exist_ok=True)
    os.makedirs(os.path.join(_STATE["data_dir"], "masks"), exist_ok=True)
    conn = _db()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS jobs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              kind TEXT NOT NULL DEFAULT 'generate',
              job_key TEXT,
              status TEXT NOT NULL DEFAULT 'running',
              phase TEXT,
              phase_updated_at TEXT,
              model TEXT, prompt TEXT, extra_negative TEXT,
              negative_prompt TEXT,
              width INTEGER, height INTEGER,
              seed_mode TEXT, seed_input INTEGER,
              steps INTEGER, cfg REAL, sampler TEXT, scheduler TEXT,
              base_enabled INTEGER,
              photorealistic_weight REAL, comiclo_weight REAL,
              mode TEXT, denoising_strength REAL,
              result_seed INTEGER,
              image_key TEXT, display_key TEXT, host_path TEXT,
              used_params TEXT, lora_hashes TEXT,
              error TEXT,
              stats_recorded INTEGER NOT NULL DEFAULT 0,
              generating_since REAL,
              created_at TEXT NOT NULL, updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS upload_images (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              file_name TEXT, stored_name TEXT NOT NULL,
              mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL,
              host_path TEXT NOT NULL, image_key TEXT NOT NULL,
              display_key TEXT,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS saved_images (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              counter INTEGER NOT NULL, seed INTEGER NOT NULL,
              source_job_id INTEGER, source_kind TEXT,
              source_upload_id INTEGER,
              file_ext TEXT NOT NULL DEFAULT 'png',
              image_key TEXT NOT NULL, display_key TEXT,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS editor_source (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              kind TEXT NOT NULL, job_id INTEGER, upload_id INTEGER
            );
            CREATE TABLE IF NOT EXISTS workspace_state (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              settings TEXT NOT NULL DEFAULT '',
              prompt TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS word_dictionary (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              data TEXT NOT NULL DEFAULT '{}'
            );
            CREATE TABLE IF NOT EXISTS text_snippets (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              data TEXT NOT NULL DEFAULT '[]'
            );
            CREATE TABLE IF NOT EXISTS save_counter (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              value INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS generation_stats (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              job_id INTEGER, model TEXT,
              width INTEGER, height INTEGER, steps INTEGER,
              duration_ms INTEGER, created_at TEXT NOT NULL
            );
            """
        )
        conn.commit()
    finally:
        conn.close()


def _file_path(key):
    base = os.path.realpath(os.path.join(_STATE["data_dir"], "files"))
    path = os.path.realpath(os.path.join(base, key))
    if path != base and not path.startswith(base + os.sep):
        return None
    return path


def _file_url(key):
    return (FILES_PREFIX + key) if key else None


def _write_file(key, data):
    path = _file_path(key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return path


def _read_file(key):
    path = _file_path(key)
    if not path or not os.path.isfile(path):
        return None
    with open(path, "rb") as f:
        return f.read()


def _delete_file(key):
    if not key:
        return
    path = _file_path(key)
    if path and os.path.isfile(path):
        try:
            os.remove(path)
        except OSError:
            pass


def _make_display_jpeg(image_bytes):
    """Display JPEG (max 1280px, quality 82) from PNG/JPEG bytes."""
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes))
        img = img.convert("RGB")
        img.thumbnail((1280, 1280))
        out = io.BytesIO()
        img.save(out, "JPEG", quality=82)
        return out.getvalue()
    except Exception:  # noqa: BLE001 - display copy is best-effort
        return None


def _has_tag(text, tag):
    return (
        re.search(r"(?<![a-z])" + re.escape(tag) + r"(?![a-z])",
                  text, re.IGNORECASE)
        is not None
    )


def _fmt_weight(x):
    return "%g" % float(x)


# --- Payload composition + guardrails (ports of composePayload and
# --- sd_job_priv.py's validate_and_guard) ---------------------------

class GuardError(Exception):
    def __init__(self, stage, message):
        super().__init__(message)
        self.stage = stage
        self.message = message


def _compose_payload(job):
    key = job["model"] if job["model"] in MODEL_TABLE else "wai"
    m = MODEL_TABLE[key]
    content = (job["prompt"] or "").strip()
    prompt = content
    pw = job["photorealistic_weight"]
    cw = job["comiclo_weight"]
    pw = 1 if pw is None else pw
    cw = 0.7 if cw is None else cw
    base_parts = []
    if pw != 0:
        base_parts.append(f"(photorealistic: {_fmt_weight(pw)})")
    if cw != 0:
        base_parts.append(f"<lora:comiclo-xl-pony:{_fmt_weight(cw)}>")
    if base_parts:
        joined = ", ".join(base_parts)
        prompt = f"{joined}, {content}" if content else joined
    if key == "zimage":
        negative = ""
    elif job["negative_prompt"] is not None:
        negative = job["negative_prompt"]
    else:
        extra = (job["extra_negative"] or "").strip()
        negative = f"{STANDARD_NEGATIVE}, {extra}" if extra else STANDARD_NEGATIVE
    return {
        "prompt": prompt,
        "negative_prompt": negative,
        "width": job["width"] or 0,
        "height": job["height"] or 0,
        "steps": m["steps"],
        "cfg_scale": m["cfg"],
        "sampler_name": m["sampler"],
        "scheduler": m["scheduler"],
        "seed": job["seed_input"] if job["seed_input"] is not None else -1,
        "override_settings": {"sd_model_checkpoint": m["checkpoint"]},
        "override_settings_restore_afterwards": True,
    }


def _apply_guardrails(payload):
    prompt = payload.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise GuardError("input", "payload.prompt must be a non-empty string")
    negative = payload.get("negative_prompt") or ""
    if len(prompt) > 20000 or len(negative) > 20000:
        raise GuardError("input", "prompt/negative exceeds 20000 chars")
    for dim in ("width", "height"):
        v = payload.get(dim)
        if not isinstance(v, int) or isinstance(v, bool):
            raise GuardError("input", f"payload.{dim} must be an int")
        if v < 64 or v > GUARD_MAX_DIM:
            raise GuardError(
                "input", f"payload.{dim} must be within 64..{GUARD_MAX_DIM}")
    if payload["width"] * payload["height"] > GUARD_MAX_PIXELS:
        raise GuardError("input", f"width*height must be <= {GUARD_MAX_PIXELS}")

    detected = [t for t in MINOR_TAGS if _has_tag(prompt, t)]
    if detected:
        raise GuardError(
            "guardrail",
            f"minor tag(s) detected in prompt: {', '.join(detected)}")
    if not _has_tag(prompt, "adult"):
        prompt += ", adult"
    payload["prompt"] = prompt

    for tag in NEGATIVE_GUARD_TAGS:
        if not _has_tag(negative, tag):
            negative = (negative + ", " + tag) if negative.strip() else tag
    payload["negative_prompt"] = negative

    payload["override_settings_restore_afterwards"] = True
    override = payload.get("override_settings")
    if isinstance(override, dict) and "sd_model_checkpoint" in override:
        checkpoint = override.get("sd_model_checkpoint")
        if checkpoint not in CHECKPOINT_ALLOWLIST:
            raise GuardError(
                "guardrail", f"checkpoint not on allowlist: {checkpoint!r}")
    return payload


# --- Word dictionary learning (port of learnPromptWords) ------------

def _split_prompt_words(prompt):
    parts = re.split(r"[\s,()]+|:\s*[\d.]+\s*\)", prompt)
    return [w.strip().lower() for w in parts if w.strip() != ""]


def _learn_prompt_words(dictionary, prompt):
    for word in list(dictionary.keys()):
        contexts = dictionary[word]
        for ctx in list(contexts.keys()):
            decayed = contexts[ctx] * 0.95
            if decayed < 0.01:
                del contexts[ctx]
            else:
                contexts[ctx] = decayed
    dictionary.setdefault("__first__", {})
    words = _split_prompt_words(prompt)

    def add(a, b, points):
        dictionary.setdefault(a, {})[b] = dictionary[a].get(b, 0) + points

    for i, a in enumerate(words):
        dictionary.setdefault(a, {})
        for d in range(1, 6):
            if i + d >= len(words):
                break
            b = words[i + d]
            dictionary.setdefault(b, {})
            add(a, b, 6 - d)
            add(b, a, 6 - d)
    for i in range(min(5, len(words))):
        first = dictionary["__first__"]
        first[words[i]] = first.get(words[i], 0) + (5 - i)


def _learn_from_prompt(prompt):
    with _DB_LOCK:
        conn = _db()
        try:
            row = conn.execute(
                "SELECT data FROM word_dictionary WHERE id = 1").fetchone()
            try:
                dictionary = json.loads(row["data"]) if row else {}
            except ValueError:
                dictionary = {}
            _learn_prompt_words(dictionary, prompt)
            data = json.dumps(dictionary, ensure_ascii=False)
            conn.execute(
                "INSERT INTO word_dictionary (id, data) VALUES (1, ?) "
                "ON CONFLICT(id) DO UPDATE SET data = excluded.data",
                (data,),
            )
            conn.commit()
        finally:
            conn.close()


# --- Job helpers ------------------------------------------------------

def _get_job(job_id):
    conn = _db()
    try:
        row = conn.execute(
            "SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def _update_job(job_id, **fields):
    if not fields:
        return
    fields["updated_at"] = _now_iso()
    cols = ", ".join(f"{k} = ?" for k in fields)
    with _DB_LOCK:
        conn = _db()
        try:
            conn.execute(
                f"UPDATE jobs SET {cols} WHERE id = ?",
                (*fields.values(), job_id),
            )
            conn.commit()
        finally:
            conn.close()


def _set_phase(job_id, phase):
    fields = {"phase": phase, "phase_updated_at": _now_iso()}
    if phase == "generating":
        fields["generating_since"] = time.time()
    _update_job(job_id, **fields)


def _job_view(row):
    completed = row["status"] == "completed"
    host_path = row["host_path"]
    can_send = bool(
        completed and host_path and os.path.isfile(host_path))
    return {
        "id": row["id"],
        "kind": row["kind"],
        "direct": True,
        "status": row["status"],
        "phase": row["phase"],
        "phaseUpdatedAt": row["phase_updated_at"],
        "model": row["model"],
        "prompt": row["prompt"],
        "extraNegative": row["extra_negative"],
        "negativePrompt": row["negative_prompt"],
        "width": row["width"],
        "height": row["height"],
        "seedMode": row["seed_mode"],
        "seedInput": row["seed_input"],
        "steps": row["steps"],
        "cfg": row["cfg"],
        "sampler": row["sampler"],
        "scheduler": row["scheduler"],
        "baseEnabled": bool(row["base_enabled"])
        if row["base_enabled"] is not None else None,
        "photorealisticWeight": row["photorealistic_weight"],
        "comicloWeight": row["comiclo_weight"],
        "mode": row["mode"],
        "denoisingStrength": row["denoising_strength"],
        "canSendToEditor": can_send,
        "resultSeed": row["result_seed"],
        "imageUrl": _file_url(row["image_key"]) if completed else None,
        "displayUrl": _file_url(row["display_key"]) if completed else None,
        "usedParams": row["used_params"],
        "loraHashes": row["lora_hashes"],
        "checkModels": None,
        "checkCheckpoint": None,
        "checkSamplers": None,
        "error": row["error"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _sweep_timeouts():
    """Fail stale running jobs whose worker thread is gone (e.g. the
    WebUI restarted mid-generation). Mirrors the Space's 5-minute
    sweep + reconciliation, simplified: our worker threads always
    write a terminal state themselves, so a live thread is proof of
    life and a dead one means the run is gone."""
    cutoff = time.time() - JOB_TIMEOUT_SECONDS
    conn = _db()
    try:
        rows = conn.execute(
            "SELECT id, created_at FROM jobs WHERE status IN ('queued', 'running')"
        ).fetchall()
    finally:
        conn.close()
    for row in rows:
        with _THREADS_LOCK:
            alive = row["id"] in _THREADS
        if alive:
            continue
        try:
            created = datetime.strptime(
                row["created_at"], "%Y-%m-%dT%H:%M:%S.%fZ"
            ).replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            continue
        if created < cutoff:
            _update_job(
                row["id"],
                status="failed",
                error="生成がタイムアウトしました"
                "（実行が中断された可能性があります）。",
            )


# --- Generation worker ------------------------------------------------

def _sdapi_post(path, payload, timeout=960):
    req = urllib.request.Request(
        SDAPI_BASE + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _fetch_sd_progress():
    try:
        req = urllib.request.Request(
            SDAPI_BASE + "/sdapi/v1/progress?skip_current_image=true")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        state = data.get("state") or {}
        step = state.get("sampling_step")
        steps = state.get("sampling_steps")
        fraction = data.get("progress")
        job_count = state.get("job_count") or 0
        if not (job_count > 0 or (fraction or 0) > 0 or (step or 0) > 0):
            return None
        return {
            "step": step or 0,
            "steps": steps if isinstance(steps, int) and steps > 0 else None,
            "fraction": fraction,
        }
    except Exception:  # noqa: BLE001 - progress is display-only, soft-fail
        return None


def _run_generation(job_id, init_image_path, mask_path, mask_blur=None,
                    mask_invert=None):
    try:
        job = _get_job(job_id)
        if job is None:
            return
        _set_phase(job_id, "connecting")
        payload = _apply_guardrails(_compose_payload(job))
        endpoint = "/sdapi/v1/txt2img"
        used_params = dict(payload)
        if job["mode"] == "img2img":
            endpoint = "/sdapi/v1/img2img"
            with open(init_image_path, "rb") as f:
                init_bytes = f.read()
            payload["init_images"] = [
                base64.b64encode(init_bytes).decode("ascii")]
            payload["denoising_strength"] = job["denoising_strength"]
            payload["include_init_images"] = False
            used_params = dict(payload)
            used_params["init_images"] = [{
                "path": os.path.realpath(init_image_path),
                "bytes": len(init_bytes),
                "sha256": hashlib.sha256(init_bytes).hexdigest(),
            }]
            if mask_path:
                with open(mask_path, "rb") as f:
                    mask_bytes = f.read()
                payload["mask"] = base64.b64encode(mask_bytes).decode("ascii")
                payload["resize_mode"] = 1
                if mask_blur is not None:
                    payload["mask_blur"] = mask_blur
                if mask_invert is not None:
                    payload["inpainting_mask_invert"] = mask_invert
                payload["inpainting_fill"] = 1
                payload["inpaint_full_res"] = False
                payload["inpaint_full_res_padding"] = 32
                init_ref = used_params["init_images"]
                used_params = dict(payload)
                used_params["init_images"] = init_ref
                used_params["mask"] = {
                    "path": os.path.realpath(mask_path),
                    "bytes": len(mask_bytes),
                    "sha256": hashlib.sha256(mask_bytes).hexdigest(),
                }
            else:
                payload["resize_mode"] = 0
                used_params["resize_mode"] = 0
                used_params["denoising_strength"] = job["denoising_strength"]
                used_params["include_init_images"] = False

        _set_phase(job_id, "generating")
        started = time.time()
        result = _sdapi_post(endpoint, payload)
        _set_phase(job_id, "saving")

        images = result.get("images") or []
        if not images:
            raise RuntimeError("SD API returned no images")
        raw = images[0]
        raw = raw.split(",", 1)[1] if "," in raw[:40] else raw
        png_bytes = base64.b64decode(raw)
        if not png_bytes.startswith(PNG_SIG):
            raise RuntimeError("generated image failed the PNG check")

        image_key = f"jobs/{job_id}.png"
        host_path = _write_file(image_key, png_bytes)
        display_key = None
        display = _make_display_jpeg(png_bytes)
        if display:
            display_key = f"jobs/{job_id}.display.jpg"
            _write_file(display_key, display)

        result_seed = None
        lora_hashes = None
        try:
            info = json.loads(result.get("info") or "{}")
            # Forge Neo's info carries all_seeds / seed (not "seeds").
            all_seeds = info.get("all_seeds") or []
            if all_seeds:
                result_seed = int(all_seeds[0])
            elif info.get("seed") is not None:
                result_seed = int(info["seed"])
            infotexts = info.get("infotexts") or []
            if infotexts:
                m = re.search(r'Lora hashes: ((?:"[^"]+"\s*,?\s*)+)',
                              infotexts[0])
                if m:
                    lora_hashes = m.group(1).strip().rstrip(",")
        except Exception:  # noqa: BLE001 - info parsing is best-effort
            pass

        duration_ms = int((time.time() - started) * 1000)
        with _DB_LOCK:
            conn = _db()
            try:
                conn.execute(
                    "INSERT INTO generation_stats "
                    "(job_id, model, width, height, steps, duration_ms, "
                    "created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (job_id, job["model"], job["width"], job["height"],
                     MODEL_TABLE.get(job["model"] or "wai",
                                     MODEL_TABLE["wai"])["steps"],
                     duration_ms, _now_iso()),
                )
                conn.commit()
            finally:
                conn.close()

        _update_job(
            job_id,
            status="completed",
            phase=None,
            result_seed=result_seed,
            image_key=image_key,
            display_key=display_key,
            host_path=host_path,
            used_params=json.dumps(used_params, ensure_ascii=False),
            lora_hashes=lora_hashes,
            stats_recorded=1,
            error=None,
        )
        # A finished generation becomes the Editor's image: point
        # the editor slot at this job (the client only refreshes
        # the slot when the newest job completes; it never points
        # the slot at the job itself). Best-effort: a failure here
        # must never fail the completion. The slot pointing at an
        # upload is simply replaced — library uploads are records
        # of their own and are never deleted by this.
        try:
            current = _load_editor_source()
            if not (current and current["kind"] == "job"
                    and current["job_id"] == job_id):
                _set_editor_source("job", job_id=job_id)
        except Exception:  # noqa: BLE001 - completion already recorded
            pass
    except GuardError as e:
        _update_job(job_id, status="failed",
                    error=f"{e.stage}: {e.message}")
    except Exception as e:  # noqa: BLE001 - recorded on the job row
        _update_job(job_id, status="failed", error=str(e)[:800])
    finally:
        with _THREADS_LOCK:
            _THREADS.pop(job_id, None)


def _start_generation(job_id, init_image_path, mask_path, mask_blur,
                      mask_invert):
    thread = threading.Thread(
        target=_run_generation,
        args=(job_id, init_image_path, mask_path, mask_blur, mask_invert),
        daemon=True,
    )
    with _THREADS_LOCK:
        _THREADS[job_id] = thread
    thread.start()


# --- Editor source helpers ---------------------------------------------

def _load_editor_source():
    conn = _db()
    try:
        row = conn.execute(
            "SELECT * FROM editor_source WHERE id = 1").fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def _set_editor_source(kind, job_id=None, upload_id=None):
    with _DB_LOCK:
        conn = _db()
        try:
            conn.execute(
                "INSERT INTO editor_source (id, kind, job_id, upload_id) "
                "VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET "
                "kind = excluded.kind, job_id = excluded.job_id, "
                "upload_id = excluded.upload_id",
                (kind, job_id, upload_id),
            )
            conn.commit()
        finally:
            conn.close()


def _clear_editor_source():
    with _DB_LOCK:
        conn = _db()
        try:
            conn.execute("DELETE FROM editor_source WHERE id = 1")
            conn.commit()
        finally:
            conn.close()


def _none_source_view():
    return {
        "kind": "none", "jobId": None, "uploadId": None,
        "resultSeed": None, "displayUrl": None, "imageUrl": None,
        "mimeType": None, "byteSize": None, "fileName": None,
    }


def _get_upload(upload_id):
    conn = _db()
    try:
        row = conn.execute(
            "SELECT * FROM upload_images WHERE id = ?",
            (upload_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def _upload_view(row):
    return {
        "id": row["id"],
        "fileName": row["file_name"],
        "storedName": row["stored_name"],
        "mimeType": row["mime_type"],
        "byteSize": row["byte_size"],
        "imageUrl": _file_url(row["image_key"]),
        "displayUrl": _file_url(row["display_key"] or row["image_key"]),
        "createdAt": row["created_at"],
    }


def _editor_source_view():
    src = _load_editor_source()
    if not src:
        return _none_source_view()
    if src["kind"] == "job" and src["job_id"] is not None:
        job = _get_job(src["job_id"])
        if (job and job["status"] == "completed" and job["image_key"]
                and _read_file(job["image_key"]) is not None):
            return {
                "kind": "job",
                "jobId": job["id"],
                "uploadId": None,
                "resultSeed": job["result_seed"],
                "displayUrl": _file_url(
                    job["display_key"] or job["image_key"]),
                "imageUrl": _file_url(job["image_key"]),
                "mimeType": "image/png",
                "byteSize": os.path.getsize(
                    _file_path(job["image_key"])),
                "fileName": None,
            }
        return _none_source_view()
    if src["kind"] == "upload" and src["upload_id"] is not None:
        upload = _get_upload(src["upload_id"])
        if upload:
            return {
                "kind": "upload",
                "jobId": None,
                "uploadId": upload["id"],
                "resultSeed": None,
                "displayUrl": _file_url(
                    upload["display_key"] or upload["image_key"]),
                "imageUrl": _file_url(upload["image_key"]),
                "mimeType": upload["mime_type"],
                "byteSize": upload["byte_size"],
                "fileName": upload["file_name"],
            }
        return _none_source_view()
    return _none_source_view()


_SAVED_NAME_RE = re.compile(r"^(\d+)-\d+\.(?:png|jpg)$")


def _claim_save_counter():
    """Claim the next save counter value, SD WebUI style: scan the
    saved files' names ({counter}-{seed}.png) and hand out max + 1.
    With no saved files present, the sequence starts at
    SAVE_COUNTER_INITIAL (the value the numbering was seeded with).
    Like SD WebUI's own sequence numbers, deleting the highest file
    makes its number reusable, and copying saved files in from
    elsewhere moves the sequence along automatically. Callers must
    read their source files BEFORE claiming, so a failed read never
    burns a number; the claim and the following insert run under the
    DB lock so concurrent saves cannot take the same number."""
    with _DB_LOCK:
        saved_dir = os.path.join(_STATE["data_dir"], "files", "saved")
        highest = None
        try:
            names = os.listdir(saved_dir)
        except OSError:
            names = []
        for name in names:
            m = _SAVED_NAME_RE.match(name)
            if m:
                value = int(m.group(1))
                if highest is None or value > highest:
                    highest = value
        return SAVE_COUNTER_INITIAL if highest is None else highest + 1


def _save_image_response_fail(error):
    return {"ok": False, "error": error, "name": None,
            "counter": None, "seed": None}


def _insert_saved(counter, seed, source_job_id, source_kind,
                  source_upload_id, file_ext, image_key, display_key):
    with _DB_LOCK:
        conn = _db()
        try:
            conn.execute(
                "INSERT INTO saved_images (counter, seed, source_job_id, "
                "source_kind, source_upload_id, file_ext, image_key, "
                "display_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (counter, seed, source_job_id, source_kind,
                 source_upload_id, file_ext, image_key, display_key,
                 _now_iso()),
            )
            conn.commit()
        finally:
            conn.close()


# --- Action handlers ----------------------------------------------------

def _act_get_standard_negative(args):
    return {"standardNegative": STANDARD_NEGATIVE}


def _act_get_word_dictionary(args):
    conn = _db()
    try:
        row = conn.execute(
            "SELECT data FROM word_dictionary WHERE id = 1").fetchone()
        return {"dictionary": row["data"] if row else "{}"}
    finally:
        conn.close()


def _act_get_text_snippets(args):
    conn = _db()
    try:
        row = conn.execute(
            "SELECT data FROM text_snippets WHERE id = 1").fetchone()
        return {"snippets": row["data"] if row else "[]"}
    finally:
        conn.close()


def _act_save_text_snippets(args):
    snippets = args.get("snippets")
    if not isinstance(snippets, list):
        raise ValueError("snippets must be an array")
    data = json.dumps(snippets, ensure_ascii=False)
    with _DB_LOCK:
        conn = _db()
        try:
            conn.execute(
                "INSERT INTO text_snippets (id, data) VALUES (1, ?) "
                "ON CONFLICT(id) DO UPDATE SET data = excluded.data",
                (data,),
            )
            conn.commit()
        finally:
            conn.close()
    return {"ok": True}


def _act_get_workspace_state(args):
    conn = _db()
    try:
        row = conn.execute(
            "SELECT settings, prompt FROM workspace_state WHERE id = 1"
        ).fetchone()
        if not row:
            return {"settings": "", "prompt": ""}
        return {"settings": row["settings"], "prompt": row["prompt"]}
    finally:
        conn.close()


def _save_workspace_field(field, value):
    with _DB_LOCK:
        conn = _db()
        try:
            conn.execute(
                "INSERT INTO workspace_state (id, settings, prompt) "
                "VALUES (1, '', '') ON CONFLICT(id) DO NOTHING"
            )
            conn.execute(
                f"UPDATE workspace_state SET {field} = ? WHERE id = 1",
                (value,),
            )
            conn.commit()
        finally:
            conn.close()


def _act_save_settings(args):
    _save_workspace_field("settings", str(args.get("settings") or ""))
    return {"ok": True}


def _act_save_prompt(args):
    _save_workspace_field("prompt", str(args.get("prompt") or ""))
    return {"ok": True}


def _act_list_jobs(args):
    _sweep_timeouts()
    limit = args.get("limit") or 50
    limit = max(1, min(100, int(limit)))
    conn = _db()
    try:
        rows = conn.execute(
            "SELECT * FROM jobs ORDER BY id DESC LIMIT ?",
            (limit,)).fetchall()
        return {"jobs": [_job_view(dict(r)) for r in rows]}
    finally:
        conn.close()


def _act_get_editor_source(args):
    return {"source": _editor_source_view()}


def _decode_base64_image(value):
    if not isinstance(value, str) or not value:
        return None
    if value.startswith("data:"):
        value = value.split(",", 1)[1] if "," in value else ""
    try:
        return base64.b64decode(value)
    except Exception:  # noqa: BLE001
        return None


def _act_upload_editor_image(args):
    def fail(error):
        return {"ok": False, "error": error,
                "source": _editor_source_view()}

    data = _decode_base64_image(args.get("dataBase64"))
    if data is None:
        return fail("画像データを読み取れませんでした。")
    if len(data) > MAX_IMAGE_BYTES:
        return fail("画像が大きすぎます（25 MB まで）。")
    if data.startswith(PNG_SIG):
        mime, ext = "image/png", "png"
    elif data.startswith(JPEG_SIG):
        mime, ext = "image/jpeg", "jpg"
    else:
        return fail("画像の形式が PNG でも JPEG でもありません。")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    rand = f"{int(time.time() * 1000) % 10000:04d}"
    stored_name = f"upload-{stamp}-{rand}.{ext}"
    image_key = f"uploads/{stored_name}"
    host_path = _write_file(image_key, data)

    display_key = None
    client_display = _decode_base64_image(args.get("displayDataBase64"))
    if client_display and client_display.startswith(JPEG_SIG):
        display_key = f"uploads/{stored_name.rsplit('.', 1)[0]}.display.jpg"
        _write_file(display_key, client_display)
    else:
        display = _make_display_jpeg(data)
        if display:
            display_key = (
                f"uploads/{stored_name.rsplit('.', 1)[0]}.display.jpg")
            _write_file(display_key, display)

    with _DB_LOCK:
        conn = _db()
        try:
            cur = conn.execute(
                "INSERT INTO upload_images (file_name, stored_name, "
                "mime_type, byte_size, host_path, image_key, display_key, "
                "created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (args.get("fileName") or "", stored_name, mime,
                 len(data), host_path, image_key, display_key, _now_iso()),
            )
            upload_id = cur.lastrowid
            conn.commit()
        finally:
            conn.close()
    _set_editor_source("upload", upload_id=upload_id)
    return {"ok": True, "error": None, "source": _editor_source_view()}


def _act_list_upload_images(args):
    limit = args.get("limit") or 100
    limit = max(1, min(200, int(limit)))
    conn = _db()
    try:
        rows = conn.execute(
            "SELECT * FROM upload_images ORDER BY id DESC LIMIT ?",
            (limit,)).fetchall()
        return {"uploads": [_upload_view(dict(r)) for r in rows]}
    finally:
        conn.close()


def _act_set_editor_source_from_upload(args):
    upload = _get_upload(int(args["uploadId"]))
    if not upload:
        return {"ok": False, "error": "アップロード画像が見つかりませんでした。",
                "source": _editor_source_view()}
    _set_editor_source("upload", upload_id=upload["id"])
    return {"ok": True, "error": None, "source": _editor_source_view()}


def _act_delete_upload_image(args):
    upload = _get_upload(int(args["uploadId"]))
    if not upload:
        return {"ok": True, "deleted": 0}
    src = _load_editor_source()
    if (src and src["kind"] == "upload"
            and src["upload_id"] == upload["id"]):
        _clear_editor_source()
    with _DB_LOCK:
        conn = _db()
        try:
            conn.execute("DELETE FROM upload_images WHERE id = ?",
                         (upload["id"],))
            conn.commit()
        finally:
            conn.close()
    _delete_file(upload["image_key"])
    _delete_file(upload["display_key"])
    return {"ok": True, "deleted": 1}


def _act_save_upload_image(args):
    upload = _get_upload(int(args["uploadId"]))
    if not upload:
        return _save_image_response_fail(
            "保存できるアップロード画像が見つかりませんでした。")
    data = _read_file(upload["image_key"])
    if data is None:
        return _save_image_response_fail(
            "元画像ファイルを読み取れませんでした。")
    with _DB_LOCK:
        counter = _claim_save_counter()
        name = f"{counter}-0"
        file_ext = upload["stored_name"].rsplit(".", 1)[-1].lower()
        image_key = f"saved/{name}.{file_ext}"
        _write_file(image_key, data)
        display_key = None
        if upload["display_key"]:
            display = _read_file(upload["display_key"])
            if display:
                display_key = f"saved/{name}.display.jpg"
                _write_file(display_key, display)
        _insert_saved(counter, 0, None, "upload", upload["id"], file_ext,
                      image_key, display_key)
    return {"ok": True, "error": None, "name": name,
            "counter": counter, "seed": 0}


def _act_set_editor_source_from_job(args):
    job = _get_job(int(args["jobId"]))
    if (not job or job["status"] != "completed" or not job["image_key"]
            or _read_file(job["image_key"]) is None):
        return {"ok": False, "error": "生成結果が見つかりませんでした。",
                "source": _editor_source_view()}
    _set_editor_source("job", job_id=job["id"])
    return {"ok": True, "error": None, "source": _editor_source_view()}


def _act_clear_editor_source(args):
    _clear_editor_source()
    return {"ok": True, "error": None, "source": _editor_source_view()}


def _act_create_job(args):
    _sweep_timeouts()
    is_inpaint = bool(args.get("maskDataBase64"))
    if is_inpaint and args.get("mode") != "img2img":
        return {"ok": False, "jobId": None,
                "error": "マスク付きの生成は img2img として実行してください。"}

    init_image_path = None
    if args.get("mode") == "img2img":
        if args.get("denoisingStrength") is None:
            return {"ok": False, "jobId": None,
                    "error": "denoise は 0〜1 の数値で入力してください。"}
        if args.get("initSource") == "upload":
            src = _load_editor_source()
            upload = None
            if src and src["kind"] == "upload" and src["upload_id"]:
                upload = _get_upload(src["upload_id"])
            if not upload:
                return {
                    "ok": False, "jobId": None,
                    "error": "アップロード画像が元イメージにセットされていません。"
                             "Editor で画像をアップロードしてください。",
                }
            init_image_path = upload["host_path"]
        elif args.get("sourceJobId") is not None:
            source_job = _get_job(int(args["sourceJobId"]))
            if (not source_job or source_job["status"] != "completed"
                    or not source_job["host_path"]
                    or not os.path.isfile(source_job["host_path"])):
                return {
                    "ok": False, "jobId": None,
                    "error": "元イメージの生成ジョブが見つかりませんでした。",
                }
            init_image_path = source_job["host_path"]
        else:
            return {"ok": False, "jobId": None,
                    "error": "元イメージが指定されていません。"}

    now = _now_iso()
    with _DB_LOCK:
        conn = _db()
        try:
            cur = conn.execute(
                "INSERT INTO jobs (kind, status, phase, phase_updated_at, "
                "model, prompt, extra_negative, negative_prompt, width, "
                "height, seed_mode, seed_input, steps, cfg, sampler, "
                "scheduler, base_enabled, photorealistic_weight, "
                "comiclo_weight, mode, denoising_strength, created_at, "
                "updated_at) VALUES ('generate', 'running', "
                "'agent_starting', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "
                "?, ?, ?, ?, ?, ?, ?)",
                (
                    now,
                    args.get("model"), args.get("prompt"),
                    args.get("extraNegative") or "",
                    args.get("negativePrompt"),
                    args.get("width"), args.get("height"),
                    args.get("seedMode"), args.get("seed"),
                    args.get("steps"), args.get("cfg"),
                    args.get("sampler"), args.get("scheduler"),
                    1 if args.get("baseEnabled") else 0,
                    args.get("photorealisticWeight"),
                    args.get("comicloWeight"),
                    args.get("mode") or "txt2img",
                    args.get("denoisingStrength"),
                    now, now,
                ),
            )
            job_id = cur.lastrowid
            conn.execute(
                "UPDATE jobs SET job_key = ? WHERE id = ?",
                (f"priv-{job_id}", job_id),
            )
            conn.commit()
        finally:
            conn.close()

    mask_path = None
    if is_inpaint:
        mask_bytes = _decode_base64_image(args.get("maskDataBase64"))
        mask_error = None
        if mask_bytes is None:
            mask_error = "マスク画像を読み取れませんでした。"
        elif len(mask_bytes) > MAX_IMAGE_BYTES:
            mask_error = "マスク画像が大きすぎます（25 MB まで）。"
        elif not mask_bytes.startswith(PNG_SIG):
            mask_error = "マスク画像の形式が PNG ではありません。"
        if mask_error:
            _update_job(job_id, status="failed", error=mask_error)
            return {"ok": False, "jobId": job_id, "error": mask_error}
        mask_path = os.path.join(
            _STATE["data_dir"], "masks", f"{job_id}.png")
        with open(mask_path, "wb") as f:
            f.write(mask_bytes)

    try:
        _learn_from_prompt(args.get("prompt") or "")
    except Exception:  # noqa: BLE001 - learning must not block generation
        pass

    _start_generation(job_id, init_image_path, mask_path,
                      args.get("maskBlur"), args.get("maskInvert"))
    return {"ok": True, "jobId": job_id, "error": None}


def _act_poll_generation_job(args):
    job = _get_job(int(args["jobId"]))
    if job is None:
        return {"state": "missing", "error": None, "progress": None}
    if job["status"] == "completed":
        return {"state": "completed", "error": None, "progress": None}
    if job["status"] == "failed":
        return {"state": "failed", "error": job["error"], "progress": None}
    progress = None
    if job["phase"] == "generating":
        progress = _fetch_sd_progress()
    return {"state": "running", "error": None, "progress": progress}


def _act_delete_jobs(args):
    deleted = 0
    src = _load_editor_source()
    with _DB_LOCK:
        conn = _db()
        try:
            for job_id in args.get("jobIds") or []:
                row = conn.execute(
                    "SELECT image_key, display_key FROM jobs WHERE id = ?",
                    (int(job_id),)).fetchone()
                if not row:
                    continue
                conn.execute("DELETE FROM jobs WHERE id = ?",
                             (int(job_id),))
                if (src and src["kind"] == "job"
                        and src["job_id"] == int(job_id)):
                    conn.execute(
                        "DELETE FROM editor_source WHERE id = 1")
                    src = None
                _delete_file(row["image_key"])
                _delete_file(row["display_key"])
                mask = os.path.join(
                    _STATE["data_dir"], "masks", f"{int(job_id)}.png")
                if os.path.isfile(mask):
                    try:
                        os.remove(mask)
                    except OSError:
                        pass
                deleted += 1
            conn.commit()
        finally:
            conn.close()
    return {"ok": True, "deleted": deleted}


def _act_save_job_image(args):
    job = _get_job(int(args["jobId"]))
    if (not job or job["kind"] != "generate"
            or job["status"] != "completed" or not job["image_key"]):
        return _save_image_response_fail(
            "保存できる生成結果が見つかりませんでした。")
    if job["result_seed"] is None:
        return _save_image_response_fail(
            "シードが記録されていない生成は保存できません。")
    data = _read_file(job["image_key"])
    if data is None:
        return _save_image_response_fail(
            "元画像ファイルを読み取れませんでした。")
    if not data.startswith(PNG_SIG):
        return _save_image_response_fail(
            "元画像ファイルの形式が PNG ではありませんでした。")
    with _DB_LOCK:
        counter = _claim_save_counter()
        seed = job["result_seed"]
        name = f"{counter}-{seed}"
        image_key = f"saved/{name}.png"
        _write_file(image_key, data)
        display_key = None
        if job["display_key"]:
            display = _read_file(job["display_key"])
            if display:
                display_key = f"saved/{name}.display.jpg"
                _write_file(display_key, display)
        _insert_saved(counter, seed, job["id"], "job", None, "png",
                      image_key, display_key)
    return {"ok": True, "error": None, "name": name,
            "counter": counter, "seed": seed}


def _act_list_saved_images(args):
    limit = args.get("limit") or 100
    limit = max(1, min(200, int(limit)))
    conn = _db()
    try:
        rows = conn.execute(
            "SELECT * FROM saved_images ORDER BY id DESC LIMIT ?",
            (limit,)).fetchall()
        saved = []
        for r in rows:
            row = dict(r)
            saved.append({
                "id": row["id"],
                "counter": row["counter"],
                "seed": row["seed"],
                "name": f"{row['counter']}-{row['seed']}",
                "sourceJobId": row["source_job_id"],
                "sourceKind": row["source_kind"],
                "sourceUploadId": row["source_upload_id"],
                "fileExt": row["file_ext"],
                "imageUrl": _file_url(row["image_key"]),
                "displayUrl": _file_url(
                    row["display_key"] or row["image_key"]),
                "createdAt": row["created_at"],
            })
        return {"saved": saved}
    finally:
        conn.close()


def _act_delete_saved_images(args):
    deleted = 0
    with _DB_LOCK:
        conn = _db()
        try:
            for saved_id in args.get("ids") or []:
                row = conn.execute(
                    "SELECT image_key, display_key FROM saved_images "
                    "WHERE id = ?", (int(saved_id),)).fetchone()
                if not row:
                    continue
                conn.execute("DELETE FROM saved_images WHERE id = ?",
                             (int(saved_id),))
                _delete_file(row["image_key"])
                _delete_file(row["display_key"])
                deleted += 1
            conn.commit()
        finally:
            conn.close()
    return {"ok": True, "deleted": deleted}


ACTIONS = {
    "getStandardNegative": _act_get_standard_negative,
    "getWordDictionary": _act_get_word_dictionary,
    "getTextSnippets": _act_get_text_snippets,
    "saveTextSnippets": _act_save_text_snippets,
    "getWorkspaceState": _act_get_workspace_state,
    "saveSettings": _act_save_settings,
    "savePrompt": _act_save_prompt,
    "listJobs": _act_list_jobs,
    "getEditorSource": _act_get_editor_source,
    "uploadEditorImage": _act_upload_editor_image,
    "listUploadImages": _act_list_upload_images,
    "setEditorSourceFromUpload": _act_set_editor_source_from_upload,
    "deleteUploadImage": _act_delete_upload_image,
    "saveUploadImage": _act_save_upload_image,
    "setEditorSourceFromJob": _act_set_editor_source_from_job,
    "clearEditorSource": _act_clear_editor_source,
    "createJob": _act_create_job,
    "pollGenerationJob": _act_poll_generation_job,
    "deleteJobs": _act_delete_jobs,
    "saveJobImage": _act_save_job_image,
    "listSavedImages": _act_list_saved_images,
    "deleteSavedImages": _act_delete_saved_images,
}


def register_workbench(app, extension_root):
    """Register the actions endpoint and the file route on the app.
    Must be called BEFORE the /mobileplus StaticFiles mount so these
    routes win over the mount."""
    from fastapi import Request
    from fastapi.responses import FileResponse, JSONResponse

    _STATE["root"] = extension_root
    _STATE["data_dir"] = os.path.join(extension_root, "workbench-data")
    _STATE["db_path"] = os.path.join(_STATE["data_dir"], "workbench.db")
    os.makedirs(_STATE["data_dir"], exist_ok=True)
    _init_db()

    @app.post("/mobileplus/actions")
    async def workbench_actions(request: Request):
        try:
            body = await request.json()
        except Exception:  # noqa: BLE001
            return JSONResponse({"error": "invalid JSON body"},
                                status_code=400)
        action = body.get("action")
        args = body.get("args") or {}
        handler = ACTIONS.get(action)
        if handler is None:
            return JSONResponse(
                {"error": f"unknown action: {action}"}, status_code=404)
        try:
            result = handler(args)
            # The space-sdk client unwraps `body.data` and treats a
            # truthy `body.error` as a thrown action error.
            return JSONResponse({"data": result})
        except Exception as e:  # noqa: BLE001 - surfaced to the client
            return JSONResponse({"error": str(e)[:800]}, status_code=500)

    @app.get("/mobileplus/files/{key:path}")
    async def workbench_files(key: str):
        path = _file_path(key)
        if not path or not os.path.isfile(path):
            return JSONResponse({"error": "not found"}, status_code=404)
        return FileResponse(path)

    print("[Mobile+] Workbench actions backend registered "
          f"({len(ACTIONS)} actions, data: {_STATE['data_dir']})")
