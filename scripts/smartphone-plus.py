from modules import script_callbacks
import gradio as gr

def on_ui_tabs():
    with gr.Blocks() as interface:
        gr.Markdown("## Smartphone Plus")
        gr.Markdown("Customize WebUI for Smartphone. Available only when the client width < 768px.")
        gr.HTML("""
<div id="sd-smartphone-plus-panel" class="">
    <button id="sspp-inject-css" class="">
        <span class="sspp-button-label-off">Inject CSS</span>
        <span class="sspp-button-label-on">Extract CSS</span>
    </button>
    <button id="sspp-setting" class="operator">
        <span class="sspp-button-label">Setting</span>
    </button>
    <button id="sspp-nega-prompt" class="operator">
        <span class="sspp-button-label">Negative</span>
    </button>
    <button id="sspp-sampling" class="operator">
        <span class="sspp-button-label">Sampling</span>
    </button>
    <button id="sspp-size" class="operator">
        <span class="sspp-button-label">Size</span>
    </button>
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
