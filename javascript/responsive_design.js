// 画面上部のInjectパネルの表示/非表示を切り替える
function insertPanel() {
    _initialize();
    _initWordDictionary();
    _setupMenuButtons();
    _insertInteractiveWidget();

    sspp_sizeSelector.updateLabel();
    sspp_sizeSelector.refresh();
    sspp_clipSelector.refresh();
    sspp_candOps.updateCandidateButtons("__first__")

    console.log("Mobile+: Responsive design CSS injector has been loaded.");
}



// グローバル変数
let sspp_clipList = [];
let geminiapi = null;



// 初期化処理
function _initialize() {
    ssppUI.initialize();
    sspp_sizeSelector.initialize();
    sspp_clipSelector.initialize();
  
    // Gemini API モジュールの動的インポート
    import("./modules/geminiapi.js").then(module => {
        geminiapi = module.geminiapi();
    }).catch(err => {
        console.error("[Mobile+] Failed to load geminiapi module:", err);
    });
}

// 辞書初期化
function _initWordDictionary() {
    sspp_clipList = ssppUI.extractPromptHistory();
    sspp_candOps._wordDictionary['__first__'] = {};
    sspp_clipList.reverse().forEach(([url, posi, nega]) => {
        sspp_candOps.appendWordDictionaryByPrompt(posi)
    });
}

