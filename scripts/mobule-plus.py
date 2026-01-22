from modules import script_callbacks, shared, api
from modules.api import models
from PIL import Image
import gradio as gr
import os
import glob
import re
import json
from urllib.parse import quote
from fastapi import FastAPI, HTTPException, Query


def on_ui_settings():
    section = ("mobile_plus", "Mobile+");
    shared.opts.add_option(
        "gemini_api_key",
        shared.OptionInfo( "", "Gemini API Key", section = section ))

script_callbacks.on_ui_settings(on_ui_settings)


def on_ui_tabs():
    # Load HTML panel from external file
    panel_html_path = os.path.join(os.path.dirname(__file__), "panel.html")
    with open(panel_html_path, "r", encoding="utf-8") as f:
        panel_html = f.read()
    
    # Process latest images and extract prompts
    def get_prompt_history():
        prompts = process_latest_images()
        return json.dumps(prompts, ensure_ascii=False)
    
    with gr.Blocks() as interface:
        gr.Markdown("## Mobile Plus")
        gr.Markdown("Customize WebUI for mobile devices. Available only when the client width < 768px.")
        gr.HTML(panel_html)

        gr.Textbox(
            value = lambda: shared.opts.gemini_api_key,
            visible = False,
            elem_id = "sspp_gemini_api_key"
        )
        
        gr.Textbox(
            value = get_prompt_history,
            visible = False,
            elem_id = "sspp_prompt_history"
        )

        interface.load(
            fn=None, 
            inputs=None, 
            outputs=None, 
            _js="insertPanel"
        )
    
    return [(interface, "Mobile+", "mobile_plus")]

script_callbacks.on_ui_tabs(on_ui_tabs)


MAX_IMAGES = 500

def extract_pnginfo(image_path):
    try:
        img = Image.open(image_path)
        parameters = img.info.get('parameters')
        width, height = img.size
        if parameters:
            # Extract positive prompt (everything before "Negative prompt:")
            if "Negative prompt:" in parameters:
                prompts = parameters.split("Negative prompt:")
                positive_prompt = prompts[0].strip()
                if "\nSteps:" in prompts[1]:
                    negative_prompt = prompts[1].split("\nSteps:")[0].strip()
                else:
                    negative_prompt = prompts[1].strip()
            else:
                negative_prompt = ""
                # If no negative prompt section, split at Steps: or other parameters
                if "\nSteps:" in parameters:
                    positive_prompt = parameters.split("\nSteps:")[0].strip()
                else:
                    positive_prompt = parameters.strip()
            return [positive_prompt, negative_prompt, width, height]
        return None
    except Exception as e:
        print(f"[Mobile+] Error processing {image_path}: {e}")
        return None

def process_latest_images():
    webui_root = os.getcwd()
    full_image_dir = os.path.join(webui_root, shared.opts.outdir_save)

    if not os.path.exists(full_image_dir):
        print(f"[Mobile+] Image directory not found: {full_image_dir}")
        return []
    
    # Get all PNG files sorted by modification time (newest first)
    search_pattern = os.path.join(full_image_dir, "**", "*.png")
    image_files = glob.glob(search_pattern, recursive=True)
    image_files.sort(key=os.path.getmtime, reverse=True)
    
    # Process only the latest MAX_IMAGES
    prompts = []
    seen_prompts = set()
    for image_path in image_files[:MAX_IMAGES]:
        pnginfo = extract_pnginfo(image_path)
        # convert image_path to image url link (relative to webui root) and URL-encode
        rel_path = os.path.relpath(image_path, webui_root).replace(os.sep, '/')
        url = f"/file={quote(rel_path)}"

        if pnginfo:
            # Trim whitespace, replace consecutive whitespace (including full-width) with single space, and avoid duplicates
            posiprompt = re.sub(r'[ \t\u3000]+', ' ', pnginfo[0].strip())
            negaprompt = re.sub(r'[ \t\u3000]+', ' ', pnginfo[1].strip())
            seen_prompt = posiprompt + negaprompt
            if seen_prompt and seen_prompt not in seen_prompts:
                prompts.append([url, posiprompt, negaprompt, pnginfo[2], pnginfo[3]])
                seen_prompts.add(seen_prompt)
    
    print(f"[Mobile+] Extracted {len(prompts)} prompts from latest images")
    return prompts


def get_images_from_directory(dir_path: str, start: int = 0, count: int = 50) -> dict:
    # 共通関数：指定ディレクトリから画像ファイルを取得してプロンプト情報を抽出
    try:
        webui_root = os.getcwd()
        full_dir = os.path.join(webui_root, dir_path)

        if not os.path.exists(full_dir):
            print(f"[Mobile+] Image directory not found: {full_dir}")
            return {"success": False, "prompts": []}
        
        # Get all PNG files sorted by modification time (newest first)
        search_pattern = os.path.join(full_dir, "**", "*.png")
        image_files = glob.glob(search_pattern, recursive=True)
        image_files.sort(key=os.path.getmtime, reverse=True)

        prompts = []
        # query parameter で指定されたstartから開始してcount数だけ処理
        for image_path in image_files[start:start + count]:
            pnginfo = extract_pnginfo(image_path)
            # convert image_path to image url link (relative to webui root) and URL-encode
            rel_path = os.path.relpath(image_path, webui_root).replace(os.sep, '/')
            url = f"/file={quote(rel_path)}"

            if pnginfo:
                # Trim whitespace and avoid duplicates
                posiprompt = pnginfo[0].strip()
                negaprompt = pnginfo[1].strip()
                prompts.append([url, posiprompt, negaprompt, pnginfo[2], pnginfo[3]])

        return {"success": True, "prompts": prompts}
    except Exception as e:
        print(f"[Mobile+] Error in get_images_from_directory: {e}")
        return {"success": False, "prompts": []}


# API routes
def on_app_started(demo, app: FastAPI):
    @app.get("/api/mobile-plus/txt2img")
    async def txt2img(start: int = Query(0, ge=0), count: int = Query(50, ge=1, le=500)):
        result = get_images_from_directory(shared.opts.outdir_txt2img_samples, start, count)
        return result
    
    @app.get("/api/mobile-plus/img2img")
    async def img2img(start: int = Query(0, ge=0), count: int = Query(50, ge=1, le=500)):
        result = get_images_from_directory(shared.opts.outdir_img2img_samples, start, count)
        return result
    
    @app.get("/api/mobile-plus/outdir")
    async def outdir(start: int = Query(0, ge=0), count: int = Query(50, ge=1, le=500)):
        result = get_images_from_directory(shared.opts.outdir_save, start, count)
        return result
script_callbacks.on_app_started(on_app_started)
