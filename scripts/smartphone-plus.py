from modules import script_callbacks, shared
import gradio as gr

def on_ui_settings():
    section = ("smartphone_plus", "SP+");
    shared.opts.add_option(
        "gemini_api_key",
        shared.OptionInfo( "", "Gemini API Key", section = section ))

script_callbacks.on_ui_settings(on_ui_settings)

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
                <button class="selector-item-label" onclick="sspp_selectSize(this)" />
                <button class="sspp-close selector-item-button" onclick="sspp_removeSize(this)" />
            </div>
            <div class="selector-item" id="sspp-size-new-item">
                <input type="text" placeholder="name"/>
                <input type="number" min="64" max="2048" step="32" placeholder="width"/>
                <input type="number" min="64" max="2048" step="32" placeholder="height"/>
                <button id="sspp-size-register" class="selector-item-button" onclick="sspp_newSize(this)"/>
            </div>
            <div class="sspp-selector-background" onclick="sspp_closeSelector(this)"></div>
        </div>
        <div id="sspp-clip-selector" class="selector">
            <div class="selector-item" index="1">
                <button class="selector-item-label" onclick="sspp_selectClip(this)" />
                <button class="sspp-close selector-item-button" onclick="sspp_removeClip(this)" />
            </div>
            <div class="selector-item" id="sspp-clip-new-item">
                <input type="text" placeholder="name"/>
                <button id="sspp-size-register" class="selector-item-button" onclick="sspp_newClip(this)"/>
            </div>
            <div class="sspp-selector-background" onclick="sspp_closeSelector(this)"></div>
        </div>
    </div>
</div>
        """)

        gr.Textbox(
            value = lambda: shared.opts.gemini_api_key,
            visible = False,
            elem_id = "sspp_gemini_api_key"
        )

        interface.load(
            fn=None, 
            inputs=None, 
            outputs=None, 
            _js="insertPanel"
        )
    
    return [(interface, "SP+", "smartphone_plus")]

script_callbacks.on_ui_tabs(on_ui_tabs)