// メニューボタンのセットアップ
function _setupMenuButtons() {
    // パネルにボタンを追加するユーティリティ関数
    const onclick = (id, onClick) => {
        document.getElementById(id).addEventListener('click', onClick);
    }

    const panel = document.getElementById('sd-smartphone-plus-panel');
    
    // CSS Injection ボタン
    onclick('sspp-inject-css', () => {
        ssppUI.root().classList.toggle('sspp-opened', _sspp_toggleResponsiveCSS(true));
    });
    onclick('sspp-inject-css-full', () => {
        ssppUI.root().classList.toggle('sspp-opened', _sspp_toggleResponsiveCSS(true));
        document.body.requestFullscreen();
    });
    // CSS Extraction ボタン
    onclick('sspp-extract-css', () => {
        ssppUI.root().classList.toggle('sspp-opened', _sspp_toggleResponsiveCSS(false));
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
    onclick('sspp-sidemenu-open', e => {
        ssppUI.openSubmenu();
    });
    // [Checkpoint selector]
    onclick('sspp-checkpoint', e => {
        const uitype = ssppUI.changeSubMenuType("checkpoints");
        ssppUI.changePanelUIType(uitype);
    });
    // [Lora selector]
    onclick('sspp-lora', e => {
        const uitype = ssppUI.changeSubMenuType("lora");
        ssppUI.changePanelUIType(uitype);
    });
    // [Size selector]
    onclick('sspp-size', e => {
        const uitype = ssppUI.changeSubMenuType("size");
        ssppUI.changePanelUIType(uitype);
    });
    // [txt2img Clipboard selector]
    onclick('sspp-clip-t2i', e => {
        const uitype = ssppUI.changeSubMenuType("clip-t2i");
        ssppUI.changePanelUIType("default");
    });
    // [img2img Clipboard selector]
    onclick('sspp-clip-i2i', e => {
        const uitype = ssppUI.changeSubMenuType("clip-i2i");
        ssppUI.changePanelUIType("default");
    });
    // [Output Clipboard selector]
    onclick('sspp-clip-out', e => {
        const uitype = ssppUI.changeSubMenuType("clip-out");
        ssppUI.changePanelUIType("default");
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
        sspp_wordOps.changerate(-0.1);
    });
    // [rate up]
    onclick('sspp-rateup', e => {
        sspp_wordOps.changerate(0.1);
    });

    // [Close menu]
    onclick('sspp-sidemenu-close', e => {
        ssppUI.closeSubmenu();
    });
    
    // [Generate]
    onclick('sspp-generate', e => {
        ssppUI.generate();
        const textArea = ssppUI.promptArea();
        if (textArea) sspp_candOps.appendWordDictionaryByPrompt(textArea.value)
    });

    ssppUI.root().appendChild(panel);
}


// イベントリスナーの追加
function _addEventListener() {
    ssppUI.addTabEventListeners();
}


// ソフトウェアキーボード対応のためのメタタグを挿入
function _insertInteractiveWidget() {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
        let content = viewportMeta.getAttribute('content');
        if (!content.includes('interactive-widget')) {
            viewportMeta.setAttribute('content', content + ', interactive-widget=resizes-content');
        }
    }
}



class FileInfoAPI {
    // txt2img 画像を取得
    static fetchTxt2Img(start=0, count=50) {
        return fetch(`/api/mobile-plus/txt2img?start=${start}&count=${count}`)
    }

    // img2img 画像を取得
    static fetchImg2Img(start=0, count=50) {
        return fetch(`/api/mobile-plus/img2img?start=${start}&count=${count}`)
    }

    // 全保存画像を取得
    static fetchOutdirSave(start=0, count=50) {
        return fetch(`/api/mobile-plus/outdir?start=${start}&count=${count}`)
    }
}

// SDwebui 由来のUI操作クラス
// ※webui 側のDOM構造に依存するため、webui 側の更新で動作しなくなる可能性あり。
class UIController {
    constructor() {
        this.radios = {
            'resize_mode': '#resize_mode input[name=radio-resize_mode]',
            'img2img_mask_mode': '#img2img_mask_mode input[name=radio-img2img_mask_mode]',
            'img2img_inpainting_fill': '#img2img_inpainting_fill input[name=radio-img2img_inpainting_fill]',
            'img2img_inpaint_full_res': '#img2img_inpaint_full_res input[name=radio-img2img_inpaint_full_res]',
        }
        this.textareas = {
            'txt2img_prompt': '#txt2img_prompt textarea',
            'txt2img_neg_prompt': '#txt2img_neg_prompt textarea',
            'img2img_prompt': '#img2img_prompt textarea',
            'img2img_neg_prompt': '#img2img_neg_prompt textarea',
        }
        this.inputs = {
            'txt2img_sampling': '#txt2img_sampling input', 
            'txt2img_scheduler': '#txt2img_scheduler input',
            'txt2img_steps': '#txt2img_steps input',
            'txt2img_width': '#txt2img_width input',
            'txt2img_height': '#txt2img_height input',
            'txt2img_batch_count': '#txt2img_batch_count input',
            'txt2img_batch_size': '#txt2img_batch_size input',
            'txt2img_cfg_scale': '#txt2img_cfg_scale input',
            'txt2img_seed': '#txt2img_seed input',
            'txt2img_subseed_show': '#txt2img_subseed_show input',
            'txt2img_subseed': '#txt2img_subseed input',
            'txt2img_subseed_strength': '#txt2img_subseed_strength input',
            'txt2img_seed_resize_from_w': '#txt2img_seed_resize_from_w input',
            'txt2img_seed_resize_from_h': '#txt2img_seed_resize_from_h input',
            'txt2img_script_list': '#txt2img_script_container #script_list input',

            'img2img_inpaint_full_res_padding': '#img2img_inpaint_full_res_padding input',
            'soft_inpainting_enabled-visible-checkbox': '#soft_inpainting_enabled-visible-checkbox input',
            'mask_blend_power': '#mask_blend_power input',
            'mask_blend_scale': '#mask_blend_scale input',
            'inpaint_detail_preservation': '#inpaint_detail_preservation input',

            'img2img_mask_blur': '#img2img_mask_blur input',
            'img2img_mask_alpha': '#img2img_mask_alpha input',
            'img2img_sampling': '#img2img_sampling input', 
            'img2img_scheduler': '#img2img_scheduler input',
            'img2img_steps': '#img2img_steps input',
            'img2img_width': '#img2img_width input',
            'img2img_height': '#img2img_height input',
            'img2img_scale': '#img2img_scale input',
            'img2img_batch_count': '#img2img_batch_count input',
            'img2img_batch_size': '#img2img_batch_size input',
            'img2img_cfg_scale': '#img2img_cfg_scale input',
            'img2img_seed': '#img2img_seed input',
            'img2img_subseed_show': '#img2img_subseed_show input',
            'img2img_subseed': '#img2img_subseed input',
            'img2img_subseed_strength': '#img2img_subseed_strength input',
            'img2img_seed_resize_from_w': '#img2img_seed_resize_from_w input',
            'img2img_seed_resize_from_h': '#img2img_seed_resize_from_h input',
            'img2img_script_list': '#img2img_script_container #script_list input',
        }
        this.uis = {
            'txt2img_hires': '#txt2img_hr',
            'txt2img_refiner': '#txt2img_enable',
            'img2img_refiner': '#img2img_enable',
        }
        this._tabNames = [];
    }

    root() {
        return document.getElementsByClassName('contain')[0];
    }

    panel() {
        return document.getElementById('sd-smartphone-plus-panel');
    }

    changePanelUIType(type) {
        const newType = this.root().getAttribute("uitype") === type ? "default" : type;
        this.root().setAttribute("uitype", newType);
        const extraTabName = (type === "checkpoints" || type === "lora" && newType !== "default") ? type : "generation";
        const tab = this.extraTabs(extraTabName);
        if (tab) tab.click();
        return newType;
    }

    changeSubMenuType(submenu) {
        const newSubmenu = this.panel().getAttribute("submenu") === submenu ? "default" : submenu;
        this.panel().setAttribute("submenu", newSubmenu);
        return newSubmenu;
    }

    openSubmenu() {
        this.panel().classList.add("menu-opened");
        sspp_sizeSelector.updateLabel();
    }

    closeSubmenu() {
        this.panel().classList.remove("menu-opened");
        ssppUI.changeSubMenuType("default");
        ssppUI.changePanelUIType("default");
    }

    initialize() {
        // タブ名の取得
        this._tabNames = [];
        const tabButtons = document.querySelectorAll('#tabs>.tab-nav>button');
        tabButtons.forEach(btn => this._tabNames.push(btn.textContent.trim().toLowerCase()));

        // タブ切り替え時のイベントリスナー登録
        const tabsElem = document.getElementById('tabs')
        tabsElem.addEventListener("click", e => {
            const btn = e.target.closest("button");
            if (!btn) return;
            const tabName = btn.textContent.trim().toLowerCase();
            if (!this._tabNames.includes(tabName)) return;
            sspp_sizeSelector.updateLabel();
        });

        // テキストエリア入力時のイベントリスナー登録
        tabsElem.addEventListener('keyup', e => {
            const textarea = e.target.closest("textarea");
            if (textarea === ssppUI.promptArea()) sspp_candOps.show();
        });

        // パネルUIタイプ初期化
        this.root().setAttribute("uitype", "default");

        /**/ // !! Be careful for rerendering issue !!
        document.querySelector("#txt2img_styles input").setAttribute("readonly", "true");
        document.querySelector("#txt2img_sampling input").setAttribute("readonly", "true");
        document.querySelector("#txt2img_scheduler input").setAttribute("readonly", "true");
        document.querySelector("#img2img_styles input").setAttribute("readonly", "true");
        document.querySelector("#img2img_sampling input").setAttribute("readonly", "true");
        document.querySelector("#img2img_scheduler input").setAttribute("readonly", "true");
    }

    extractPromptHistory() {
        const promptHistoryBox = document.getElementById('sspp_prompt_history');
        if (!promptHistoryBox) return [];
        return JSON.parse(promptHistoryBox.querySelector("textarea, input").value);
    }

    // 現在のタブ名を取得
    currentTabName() {
        return document.querySelector('#tabs button.selected').textContent.trim().toLowerCase();
    }
    // "txt2img"と"img2img"のプロンプト入力要素を取得
    promptArea() {
        const tabName = this.currentTabName();
        if (tabName !== 'txt2img' && tabName !== 'img2img') return null;
        return document.querySelector(`#${tabName}_prompt textarea`);
    }
    // "txt2img"と"img2img"のネガティブプロンプト入力要素を取得
    negaPromptArea() {
        const tabName = this.currentTabName();
        if (tabName !== 'txt2img' && tabName !== 'img2img') return null;
        return document.querySelector(`#${tabName}_neg_prompt textarea`);
    }
    // "txt2img"と"img2img"のサイズ入力要素を取得
    sizeInputs() {
        const tabName = this.currentTabName();
        if (tabName !== 'txt2img' && tabName !== 'img2img') return null;
        return [
            document.querySelector(`#${tabName}_width input`),
            document.querySelector(`#${tabName}_height input`)
        ];
    }
    // "txt2img"と"img2img"の追加タブ要素を取得
    extraTabs(tab) {
        const tabName = this.currentTabName();
        if (tabName !== 'txt2img' && tabName !== 'img2img') return null;
        const tabs = document.querySelectorAll(`#${tabName}_extra_tabs>.tab-nav>button`);
        let tabElems = null;
        tabs.forEach(btn => {
            if (btn.textContent.trim().toLowerCase() === tab) tabElems = btn;
        });
        return tabElems;
    }

    // ”txt2img”、”img2img”、”extras”タブで生成を実行
    generate() {
        const tabName = this.currentTabName();
        if (tabName !== 'txt2img' && 
            tabName !== 'img2img' &&
            tabName !== 'extras') return false;
        const generateButton = document.getElementById(`${tabName}_generate`);
        if (!generateButton) return false;
        generateButton.click();
        return true;
    }

    // 現在のタブのプロンプトを変更
    setupPrompt(posiPrompt, negaPrompt) {
        const posiPromptArea = this.promptArea();
        const negaPromptArea = this.negaPromptArea();
        if (!posiPromptArea || !negaPromptArea) return;
        this._updateValue(posiPromptArea, posiPrompt);
        this._updateValue(negaPromptArea, negaPrompt);
    }

    // 現在のタブのサイズプロパティを変更
    setupSizeProps(width, height) {
        const sizeUI = this.sizeInputs();
        if (!sizeUI) return;
        this._updateValue(sizeUI[0], width);
        this._updateValue(sizeUI[1], height);
    }

    // input,textarea要素の値を更新
    _updateValue(inputElem, value) {
        if (inputElem && value !== undefined) {
            inputElem.value = value;
            inputElem.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
}
const ssppUI = new UIController();


// サイズセレクター操作クラス
class SizeSelector {
    constructor() {
        // サイズリストの初期化
        this._list = [];
        const sizeListJSON = localStorage.getItem('sspp_size_list');
        if (sizeListJSON) {
            this._list.push(...JSON.parse(sizeListJSON));
        } else {
            // デフォルトサイズリスト
            this._list.push(["SD1.5(3:2)", 768, 512]);
            this._list.push(["SD1.5(1:1)", 768, 768]);
            this._list.push(["SD1.5(2:3)", 512, 768]);
            this._list.push(["SDXL(4:3)", 1280, 960]);
            this._list.push(["SDXL(1:1)", 1024, 1024]);
            this._list.push(["SDXL(3:4)", 960, 1280]);
            this._list.push(["16:9", 1440, 810]);
            this._list.push(["3:2", 1440, 960]);
            this._list.push(["4:3", 1440, 1080]);
            this._list.push(["1:1", 1280, 1280]);
            this._list.push(["3:4", 1080, 1440]);
            this._list.push(["2:3", 960, 1440]);
            this._list.push(["9:16", 810, 1440]);
            localStorage.setItem('sspp_size_list', JSON.stringify(this._list));
        }

        this._el = null;
        this._elItem = null;
        this._elNew = null;
    }

    initialize() {
        // DOM要素の取得
        this._el = document.getElementById('sspp-size-selector');
        this._elNew = document.getElementById('sspp-size-new-item');
        this._elItem = this._el.querySelector('.selector-item[index="1"]');
        if (this._elItem) this._elItem.remove();
        // 新規サイズ登録ボタンのイベントリスナー登録
        const registerButton = document.getElementById('sspp-size-new-item-register');
        if (registerButton) {
            registerButton.addEventListener('click', () => this._onAddNewSize());
        }
    }

    add(name, width, height) {
        this._list.push([name, width, height]);
        localStorage.setItem('sspp_size_list', JSON.stringify(this._list));
    }

    remove(index) {
        if (index > -1 && index < this._list.length) {
            this._list.splice(index, 1);
            localStorage.setItem('sspp_size_list', JSON.stringify(this._list));
        }
    }

    refresh() {
        if (!this._el || !this._elItem) return;
        // 既存のサイズアイテムをクリア
        const sizeItems = this._el.querySelectorAll('.selector-item[index]');
        sizeItems.forEach(item => item.remove());
        // サイズリストから新しいサイズアイテムを追加
        this._list.forEach((size, i) => {
            this._appendNewSizeItem(i, size[0], size[1], size[2])
        });
    }

    updateLabel() {
        const size = ssppUI.sizeInputs();
        if (!size) return;
        const sizeLabel = document.querySelector('#sspp-size>span.sspp-button-label');
        sizeLabel.textContent = `${size[0].value}x${size[1].value}`;
    }

    _appendNewSizeItem(index, name, width, height) {
        if (!this._el || !this._elItem) return;
        const clone = this._elItem.cloneNode(true);
        clone.setAttribute('index', index + 1);
        const labelBtn = clone.querySelector('.selector-item-label');
        if (labelBtn) {
            labelBtn.textContent = `${name} (${width}x${height})`;
            labelBtn.addEventListener('click', () => this._onSelectSize(labelBtn));
        }
        const removeBtn = clone.querySelector('.sspp-close.selector-item-button');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => this._onRemoveSize(removeBtn));
        }
        this._el.insertBefore(clone, this._elNew);
    }

    _onSelectSize(me) {
        const index = me.parentNode.getAttribute('index') - 1;
        const sizeItem = this._list[index];
        if (sizeItem) {
            ssppUI.setupSizeProps(sizeItem[1], sizeItem[2]);
            this.updateLabel();
        }
    }

    _onRemoveSize(me) {
        const sizeItemElem = me.parentNode;
        const index = sizeItemElem.getAttribute('index') - 1;
        if (index > -1) {
            sizeItemElem.remove();
            this.remove(index);
            this.refresh();
        }
    }

    _onAddNewSize() {
        const inputs = this._elNew.querySelectorAll('input');
        const name = inputs[0].value;
        const width = parseInt(inputs[1].value);
        const height = parseInt(inputs[2].value);
        
        if (!width || !height) {
            alert('Please fill in width and height fields');
            return;
        }

        this.add(name, width, height);

        inputs[0].value = '';
        inputs[1].value = '';
        inputs[2].value = '';
        
        this.refresh();
    }

}
const sspp_sizeSelector = new SizeSelector();


// クリップボードセレクター操作クラス
class ClipboardSelector {
    constructor() {
        this._el = null;
        this._elItem = null;
    }   
    
    // 初期化処理
    initialize() {
        this._el = document.getElementById('sspp-clip-selector');
        this._elItem = this._el.querySelector('.sspp-clip-item[index="1"]');
        if (this._elItem) this._elItem.remove();
    }

    // クリップボードセレクターを更新
    refresh() {
        // 既存のクリップアイテムをクリア
        if (!this._el || !this._elItem) return;
        const clipItems = this._el.querySelectorAll('.sspp-clip-item[index]');
        clipItems.forEach(item => item.remove());
        // クリップリストから新しいクリップアイテムを追加
        for (let idx = sspp_clipList.length - 1; idx >= 0; idx--) {
            this._appendNewClipItem(idx, sspp_clipList[idx][0]);
        }
    }

    // クリップアイテムを追加
    _appendNewClipItem(index, imageUrl) {
        if (!this._el || !this._elItem) return;
        const clone = this._elItem.cloneNode(true);
        clone.setAttribute('index', index + 1);
        clone.setAttribute('style', `background-image:url(${imageUrl});`);
        clone.addEventListener('click', e => this._onSelectClip(e.target));
        this._el.appendChild(clone);
    }

    // クリップボード項目が選択されたときの処理
    _onSelectClip(me) {
        const index = me.getAttribute('index') - 1;
        const clipItem = sspp_clipList[index];
        if (clipItem) {
            ssppUI.setupPrompt(clipItem[1], clipItem[2]);
            ssppUI.setupSizeProps(clipItem[3], clipItem[4]);
            sspp_sizeSelector.updateLabel();
        }
    }
}
const sspp_clipSelector = new ClipboardSelector();


// 入力候補辞書操作
class CandidateOperations {
    constructor() {
        this._wordDictionary = {};
        this._candidateList = {};
        this._currentWord = '';
    }

    appendWordDictionaryByPrompt(prompt) {
        const words = this._splitWords(prompt);

        // 各単語とそのコンテキストを辞書に登録
        words.forEach((word, i) => {
            if (word && !(word in this._wordDictionary)) {
                // 新しい単語の場合は辞書を初期化
                this._wordDictionary[word] = {};
            } else {
                // 出現した単語の記録済みスコアを0.95倍する
                Object.keys(this._wordDictionary[word]).forEach(context => {
                    this._wordDictionary[word][context] *= 0.95;
                });
            }
            // コンテキスト単語を登録
            for (let c=1; c<=4; c++) {
                const context = words[i + c];
                if (context && !(context in this._wordDictionary)) this._wordDictionary[context] = {};
                if (context) {
                    if (!(context in this._wordDictionary[word])) this._wordDictionary[word][context] = 0;
                    this._wordDictionary[word][context] += 5-c;
                    if (!(word in this._wordDictionary[context])) this._wordDictionary[context][word] = 0;
                    this._wordDictionary[context][word] += 5-c;
                }
            }
            this._candidateList[word] = null;
        });
        // 最初と最後の単語も特別に登録
        if (words.length > 0) {
            const cmax = Math.min(4, words.length);
            for (let c=1; c<=cmax; c++) {
                const firstWord = words[c - 1];
                const lastWord = words[words.length - c];
                if (!(firstWord in this._wordDictionary['__first__'])) this._wordDictionary['__first__'][firstWord] = 0;
                this._wordDictionary['__first__'][firstWord] += 5-c;
            }
            this._candidateList['__first__'] = null;
        }
    }

    _splitWords(prompt) {
        return prompt.split(/[\s,()]+|:\s*[\d.]+\s*\)/).map(w=>w.trim().toLowerCase()).filter(w=>w!=='');
    }

    getCandidates(word) {
        const scores = this._wordDictionary[word];
        if (!scores) return [];
        if (!this._candidateList[word]) {
            this._candidateList[word] = Object.keys(scores).map(word=>({ word, score: scores[word]})).sort((a, b) => b.score - a.score);
        }
        return this._candidateList[word];
    }

    show() {
        const textArea = ssppUI.promptArea();
        if (!textArea) return;

        const cursor = sspp_wordOps._matchWordAtPosition(textArea.value, textArea.selectionEnd, -1);
        if (!cursor) return;
        const currentWord = textArea.value.substring(cursor.start, cursor.end).trim().toLowerCase();
        if (this._currentWord === currentWord) return;
        this._currentWord = currentWord;
        this.updateCandidateButtons(currentWord)
    }

    // 入力候補ボタンの更新
    updateCandidateButtons(targetWord) {
        const _onClickCandidate = word => {
            const textArea = ssppUI.promptArea();
            if (!textArea) return;
            const cursor = sspp_wordOps._matchWordAtPosition(textArea.value, textArea.selectionEnd) || { end: textArea.selectionEnd };
            const before = textArea.value.substring(0, cursor.end);
            const after = textArea.value.substring(cursor.end);
            if (before && !/\s$/.test(before)) word = ' ' + word;
            if (after && !/^\s/.test(after)) word = word + ' ';
            textArea.value = before + word + after;
            textArea.dispatchEvent(new Event('input', { bubbles: true }));
            const pos = before.length + word.length;
            textArea.setSelectionRange(pos, pos);
            textArea.focus();
            setTimeout(() => this.show(), 200);
        }

        const textArea = ssppUI.promptArea();
        if (!textArea) return;
        const candidates = this.getCandidates(targetWord);
        if (candidates.length === 0) return;
        const candidateDiv = document.getElementById('sspp-candidate');
        candidateDiv.classList.add('hidden');

        const words = this._splitWords(textArea.value);
        candidateDiv.classList.remove('hidden');
        candidateDiv.innerHTML = '';
        let count = 0, i = 0;
        while (count < 6 && i < candidates.length) {
            const item = candidates[i++];
            if (words.includes(item.word)) continue;
            const btn = document.createElement('button');
            btn.textContent = item.word;
            btn.className = 'helper';
            btn.addEventListener('click', () => _onClickCandidate(item.word));
            candidateDiv.appendChild(btn);
            count++;
        }

    }
}
const sspp_candOps = new CandidateOperations();


