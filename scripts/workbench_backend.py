"""Workbench actions backend for the Mobile+ extension.

Implements the workbench action contract (27 client-facing
actions) directly inside Forge's FastAPI app:

  POST /mobileplus/api/<action>   the action's args as the JSON body
  GET  /mobileplus/files/<key>    stored image files (jobs/uploads/saved)

State lives in the extension's own workbench-data/ directory: a
SQLite database (jobs, upload library, saved images, editor source,
workspace state, word dictionary, text snippets, save counter,
generation stats) plus image files under workbench-data/files/.
Generation runs against Forge's own SD API on loopback
(127.0.0.1:7860) from a worker thread per job: the client composes
the full sdapi payload and the worker POSTs it verbatim; the
backend only syncs Forge's additional-modules state to the
payload's declared modules first (see _sync_additional_modules)
and records the outcome.

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
import zlib
from datetime import datetime, timezone

SDAPI_BASE = "http://127.0.0.1:7860"
FILES_PREFIX = "/mobileplus/files/"
MAX_IMAGE_BYTES = 25 * 1024 * 1024
JOB_TIMEOUT_SECONDS = 300

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
              status TEXT NOT NULL DEFAULT 'running',
              phase TEXT,
              phase_updated_at TEXT,
              model TEXT, prompt TEXT,
              negative_prompt TEXT,
              width INTEGER, height INTEGER,
              seed_mode TEXT, seed_input INTEGER,
              steps INTEGER, cfg REAL, sampler TEXT, scheduler TEXT,
              mode TEXT, denoising_strength REAL, resize_mode INTEGER,
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
              prompt TEXT,
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
            CREATE TABLE IF NOT EXISTS source_image (
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
        # Column migrations for databases created before the
        # column existed (CREATE TABLE IF NOT EXISTS never adds
        # columns to an existing table).
        job_cols = [r[1] for r in conn.execute("PRAGMA table_info(jobs)")]
        if "resize_mode" not in job_cols:
            conn.execute(
                "ALTER TABLE jobs ADD COLUMN resize_mode INTEGER")
            conn.commit()
        # Legacy columns (the style weights, job_key and
        # extra_negative, removed 2026-11-26): drop them from
        # databases created while they existed. A failed drop is
        # harmless — nothing reads them any more.
        for legacy_col in ("base_enabled", "photorealistic_weight",
                           "comiclo_weight", "job_key",
                           "extra_negative"):
            if legacy_col in job_cols:
                try:
                    conn.execute(
                        f"ALTER TABLE jobs DROP COLUMN {legacy_col}")
                    conn.commit()
                except Exception:  # noqa: BLE001 - see above
                    pass
        upload_cols = [r[1] for r in conn.execute(
            "PRAGMA table_info(upload_images)")]
        if "prompt" not in upload_cols:
            conn.execute(
                "ALTER TABLE upload_images ADD COLUMN prompt TEXT")
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
        "status": row["status"],
        "phase": row["phase"],
        "phaseUpdatedAt": row["phase_updated_at"],
        "model": row["model"],
        "prompt": row["prompt"],
        "negativePrompt": row["negative_prompt"],
        "width": row["width"],
        "height": row["height"],
        "seedMode": row["seed_mode"],
        "seedInput": row["seed_input"],
        "steps": row["steps"],
        "cfg": row["cfg"],
        "sampler": row["sampler"],
        "scheduler": row["scheduler"],
        "mode": row["mode"],
        "denoisingStrength": row["denoising_strength"],
        "canSendToEditor": can_send,
        "resultSeed": row["result_seed"],
        "imageUrl": _file_url(row["image_key"]) if completed else None,
        "displayUrl": _file_url(row["display_key"]) if completed else None,
        "usedParams": row["used_params"],
        "loraHashes": row["lora_hashes"],
        "error": row["error"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _sweep_timeouts():
    """Fail stale running jobs whose worker thread is gone (e.g. the
    WebUI restarted mid-generation). A 5-minute sweep +
    reconciliation, simplified: our worker threads always
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


