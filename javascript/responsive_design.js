// 画面上部のInjectパネルの表示/非表示を切り替える
async function insertPanel() {
    await _initialize();

    ssppUI.updateSizeLabel();
    sspp_clipSelector.refresh();
    sspp_candOps.updateCandidateButtons("__first__");

    console.log("Mobile+: Responsive design CSS injector has been loaded.");
}

// グローバル変数
let geminiapi = null;
let ssppUI = null;
let sspp_sizeSelector = null;
let sspp_textSelector = null;
let sspp_clipSelector = null;
let sspp_candOps = null;
let sspp_wordOps = null;
let _moduleLoadPromise = null;
const _moduleCacheKey = `${Date.now()}`;

window.insertPanel = insertPanel;




// 初期化処理
async function _initialize() {
    await _loadModules();

    ssppUI.initialize();
    sspp_sizeSelector.initialize();
    sspp_textSelector.initialize();
    sspp_clipSelector.initialize();

    ssppUI.addSafeEventListener("textarea", "keyup", () => sspp_candOps.show());

    _initWordDictionary();
    _setupMenuButtons();
    _setupFullscreenRestore();
    _insertInteractiveWidget();
}

// モジュールの動的インポートと初期化
async function _loadModules() {
    if (_moduleLoadPromise) return _moduleLoadPromise;

    const cachePath = (path) => `${path}?v=${encodeURIComponent(_moduleCacheKey)}`;

    _moduleLoadPromise = Promise.all([
        import(cachePath("./modules/sd_generated_image.js")),
        import(cachePath("./modules/file_info_api.js")),
        import(cachePath("./modules/ui_controller.js")),
        import(cachePath("./modules/size_selector.js")),
        import(cachePath("./modules/text_selector.js")),
        import(cachePath("./modules/clipboard_selector.js")),
        import(cachePath("./modules/candidate_operations.js")),
        import(cachePath("./modules/word_operations.js")),
        import(cachePath("./modules/geminiapi.js")),
    ])
        .then(
            ([imageModule, fileInfoModule, uiModule, sizeModule, textModule, clipboardModule, candidateModule, wordModule, geminiModule]) => {
                const fileInfoAPI = fileInfoModule.FileInfoAPI;
                fileInfoAPI.setImageClass(imageModule.SDGeneratedImage);

                ssppUI = new uiModule.UIController(fileInfoAPI);
                sspp_wordOps = new wordModule.WordOperations(ssppUI);
                sspp_candOps = new candidateModule.CandidateOperations(ssppUI);
                sspp_sizeSelector = new sizeModule.SizeSelector(ssppUI);
                sspp_textSelector = new textModule.TextSelector(ssppUI);
                sspp_clipSelector = new clipboardModule.ClipboardSelector(ssppUI, fileInfoAPI);
                geminiapi = geminiModule.geminiapi();
            }
        )
        .catch((err) => {
            _moduleLoadPromise = null;
            console.error("[Mobile+] Failed to load modules:", err);
            throw err;
        });

    return _moduleLoadPromise;
}

// 辞書初期化
function _initWordDictionary() {
    const historyList = ssppUI.getPromptHistory();
    sspp_candOps._wordDictionary['__first__'] = {};
    historyList.reverse().forEach(([url, posi, nega]) => {
        sspp_candOps.appendWordDictionaryByPrompt(posi)
    });
}

