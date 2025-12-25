from modules import script_callbacks, shared
from PIL import Image
import gradio as gr
import os
import glob
import re
import json


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


IMAGE_DIR = "outputs/txt2img-images"
MAX_IMAGES = 300

def extract_posi_prompt_from_png(image_path):
    try:
        img = Image.open(image_path)
        parameters = img.info.get('parameters')
        if parameters:
            # Extract positive prompt (everything before "Negative prompt:")
            if "Negative prompt:" in parameters:
                positive_prompt = parameters.split("Negative prompt:")[0].strip()
            else:
                # If no negative prompt section, split at Steps: or other parameters
                if "\nSteps:" in parameters:
                    positive_prompt = parameters.split("\nSteps:")[0].strip()
                else:
                    positive_prompt = parameters.strip()
            return positive_prompt
        return None
    except Exception as e:
        print(f"[Mobile+] Error processing {image_path}: {e}")
        return None

def process_latest_images():
    webui_root = os.getcwd()
    full_image_dir = os.path.join(webui_root, IMAGE_DIR)
    
    if not os.path.exists(full_image_dir):
        print(f"[Mobile+] Image directory not found: {full_image_dir}")
        return []
    
    # Get all PNG files sorted by modification time (newest first)
    search_pattern = os.path.join(full_image_dir, "**", "*.png")
    image_files = glob.glob(search_pattern, recursive=True)
    image_files.sort(key=os.path.getmtime, reverse=True)
    
    # Process only the latest MAX_IMAGES
    prompts = []
    for image_path in image_files[:MAX_IMAGES]:
        prompt = extract_posi_prompt_from_png(image_path)
        if prompt:
            # Trim whitespace, replace consecutive whitespace (including full-width) with single space, and avoid duplicates
            prompt = re.sub(r'[\s\u3000]+', ' ', prompt.strip())
            if prompt and prompt not in prompts:
                prompts.append(prompt)
    
    print(f"[Mobile+] Extracted {len(prompts)} prompts from latest images")
    return prompts
