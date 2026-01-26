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

        # Hidden elements to store API key and prompt history
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
        
        if not parameters:
            return None
        
        result = {
            'positive_prompt': '',
            'negative_prompt': '',
            'width': width,
            'height': height,
            'steps': None,
            'sampler': None,
            'cfg_scale': None,
            'seed': None,
            'size': f"{width}x{height}",
            'model_hash': None,
            'model': None,
            'denoising_strength': None,
            'clip_skip': None,
            'ensd': None,
            'version': None,
            'hires_upscale': None,
            'hires_steps': None,
            'hires_upscaler': None,
            'vae': None,
            'vae_hash': None,
            'lora_hashes': None,
            'ti_hashes': None,
            'schedule_type': None,
            'schedule_rho': None,
            'sgm_noise_multiplier': None,
            'all_params_text': parameters  # Store original parameters text
        }
        
        # Extract positive prompt (everything before "Negative prompt:")
        if "Negative prompt:" in parameters:
            parts = parameters.split("Negative prompt:", 1)
            result['positive_prompt'] = parts[0].strip()
            
            # Extract negative prompt and other parameters
            remaining = parts[1]
            if "\nSteps:" in remaining:
                negative_and_params = remaining.split("\nSteps:", 1)
                result['negative_prompt'] = negative_and_params[0].strip()
                params_text = "Steps:" + negative_and_params[1]
            else:
                # Try other common parameter markers
                param_markers = ["\nSampler:", "\nCFG scale:", "\nSeed:", "\nSize:"]
                found_marker = False
                for marker in param_markers:
                    if marker in remaining:
                        negative_and_params = remaining.split(marker, 1)
                        result['negative_prompt'] = negative_and_params[0].strip()
                        params_text = marker.strip() + ":" + negative_and_params[1]
                        found_marker = True
                        break
                if not found_marker:
                    result['negative_prompt'] = remaining.strip()
                    params_text = ""
        else:
            # No negative prompt section
            if "\nSteps:" in parameters:
                parts = parameters.split("\nSteps:", 1)
                result['positive_prompt'] = parts[0].strip()
                params_text = "Steps:" + parts[1]
            else:
                result['positive_prompt'] = parameters.strip()
                params_text = ""
        
        # Parse all parameters from the params_text
        if params_text:
            # Split by comma, but be careful with nested structures
            param_pairs = []
            current_pair = ""
            paren_depth = 0
            bracket_depth = 0
            
            for char in params_text:
                if char == '(':
                    paren_depth += 1
                elif char == ')':
                    paren_depth -= 1
                elif char == '[':
                    bracket_depth += 1
                elif char == ']':
                    bracket_depth -= 1
                elif char == ',' and paren_depth == 0 and bracket_depth == 0:
                    param_pairs.append(current_pair.strip())
                    current_pair = ""
                    continue
                current_pair += char
            
            if current_pair.strip():
                param_pairs.append(current_pair.strip())
            
            # Parse each parameter pair
            for pair in param_pairs:
                if ':' not in pair:
                    continue
                
                key, value = pair.split(':', 1)
                key = key.strip().lower().replace(' ', '_')
                value = value.strip()
                
                # Remove quotes if present
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                
                # Map to result dictionary
                if key == 'steps':
                    result['steps'] = int(value) if value.isdigit() else value
                elif key == 'sampler':
                    result['sampler'] = value
                elif key == 'cfg_scale':
                    try:
                        result['cfg_scale'] = float(value)
                    except ValueError:
                        result['cfg_scale'] = value
                elif key == 'seed':
                    result['seed'] = int(value) if value.isdigit() else value
                elif key == 'size':
                    result['size'] = value
                elif key == 'model_hash':
                    result['model_hash'] = value
                elif key == 'model':
                    result['model'] = value
                elif key == 'denoising_strength':
                    try:
                        result['denoising_strength'] = float(value)
                    except ValueError:
                        result['denoising_strength'] = value
                elif key == 'clip_skip':
                    result['clip_skip'] = int(value) if value.isdigit() else value
                elif key == 'ensd':
                    result['ensd'] = value
                elif key == 'version':
                    result['version'] = value
                elif key == 'hires_upscale':
                    try:
                        result['hires_upscale'] = float(value)
                    except ValueError:
                        result['hires_upscale'] = value
                elif key == 'hires_steps':
                    result['hires_steps'] = int(value) if value.isdigit() else value
                elif key == 'hires_upscaler':
                    result['hires_upscaler'] = value
                elif key == 'vae':
                    result['vae'] = value
                elif key == 'vae_hash':
                    result['vae_hash'] = value
                elif key == 'lora_hashes':
                    result['lora_hashes'] = value
                elif key == 'ti_hashes':
                    result['ti_hashes'] = value
                elif key == 'schedule_type':
                    result['schedule_type'] = value
                elif key == 'schedule_rho':
                    try:
                        result['schedule_rho'] = float(value)
                    except ValueError:
                        result['schedule_rho'] = value
                elif key == 'sgm_noise_multiplier':
                    try:
                        result['sgm_noise_multiplier'] = float(value)
                    except ValueError:
                        result['sgm_noise_multiplier'] = value
                else:
                    # Store any unknown parameters
                    result[key] = value
        
        return result
        
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
            posiprompt = re.sub(r'[ \t\u3000]+', ' ', pnginfo['positive_prompt'].strip())
            negaprompt = re.sub(r'[ \t\u3000]+', ' ', pnginfo['negative_prompt'].strip())
            seen_prompt = posiprompt + negaprompt
            if seen_prompt and seen_prompt not in seen_prompts:
                prompts.append([url, posiprompt, negaprompt, pnginfo['width'], pnginfo['height']])
                seen_prompts.add(seen_prompt)
    
    print(f"[Mobile+] Extracted {len(prompts)} prompts from latest images")
    return prompts

