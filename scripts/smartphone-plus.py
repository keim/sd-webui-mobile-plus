from modules import script_callbacks
import gradio as gr

def on_ui_tabs():
    with gr.Blocks() as interface:
        gr.Markdown("## Smartphone Plus")
        gr.Markdown("Customize WebUI for Smartphone. Available only when the client width < 768px.")
        gr.HTML("""
<div id="sd-smartphone-plus-panel" class="sspp-panel">
    <div class="sspp-panel-column">
        <button id="sspp-generate" class="helper">Generate</button>
    </div>
    <div class="sspp-panel-column">
        <button id="sspp-prevword" class="helper">prev</button>
        <button id="sspp-currword" class="helper">select</button>
        <button id="sspp-nextword" class="helper">next</button>
        <button id="sspp-parentheses" class="helper">emph</button>
        <button id="sspp-ratedown" class="helper">-0.1</button>
        <button id="sspp-rateup"   class="helper">+0.1</button>
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
        <button id="sspp-clip" class="operator">
            <span class="sspp-button-label">Clip</span>
        </button>
        <div id="sspp-size-selector" class="selector">
            <div class="selector-item" index="1">
                <button class="selector-item-label" onclick="sspp_selectSize" />
                <button class="selector-item-button" onclick="sspp_removeSize" />
            </div>
            <div class="selector-item">
                <input type="text" placeholder="name"/>
                <input type="number" min="64" max="2048" step="32" placeholder="width"/>
                <input type="number" min="64" max="2048" step="32" placeholder="height"/>
                <button id="sspp-size-register" class="selector-item-button" onclick="sspp_newSize"/>
            </div>
            <div class="sspp-selector-background" onclick="sspp_closeSelector"></div>
        </div>
        <div id="sspp-clip-selector" class="selector">
            <div class="selector-item" index="1">
                <button class="selector-item-label" onclick="sspp_selectClip" />
                <button class="selector-item-button" onclick="sspp_removeClip" />
            </div>
            <button class="selector-item" onclick="sspp_newClip">+</button>
            <div class="sspp-selector-background" onclick="sspp_closeSelector"></div>
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