def _sdapi_get(path, timeout=30):
    req = urllib.request.Request(SDAPI_BASE + path)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _sync_additional_modules(payload):
    """Match Forge's global additional-modules state to the payload
    before a generation.

    Forge loads VAE / text-encoder modules from the global
    `forge_additional_modules` option, and the txt2img/img2img
    request field of the same name is inert: it neither loads the
    modules a model needs (Anima then fails with "You do not have
    VAE state dict!") nor clears ones a previous model left behind
    (every later model decodes through the wrong VAE and comes
    out black). Verified 2026-11-25. So the state is
    synchronized here from the payload's declared modules,
    resolved to absolute paths through /sdapi/v1/sd-modules.
    A payload without modules means the state must be empty.
    """
    wanted = payload.get("additional_modules") or []
    desired = []
    if wanted:
        catalog = {}
        for entry in _sdapi_get("/sdapi/v1/sd-modules"):
            filename = entry.get("filename")
            name = entry.get("model_name")
            if filename:
                catalog[filename] = filename
                if name:
                    catalog[name] = filename
        for item in wanted:
            if not isinstance(item, str):
                continue
            path = catalog.get(item) or catalog.get(
                item + ".safetensors")
            if path is None:
                raise RuntimeError(
                    f"additional module not found: {item}")
            if path not in desired:
                desired.append(path)
    options = _sdapi_get("/sdapi/v1/options")
    current = options.get("forge_additional_modules") or []
    if sorted(current) != sorted(desired):
        _sdapi_post("/sdapi/v1/options",
                    {"forge_additional_modules": desired})


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
    except Exception as e:  # noqa: BLE001 - progress is display-only, soft-fail
        print(f"[Mobile+] progress fetch failed: "
              f"{type(e).__name__}: {e}", flush=True)
        return None


def _blob_ref(b64):
    """A stored reference for one base64 blob in used_params: the
    payload is never persisted with image bytes inlined."""
    try:
        raw = base64.b64decode(b64)
        return {"bytes": len(raw),
                "sha256": hashlib.sha256(raw).hexdigest()}
    except Exception:  # noqa: BLE001 - a ref is bookkeeping only
        return {"bytes": 0, "sha256": None}


def _elide_payload(payload):
    """The used_params copy of the client's payload, with the
    bulky base64 image fields replaced by byte/hash references."""
    used = dict(payload)
    inits = used.get("init_images")
    if isinstance(inits, list):
        used["init_images"] = [
            _blob_ref(x) if isinstance(x, str) else x for x in inits]
    if isinstance(used.get("mask"), str):
        used["mask"] = _blob_ref(used["mask"])
    return used


def _run_generation(job_id, payload):
    try:
        job = _get_job(job_id)
        if job is None:
            return
        _set_phase(job_id, "connecting")
        # Payload passthrough: the payload arrived complete from
        # the client and goes to the API exactly as received. The
        # endpoint is the only choice made here, from the job's
        # recorded mode.
        endpoint = ("/sdapi/v1/img2img" if job["mode"] == "img2img"
                    else "/sdapi/v1/txt2img")
        used_params = _elide_payload(payload)

        _sync_additional_modules(payload)
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
                     job["steps"],
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
    except Exception as e:  # noqa: BLE001 - recorded on the job row
        _update_job(job_id, status="failed", error=str(e)[:800])
    finally:
        with _THREADS_LOCK:
            _THREADS.pop(job_id, None)


def _start_generation(job_id, payload):
    thread = threading.Thread(
        target=_run_generation,
        args=(job_id, payload),
        daemon=True,
    )
    with _THREADS_LOCK:
        _THREADS[job_id] = thread
    thread.start()


# --- Editor source helpers ---------------------------------------------