def get_images_from_directory(dir_path: str, start: int = 0, count: int = 50) -> dict:
    try:
        webui_root = os.getcwd()
        full_dir = os.path.join(webui_root, dir_path)

        if not os.path.exists(full_dir):
            print(f"[Mobile+] Image directory not found: {full_dir}")
            return {"success": False, "images": [], "message": "Directory not found"}
        
        # Get all PNG files sorted by modification time (newest first)
        search_pattern = os.path.join(full_dir, "**", "*.png")
        image_files = glob.glob(search_pattern, recursive=True)
        image_files.sort(key=os.path.getmtime, reverse=True)

        images = []
        # query parameter で指定されたstartから開始してcount数だけ処理
        for image_path in image_files[start:start + count]:
            pnginfo = extract_pnginfo(image_path)
            
            if pnginfo:
                # convert image_path to image url link (relative to webui root) and URL-encode
                rel_path = os.path.relpath(image_path, webui_root).replace(os.sep, '/')
                url = f"/file={quote(rel_path)}"
                
                # Create image data with all parameters
                image_data = {
                    "url": url,
                    "positive_prompt": pnginfo['positive_prompt'].strip(),
                    "negative_prompt": pnginfo['negative_prompt'].strip(),
                    "width": pnginfo['width'],
                    "height": pnginfo['height'],
                    "size": pnginfo['size'],
                    "steps": pnginfo['steps'],
                    "sampler": pnginfo['sampler'],
                    "cfg_scale": pnginfo['cfg_scale'],
                    "seed": pnginfo['seed'],
                    "model": pnginfo['model'],
                    "model_hash": pnginfo['model_hash'],
                    "denoising_strength": pnginfo['denoising_strength'],
                    "clip_skip": pnginfo['clip_skip'],
                    "ensd": pnginfo['ensd'],
                    "version": pnginfo['version'],
                    "hires_upscale": pnginfo['hires_upscale'],
                    "hires_steps": pnginfo['hires_steps'],
                    "hires_upscaler": pnginfo['hires_upscaler'],
                    "vae": pnginfo['vae'],
                    "vae_hash": pnginfo['vae_hash'],
                    "lora_hashes": pnginfo['lora_hashes'],
                    "ti_hashes": pnginfo['ti_hashes'],
                    "schedule_type": pnginfo['schedule_type'],
                    "schedule_rho": pnginfo['schedule_rho'],
                    "sgm_noise_multiplier": pnginfo['sgm_noise_multiplier']
                }
                
                # Add any additional unknown parameters
                for key, value in pnginfo.items():
                    if key not in image_data and key != 'all_params_text':
                        image_data[key] = value
                
                images.append(image_data)

        return {
            "success": True, 
            "images": images,
            "total": len(images),
            "start": start,
            "count": count
        }
    except Exception as e:
        print(f"[Mobile+] Error in get_images_from_directory: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "images": [], "message": str(e)}


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


print("[Mobile+] Mobile+ extension loaded.")