// テキストエリア内の単語操作
class WordOperations {
    selectWord(hold) {
        if (hold) this._unselectWord();
        else this._selectCurrentWord();
    }

    _matchWordAtPosition(text, position, directionFlag=0) {
        const re = /[^\s,():]+|:\s*[\d.]+/g;
        let prevStart = 0, prevEnd = 0;
        for (let match; (match = re.exec(text)) !== null; ) {
            const start = match.index;
            const end = start + match[0].length;
            if (position < end) {
                if (start < position) return { start, end };
                if (directionFlag < 0) return { start: prevStart, end: prevEnd };
                if (directionFlag > 0) return { start, end };
                return null;
            }
            prevStart = start;
            prevEnd = end;
        }
        return (directionFlag < 0) ? { start: prevStart, end: prevEnd } : null;
    }

    _selectCurrentWord() {
        const textArea = ssppUI.promptArea();
        if (!textArea) return;
        const cursor = this._matchWordAtPosition(textArea.value, textArea.selectionStart);
        if (cursor) textArea.setSelectionRange(cursor.start, cursor.end);
        textArea.focus();
    }
    
    _unselectWord() {
        const textArea = ssppUI.promptArea();
        if (!textArea) return;
        const pos = textArea.selectionStart;
        textArea.setSelectionRange(pos, pos);
        textArea.focus();
    }