def _load_editor_source(table="editor_source"):
    conn = _db()
    try:
        row = conn.execute(
            f"SELECT * FROM {table} WHERE id = 1").fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def _set_editor_source(kind, job_id=None, upload_id=None,
                       table="editor_source"):
    with _DB_LOCK:
        conn = _db()
        try:
            conn.execute(
                f"INSERT INTO {table} (id, kind, job_id, upload_id) "
                "VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET "
                "kind = excluded.kind, job_id = excluded.job_id, "
                "upload_id = excluded.upload_id",
                (kind, job_id, upload_id),
            )
            conn.commit()
        finally:
            conn.close()


def _clear_editor_source(table="editor_source"):
    with _DB_LOCK:
        conn = _db()
        try:
            conn.execute(f"DELETE FROM {table} WHERE id = 1")
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


def _png_text_chunks(data):
    """The PNG's text chunks as {keyword: text} (tEXt / zTXt /
    iTXt). WebUI-generated PNGs carry their infotext under the
    "parameters" keyword."""
    texts = {}
    if not data.startswith(PNG_SIG):
        return texts
    pos = len(PNG_SIG)
    while pos + 8 <= len(data):
        length = int.from_bytes(data[pos:pos + 4], "big")
        ctype = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        if len(chunk) < length:
            break
        pos += 8 + length + 4
        if ctype == b"IEND":
            break
        if ctype not in (b"tEXt", b"zTXt", b"iTXt"):
            continue
        try:
            if ctype == b"tEXt":
                key, _, value = chunk.partition(b"\x00")
                texts[key.decode("latin-1")] = value.decode(
                    "utf-8", "replace")
            elif ctype == b"zTXt":
                key, _, rest = chunk.partition(b"\x00")
                if rest[:1] == b"\x00":
                    texts[key.decode("latin-1")] = zlib.decompress(
                        rest[1:]).decode("utf-8", "replace")
            else:  # iTXt: key \0 flag method lang \0 translated \0 text
                key, _, rest = chunk.partition(b"\x00")
                if len(rest) < 2:
                    continue
                compressed = rest[0]
                rest = rest[2:]
                _lang, _, rest = rest.partition(b"\x00")
                _translated, _, text = rest.partition(b"\x00")
                if compressed == 1:
                    text = zlib.decompress(text)
                texts[key.decode("utf-8", "replace")] = text.decode(
                    "utf-8", "replace")
        except Exception:
            continue
    return texts


def _prompt_from_infotext(text):
    """The positive prompt of a WebUI infotext: everything before
    the "Negative prompt:" line, minus the trailing "Steps: ..."
    parameter line."""
    lines = text.split("\n")
    if lines and lines[-1].startswith("Steps: "):
        lines = lines[:-1]
    out = []
    for line in lines:
        if line.startswith("Negative prompt:"):
            break
        out.append(line)
    prompt = "\n".join(out).strip()
    return prompt or None


def _extract_png_prompt(data):
    """The positive prompt embedded in an uploaded PNG's
    metadata, or None. A "parameters" chunk (WebUI infotext) is
    parsed; a bare "prompt" chunk is taken as-is."""
    texts = _png_text_chunks(data)
    if texts.get("parameters"):
        return _prompt_from_infotext(texts["parameters"])
    if texts.get("prompt"):
        return texts["prompt"].strip() or None
    return None


def _upload_view(row):
    return {
        "id": row["id"],
        "fileName": row["file_name"],
        "storedName": row["stored_name"],
        "mimeType": row["mime_type"],
        "byteSize": row["byte_size"],
        "imageUrl": _file_url(row["image_key"]),
        "displayUrl": _file_url(row["display_key"] or row["image_key"]),
        "prompt": row["prompt"],
        "createdAt": row["created_at"],
    }


def _editor_source_view(table="editor_source"):
    src = _load_editor_source(table)
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


def _store_save_index(value):
    with _DB_LOCK:
        conn = _db()
        try:
            conn.execute(
                "INSERT INTO save_counter (id, value) VALUES (1, ?) "
                "ON CONFLICT(id) DO UPDATE SET value = excluded.value",
                (int(value),))
            conn.commit()
        finally:
            conn.close()


