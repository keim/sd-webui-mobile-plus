from modules import script_callbacks
import gradio as gr

def on_ui_tabs():
    with gr.Blocks() as interface:
        gr.Markdown("## Smartphone Plus")
        gr.Markdown("Customize WebUI for Smartphone. Available only when the client width < 768px.")
        gr.HTML("""
<div id="sd-smartphone-plus-panel" class="">
    <div class="sspp-panel-column">
        <button id="sspp-prevword" class="helper">prev</button>
        <button id="sspp-currword" class="helper">word</button>
        <button id="sspp-nextword" class="helper">next</button>
        <button id="sspp-ratedown" class="helper">-0.05</button>
        <button id="sspp-rateup"   class="helper">+0.05</button>
    </div>
    <div class="sspp-panel-column">
        <button id="sspp-inject-css" class="">
            <span class="sspp-button-label-off">InjectCSS</span>
            <span class="sspp-button-label-on">ExtractCSS</span>
        </button>
        <button id="sspp-nega-prompt" class="operator">
            <span class="sspp-button-label">Negative</span>
        </button>
        <button id="sspp-config" class="operator">
            <span class="sspp-button-label">Props</span>
        </button>
        <button id="sspp-size" class="operator">
            <span class="sspp-button-label">Size</span>
        </button>
        <div id="sspp-size-selector" class="selector">
            <button class="selector-item" onclick="sspp_setSize(1440, 810)">1440x810 (16:9)</button>
            <button class="selector-item" onclick="sspp_setSize(1440, 960)">1440x960 (3:2)</button>
            <button class="selector-item" onclick="sspp_setSize(1440, 1080)">1440x1080 (4:3)</button>
            <button class="selector-item" onclick="sspp_setSize(1280, 1280)">1280x1280 (1:1)</button>
            <button class="selector-item" onclick="sspp_setSize(1080, 1440)">1080x1440 (3:4)</button>
            <button class="selector-item" onclick="sspp_setSize(960, 1440)">960x1440 (2:3)</button>
            <button class="selector-item" onclick="sspp_setSize(810, 1440)">810x1440 (9:16)</button>
        </div>
    </div>
</div>
        """)
        
        interface.load(
            fn=None, 
            inputs=None, 
            outputs=None, 
            _js="insertPanel"
        )
    
    return [(interface, "SP+", "smartphone_plus")]

script_callbacks.on_ui_tabs(on_ui_tabs)