    selectPrevWord(hold) {
        const textArea = ssppUI.promptArea();
        if (!textArea) return;
        const cursor = this._matchWordAtPosition(textArea.value, textArea.selectionStart, -1);
        if (cursor) textArea.setSelectionRange(cursor.start, hold ? textArea.selectionEnd : cursor.end);
        textArea.focus();
    }
    
    selectNextWord(hold) {
        const textArea = ssppUI.promptArea();
        if (!textArea) return;
        const cursor = this._matchWordAtPosition(textArea.value, textArea.selectionEnd, 1);
        if (cursor) textArea.setSelectionRange(hold ? textArea.selectionStart : cursor.start, cursor.end);
        textArea.focus();
    }

    changerate(rateGain) {
        const textArea = ssppUI.promptArea();
        if (!textArea) return;
        this._selectCurrentWord();
        const text = textArea.value;
        const before = text.substring(0, textArea.selectionStart);
        const after = text.substring(textArea.selectionStart);
        const match = after.match(/:?(\s*)([\d.]+)?(\s*\))/);
        if (match) {
            const rate = (match[2] ? (parseFloat(match[2]) || 0) : 1.1) + rateGain;
            const rateText = `:${match[1]}${(rate < 0) ? 0 : rate.toFixed(1)}`;
            const newAfter = after.slice(0, match.index) + rateText + match[3] + after.slice(match.index + match[0].length);
            textArea.value = before + newAfter;
            textArea.dispatchEvent(new Event('input', { bubbles: true }));
            const start = before.length + match.index;
            textArea.setSelectionRange(start, start + rateText.length);
            textArea.focus();
        }
    }

    emphasize() {
        const textArea = ssppUI.promptArea();
        if (!textArea) return;
        this._selectCurrentWord();
        const text = textArea.value;
        const before = text.substring(0, textArea.selectionStart);
        const content = text.substring(textArea.selectionStart, textArea.selectionEnd);
        const after =  text.substring(textArea.selectionEnd);
        const contentR = content.replaceAll(/[()]|:\s*[\d.]+/g, '');
        const newBefore = before.replace(/^(.*)\((?!.*[)>])([^(]*)$/s, '$1$2');
        const newContent = (/^\([^<()>]*\)$/s.test(content)) ? contentR : `(${contentR})`;
        const newAfter  = after.replace(/^([^<(]*)\)(.*)$/s, '$1$2');
        textArea.value = newBefore + newContent + newAfter;
        textArea.dispatchEvent(new Event('input', { bubbles: true }));
        textArea.setSelectionRange(newBefore.length, newBefore.length + newContent.length);
        textArea.focus();
    }
}
const sspp_wordOps = new WordOperations();




// CSSのインジェクション/解除を切り替える
function _sspp_toggleResponsiveCSS(enabled) {
    const cssID = 'responsive-design-css';
    const existingLink = document.getElementById(cssID);
    
    if (enabled && !existingLink) {
        const link = document.createElement('link');
        link.id = cssID;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = `file=extensions/sd-webui-mobile-plus/responsive.css?n=${(Math.random()*10000)>>0}`;
        document.head.appendChild(link);
    } else 
    if (!enabled && existingLink) {
        existingLink.remove();
    }

    return enabled
}