// メニューボタンのセットアップ
function _setupMenuButtons() {
    // パネルにボタンを追加するユーティリティ関数
    const onclick = (id, onClick) => {
        document.getElementById(id).addEventListener('click', onClick);
    }

    const panel = ssppUI.panel();
    
    // CSS Injection ボタン
    onclick('sspp-inject-css', () => {
        ssppUI.togglePanel(_sspp_toggleResponsiveCSS(true));
    });
    onclick('sspp-inject-css-full', () => {
        ssppUI.togglePanel(_sspp_toggleResponsiveCSS(true));
        document.body.requestFullscreen();
    });
    // CSS Extraction ボタン
    onclick('sspp-extract-css', () => {
        ssppUI.togglePanel(_sspp_toggleResponsiveCSS(false));
        if (document.fullscreenElement) document.exitFullscreen();
    });

    // [Negative Prompt]
    onclick('sspp-switch-nega', e => {
        ssppUI.changePanelUIType("nega");
    });
    // [Rendering Props]
    onclick('sspp-switch-rendering', e => {
        ssppUI.changePanelUIType("rendering");
    });
    // [Sampling Props]
    onclick('sspp-switch-sampling', e => {
        ssppUI.changePanelUIType("sampling");
    });
    // [Batch Props]
    onclick('sspp-switch-batch', e => {
        ssppUI.changePanelUIType("batch");
    });
    // [Menu]
    onclick('sspp-submenu-open', e => {
        ssppUI.changePanelUIType("submenu");
        ssppUI.updateSizeLabel();
    });

    // [Checkpoint selector]
    onclick('sspp-checkpoints', e => {
        ssppUI.changePanelUIType("checkpoints");
    });
    // [Lora selector]
    onclick('sspp-lora', e => {
        ssppUI.changePanelUIType("lora");
    });
    // [Size selector]
    onclick('sspp-size', e => {
        ssppUI.changePanelUIType("size");
    });
    // [text snippet selector]
    onclick('sspp-textsnippet', e => {
        ssppUI.changePanelUIType("textsnippet");
        sspp_textSelector?.updateToggleStates();
    });
    // [txt2img Clipboard selector]
    onclick('sspp-clip-t2i', async e => {
        ssppUI.changePanelUIType("clip-t2i");
        await sspp_clipSelector?.loadBySubmenu("clip-t2i");
    });
    // [img2img Clipboard selector]
    onclick('sspp-clip-i2i', async e => {
        ssppUI.changePanelUIType("clip-i2i");
        await sspp_clipSelector?.loadBySubmenu("clip-i2i");
    });
    // [Output Clipboard selector]
    onclick('sspp-clip-out', async e => {
        ssppUI.changePanelUIType("clip-out");
        await sspp_clipSelector?.loadBySubmenu("clip-out");
    });

    // [Previous word]
    onclick('sspp-prevword', e => {
        sspp_wordOps.selectPrevWord(panel.classList.contains("word-select"));
        sspp_candOps.show();
    });
    // [Current word]
    onclick('sspp-currword', e => {
        sspp_wordOps.selectWord(panel.classList.contains("word-select"));
        panel.classList.toggle("word-select");
        sspp_candOps.show();
    });
    // [Next word]
    onclick('sspp-nextword', e => {
        sspp_wordOps.selectNextWord(panel.classList.contains("word-select"));
        sspp_candOps.show();
    });
    // [Emphasize]
    onclick('sspp-parentheses', e => {
        sspp_wordOps.emphasize();
    });
    // [rate down]
    onclick('sspp-ratedown', e => {
        sspp_wordOps.changeRate(-0.1);
    });
    // [rate up]
    onclick('sspp-rateup', e => {
        sspp_wordOps.changeRate(0.1);
    });
    
    // [Generate]
    onclick('sspp-generate', e => {
        ssppUI.generate();
        const textArea = ssppUI.promptArea();
        if (textArea) sspp_candOps.appendWordDictionaryByPrompt(textArea.value)
    });

    ssppUI.root().appendChild(panel);
}

// ファイルダイアログ等でフルスクリーンが解除された場合、フォーカス復帰時にフルスクリーンに戻す
function _setupFullscreenRestore() {
    let _pendingRestore = false;

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            // フルスクリーン解除後、短時間内にblurが発生すれば復帰フラグを立てる
            const onBlur = () => {
                _pendingRestore = true;
                cleanup();
            };
            const cleanup = () => {
                clearTimeout(timer);
                window.removeEventListener('blur', onBlur);
            };
            const timer = setTimeout(cleanup, 300);
            window.addEventListener('blur', onBlur);
        } else {
            _pendingRestore = false;
        }
    });

    window.addEventListener('focus', () => {
        if (_pendingRestore && !document.fullscreenElement) {
            _pendingRestore = false;
            document.documentElement.requestFullscreen().catch(() => {});
        }
    });
}

// ソフトウェアキーボードの表示に伴うレイアウト崩れを抑制
function _insertInteractiveWidget() {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
        let content = viewportMeta.getAttribute('content');
        if (!content.includes('interactive-widget')) {
            viewportMeta.setAttribute('content', content + ', interactive-widget=resizes-content');
        }
    }
}


// CSSのインジェクション/解除を切り替える
function _sspp_toggleResponsiveCSS(enabled) {
    const cssID = 'responsive-design-css';
    const existingLink = document.getElementById(cssID);
    
    if (enabled && !existingLink) {
        // 既にインジェクションされていなければCSSを追加
        const link = document.createElement('link');
        link.id = cssID;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = `file=extensions/sd-webui-mobile-plus/responsive.css?n=${(Math.random()*10000)>>0}`;
        document.head.appendChild(link);
    } else 
    if (!enabled && existingLink) {
        // インジェクションされていればCSSを削除
        existingLink.remove();
    }

    return enabled
}