def _stored_save_index():
    """The latest save index the server holds. The counter is
    managed by the client (2026-11-23): the server only remembers
    the newest value it received — via a save action or
    setSaveIndex — and hands it back as the client's initial
    value at startup. A fresh install starts at 0."""
    conn = _db()
    try:
        row = conn.execute(
            "SELECT value FROM save_counter WHERE id = 1").fetchone()
        return row["value"] if row else 0
    finally:
        conn.close()


def _index_from_args(args):
    """The save index for a save action: the value the client
    incremented and passed. A missing or invalid value falls
    back to the stored latest + 1 so the save still lands."""
    raw = args.get("index")
    if isinstance(raw, int) and not isinstance(raw, bool) and raw >= 0:
        return raw
    return _stored_save_index() + 1


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
            return {"settings": "", "prompt": "",
                    "saveIndex": _stored_save_index()}
        return {"settings": row["settings"], "prompt": row["prompt"],
                "saveIndex": _stored_save_index()}
    finally:
        conn.close()


def _act_set_save_index(args):
    raw = args.get("index")
    if (not isinstance(raw, int) or isinstance(raw, bool)
            or raw < 0 or raw > 999999999):
        return {"ok": False,
                "error": "保存インデクスは 0 以上の整数で指定してください。"}
    _store_save_index(raw)
    return {"ok": True, "error": None}


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
                "source": _editor_source_view("source_image")}

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

    # A PNG's embedded positive prompt (WebUI infotext) is taken
    # into the record so the upload list can show it.
    prompt = _extract_png_prompt(data) if ext == "png" else None

    with _DB_LOCK:
        conn = _db()
        try:
            cur = conn.execute(
                "INSERT INTO upload_images (file_name, stored_name, "
                "mime_type, byte_size, host_path, image_key, display_key, "
                "prompt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (args.get("fileName") or "", stored_name, mime,
                 len(data), host_path, image_key, display_key, prompt,
                 _now_iso()),
            )
            upload_id = cur.lastrowid
            conn.commit()
        finally:
            conn.close()
    _set_editor_source("upload", upload_id=upload_id,
                       table="source_image")
    return {"ok": True, "error": None,
            "source": _editor_source_view("source_image")}


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
    img_src = _load_editor_source("source_image")
    if (img_src and img_src["kind"] == "upload"
            and img_src["upload_id"] == upload["id"]):
        _clear_editor_source("source_image")
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
    counter = _index_from_args(args)
    with _DB_LOCK:
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
        _store_save_index(counter)
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


def _act_get_source_image(args):
    return {"source": _editor_source_view("source_image")}


def _act_adopt_editor_source(args):
    src = _load_editor_source()
    if not src:
        return {"ok": False,
                "error": "画像エリアに画像がありません。",
                "source": _editor_source_view("source_image")}
    _set_editor_source(src["kind"], job_id=src["job_id"],
                       upload_id=src["upload_id"], table="source_image")
    return {"ok": True, "error": None,
            "source": _editor_source_view("source_image")}


def _act_clear_source_image(args):
    _clear_editor_source("source_image")
    return {"ok": True, "error": None,
            "source": _editor_source_view("source_image")}


def _act_create_job(args):
    _sweep_timeouts()
    # Payload passthrough: the client composes the complete sdapi
    # payload and the worker hands it to the API verbatim — no
    # composition, no fixed inpaint values, no guardrails on this
    # side. The only requirement here is transport shape.
    payload = args.get("payload")
    if not isinstance(payload, dict):
        return {"ok": False, "jobId": None,
                "error": "payload が必要です。"}

    now = _now_iso()
    with _DB_LOCK:
        conn = _db()
        try:
            cur = conn.execute(
                "INSERT INTO jobs (kind, status, phase, phase_updated_at, "
                "model, prompt, negative_prompt, width, "
                "height, seed_mode, seed_input, steps, cfg, sampler, "
                "scheduler, mode, denoising_strength, resize_mode, created_at, "
                "updated_at) VALUES ('generate', 'running', "
                "'agent_starting', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "
                "?, ?, ?, ?)",
                (
                    now,
                    args.get("model"), args.get("prompt"),
                    args.get("negativePrompt"),
                    args.get("width"), args.get("height"),
                    args.get("seedMode"), args.get("seed"),
                    args.get("steps"), args.get("cfg"),
                    args.get("sampler"), args.get("scheduler"),
                    args.get("mode") or "txt2img",
                    args.get("denoisingStrength"),
                    args.get("resizeMode"),
                    now, now,
                ),
            )
            job_id = cur.lastrowid
            conn.commit()
        finally:
            conn.close()

    try:
        _learn_from_prompt(args.get("prompt") or "")
    except Exception:  # noqa: BLE001 - learning must not block generation
        pass

    _start_generation(job_id, payload)
    return {"ok": True, "jobId": job_id, "error": None}


def _act_create_edited_job(args):
    """画像加工の保存： bake the processing pane's adjustments
    (brightness / saturation / contrast, -100..100 percent) into
    the source image with PIL and record the result as a new
    completed job, which becomes the Editor's image — the same
    end state as a finished generation, without a generation.
    The factors are 1 + v/100 applied in brightness, contrast,
    color order, matching the pane's CSS filter preview."""
    def _fail(msg):
        return {"ok": False, "jobId": None, "error": msg}

    def _pct(name):
        try:
            v = int(round(float(args.get(name) or 0)))
        except (TypeError, ValueError):
            v = 0
        return max(-100, min(100, v))

    brightness = _pct("brightness")
    saturation = _pct("saturation")
    contrast = _pct("contrast")
    source_kind = args.get("sourceKind")
    src_job = None
    src_upload = None
    conn = _db()
    try:
        if source_kind == "job":
            row = conn.execute(
                "SELECT * FROM jobs WHERE id = ?",
                (args.get("jobId"),)).fetchone()
            if row is None or not row["image_key"]:
                return _fail("加工元の生成画像が見つかりません。")
            src_job = dict(row)
            image_key = src_job["image_key"]
        elif source_kind == "upload":
            row = conn.execute(
                "SELECT * FROM upload_images WHERE id = ?",
                (args.get("uploadId"),)).fetchone()
            if row is None:
                return _fail("加工元のアップロード画像が見つかりません。")
            src_upload = dict(row)
            image_key = f"uploads/{src_upload['stored_name']}"
        else:
            return _fail("加工元の画像が指定されていません。")
    finally:
        conn.close()

    path = _file_path(image_key)
    if not path or not os.path.isfile(path):
        return _fail("加工元の画像ファイルが見つかりません。")
    try:
        with open(path, "rb") as f:
            src_bytes = f.read()
        from PIL import Image, ImageEnhance
        img = Image.open(io.BytesIO(src_bytes)).convert("RGB")
        if brightness != 0:
            img = ImageEnhance.Brightness(img).enhance(1 + brightness / 100)
        if contrast != 0:
            img = ImageEnhance.Contrast(img).enhance(1 + contrast / 100)
        if saturation != 0:
            img = ImageEnhance.Color(img).enhance(1 + saturation / 100)
        out = io.BytesIO()
        img.save(out, "PNG")
        png_bytes = out.getvalue()
        width, height = img.size
    except Exception as e:  # noqa: BLE001 - surfaced to the client
        return _fail(f"画像の加工に失敗しました: {e}"[:800])

    now = _now_iso()
    with _DB_LOCK:
        conn = _db()
        try:
            cur = conn.execute(
                "INSERT INTO jobs (kind, status, phase, phase_updated_at, "
                "model, prompt, negative_prompt, width, "
                "height, seed_mode, seed_input, steps, cfg, sampler, "
                "scheduler, mode, denoising_strength, resize_mode, created_at, "
                "updated_at) VALUES ('generate', 'running', "
                "'saving', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "
                "?, ?, ?, ?)",
                (
                    now,
                    src_job["model"] if src_job else None,
                    (src_job["prompt"] if src_job
                     else src_upload["prompt"]),
                    src_job["negative_prompt"] if src_job else None,
                    width, height,
                    src_job["seed_mode"] if src_job else None,
                    src_job["seed_input"] if src_job else None,
                    src_job["steps"] if src_job else None,
                    src_job["cfg"] if src_job else None,
                    src_job["sampler"] if src_job else None,
                    src_job["scheduler"] if src_job else None,
                    src_job["mode"] if src_job else "txt2img",
                    None, None,
                    now, now,
                ),
            )
            job_id = cur.lastrowid
            conn.commit()
        finally:
            conn.close()

    image_key = f"jobs/{job_id}.png"
    host_path = _write_file(image_key, png_bytes)
    display_key = None
    display = _make_display_jpeg(png_bytes)
    if display:
        display_key = f"jobs/{job_id}.display.jpg"
        _write_file(display_key, display)
    used_params = {
        "edited": True,
        "sourceKind": source_kind,
        "sourceJobId": src_job["id"] if src_job else None,
        "sourceUploadId": src_upload["id"] if src_upload else None,
        "brightness": brightness,
        "saturation": saturation,
        "contrast": contrast,
    }
    _update_job(
        job_id,
        status="completed",
        phase=None,
        result_seed=src_job["result_seed"] if src_job else None,
        image_key=image_key,
        display_key=display_key,
        host_path=host_path,
        used_params=json.dumps(used_params, ensure_ascii=False),
        error=None,
    )
    try:
        _set_editor_source("job", job_id=job_id)
    except Exception:  # noqa: BLE001 - the job itself is recorded
        pass
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
    img_src = _load_editor_source("source_image")
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
                if (img_src and img_src["kind"] == "job"
                        and img_src["job_id"] == int(job_id)):
                    conn.execute(
                        "DELETE FROM source_image WHERE id = 1")
                    img_src = None
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
    counter = _index_from_args(args)
    with _DB_LOCK:
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
        _store_save_index(counter)
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
    "getWordDictionary": _act_get_word_dictionary,
    "getTextSnippets": _act_get_text_snippets,
    "saveTextSnippets": _act_save_text_snippets,
    "getWorkspaceState": _act_get_workspace_state,
    "setSaveIndex": _act_set_save_index,
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
    "getSourceImage": _act_get_source_image,
    "adoptEditorSource": _act_adopt_editor_source,
    "clearSourceImage": _act_clear_source_image,
    "createJob": _act_create_job,
    "createEditedJob": _act_create_edited_job,
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
    from fastapi.concurrency import run_in_threadpool
    from fastapi.responses import FileResponse, JSONResponse

    _STATE["root"] = extension_root
    _STATE["data_dir"] = os.path.join(extension_root, "workbench-data")
    _STATE["db_path"] = os.path.join(_STATE["data_dir"], "workbench.db")
    os.makedirs(_STATE["data_dir"], exist_ok=True)
    _init_db()

    @app.post("/mobileplus/api/{action}")
    async def workbench_api(action: str, request: Request):
        try:
            args = await request.json()
        except Exception:  # noqa: BLE001
            return JSONResponse({"error": "invalid JSON body"},
                                status_code=400)
        if not isinstance(args, dict):
            return JSONResponse({"error": "invalid JSON body"},
                                status_code=400)
        handler = ACTIONS.get(action)
        if handler is None:
            return JSONResponse(
                {"error": f"unknown action: {action}"}, status_code=404)
        try:
            # The handlers are blocking (SQLite, file IO, and —
            # for pollGenerationJob — a loopback HTTP read of the
            # WebUI's own progress endpoint). Running one directly
            # on the event loop deadlocks that read: the loop is
            # busy waiting for a response only it can serve, so
            # the fetch always timed out and progress never
            # reached the client. Dispatch in the threadpool.
            result = await run_in_threadpool(handler, args)
            # The client reads the result JSON directly; failures
            # are a non-2xx status with {"error": str} (below).
            return JSONResponse(result)
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
