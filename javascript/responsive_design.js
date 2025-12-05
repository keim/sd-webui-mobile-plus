// 画面上部のInjectパネルの表示/非表示を切り替える
function insertPanel() {
    _initialize();
    _setupMenuButtons();
    _addEventListener();
    _insertInteractiveWidget();

    _sspp_updateSizeDisplay();
    _sspp_updateSizeSelector();
    _sspp_updateClipSelector();

    console.log("Responsive design CSS injector has been loaded.");
}

// グローバル変数
const _sspp_tabNames = [];
let _sspp_currentTabName = '';
const sspp_sizeList = [];
const sspp_clipList = [];
let sspp_sizeSelectorItem = null;
let sspp_clipSelectorItem = null;
let geminiapi = null;

// 初期化処理
function _initialize() {
    const sizeListJSON = localStorage.getItem('sspp_size_list');
    const clipListJSON = localStorage.getItem('sspp_clip_list');
    if (sizeListJSON) {
        sspp_sizeList.push(...JSON.parse(sizeListJSON));
    } else {
        sspp_sizeList.push(["SD1.5(3:2)", 768, 512]);
        sspp_sizeList.push(["SD1.5(1:1)", 768, 768]);
        sspp_sizeList.push(["SD1.5(2:3)", 512, 768]);
        sspp_sizeList.push(["SDXL(4:3)", 1280, 960]);
        sspp_sizeList.push(["SDXL(1:1)", 1024, 1024]);
        sspp_sizeList.push(["SDXL(3:4)", 960, 1280]);
        sspp_sizeList.push(["16:9", 1440, 810]);
        sspp_sizeList.push(["3:2", 1440, 960]);
        sspp_sizeList.push(["4:3", 1440, 1080]);
        sspp_sizeList.push(["1:1", 1280, 1280]);
        sspp_sizeList.push(["3:4", 1080, 1440]);
        sspp_sizeList.push(["2:3", 960, 1440]);
        sspp_sizeList.push(["9:16", 810, 1440]);
        localStorage.setItem('sspp_size_list', JSON.stringify(sspp_sizeList));
    }
    if (clipListJSON) {
        sspp_clipList.push(...JSON.parse(clipListJSON));
    } else {
        localStorage.setItem('sspp_clip_list', JSON.stringify(sspp_clipList));
    }
    sspp_sizeSelectorItem = document.querySelector('#sspp-size-selector .selector-item[index="1"]');
    sspp_clipSelectorItem = document.querySelector('#sspp-clip-selector .selector-item[index="1"]');
    if (sspp_sizeSelectorItem) sspp_sizeSelectorItem.remove();
    if (sspp_clipSelectorItem) sspp_clipSelectorItem.remove();

    import("./modules/geminiapi.js").then(module => {
        geminiapi = module.geminiapi();
    }).catch(err => {
        console.error("Failed to load geminiapi module:", err);
    });
}

// メニューボタンのセットアップ
function _setupMenuButtons() {
    // パネルにボタンを追加するユーティリティ関数
    const onclick = (id, onClick) => {
        document.getElementById(id).addEventListener('click', onClick);
    }

    const panel = document.getElementById('sd-smartphone-plus-panel');
    const root = document.getElementById('tabs').parentNode;
    
    // CSS Injection ボタン
    onclick('sspp-inject-css', () => {
        root.classList.toggle('sspp-opened', _sspp_toggleResponsiveCSS());
    });
    
    // [Negative Prompt]
    onclick('sspp-nega-prompt', e => {
        root.classList.toggle("nega-prompt-hidden");
    });
    // [Props]
    onclick('sspp-config', e => {
        root.classList.toggle("config-hidden");
    });
    // [Size selector]
    onclick('sspp-size', e => {
        panel.classList.toggle("size-select");
    });
    // [Clipboard selector]
    onclick('sspp-clip', e => {
        panel.classList.toggle("clip-select");
    })

    // [Previous word]
    onclick('sspp-prevword', e => {
        sspp_wordOps.selectPrevWord(panel.classList.contains("word-select"));
    });
    // [Current word]
    onclick('sspp-currword', e => {
        sspp_wordOps.selectWord(panel.classList.contains("word-select"));
        panel.classList.toggle("word-select");
    });
    // [Next word]
    onclick('sspp-nextword', e => {
        sspp_wordOps.selectNextWord(panel.classList.contains("word-select"));
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

    // [Generate]
    onclick('sspp-generate', e => {
        const generateButton = _generateButton();
        if (generateButton) generateButton.click();
    });

    root.appendChild(panel);
    root.classList.add('config-hidden', 'nega-prompt-hidden');
}

// タブ変更イベントの追加
function _addEventListener() {
    const tabButtons = document.querySelectorAll('#tabs>.tab-nav>button');
    tabButtons.forEach(btn => _sspp_tabNames.push(btn.textContent.trim().toLowerCase()));
    _sspp_currentTabName = _currentTabName();

    document.getElementById('tabs').addEventListener("click", e => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const tabName = btn.textContent.trim().toLowerCase();
        if (!_sspp_tabNames.includes(tabName)) return;
        console.log(`Tab changed to: ${tabName}`);
        _sspp_currentTabName = tabName;
        _sspp_updateSizeDisplay();
    });
}

// インタラクティブウィジェット用のメタタグを挿入する
function _insertInteractiveWidget() {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
        let content = viewportMeta.getAttribute('content');
        if (!content.includes('interactive-widget')) {
            viewportMeta.setAttribute('content', content + ', interactive-widget=resizes-content');
        }
    }
}



// 現在選択されているタブの名前を取得する
function _currentTabName() {
    return document.querySelector('#tabs button.selected').textContent.trim().toLowerCase();
}

function _promptArea() {
    if (_sspp_currentTabName !== 'txt2img' && _sspp_currentTabName !== 'img2img') return null;
    return document.querySelector(`#${_sspp_currentTabName}_prompt textarea`);
}
function _negaPromptArea() {
    if (_sspp_currentTabName !== 'txt2img' && _sspp_currentTabName !== 'img2img') return null;
    return document.querySelector(`#${_sspp_currentTabName}_neg_prompt textarea`);
}


function _sizeInputs() {
    if (_sspp_currentTabName !== 'txt2img' && _sspp_currentTabName !== 'img2img') return null;
    return [
        document.querySelector(`#${_sspp_currentTabName}_width input`),
        document.querySelector(`#${_sspp_currentTabName}_height input`)
    ];
}

function _generateButton() {
    if (_sspp_currentTabName !== 'txt2img' && _sspp_currentTabName !== 'img2img') return null;
    return document.getElementById(`${_sspp_currentTabName}_generate`);
}


// サイズ選択ボタンが押されたときの処理
function sspp_setSize(width, height) {
    const size = _sizeInputs();
    if (!size) return;
    size[0].value = width;
    size[0].dispatchEvent(new Event('input', { bubbles: true }));
    size[1].value = height;
    size[1].dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('sd-smartphone-plus-panel').classList.remove("size-select");
    _sspp_updateSizeDisplay();
}


// 新しいサイズを登録する
function sspp_newSize(me) {
    const inputs = me.parentNode.querySelectorAll('input');
    const name = inputs[0].value;
    const width = parseInt(inputs[1].value);
    const height = parseInt(inputs[2].value);
    
    if (!width || !height) {
        alert('Please fill in all fields (name, width, height)');
        return;
    }
    
    sspp_sizeList.push([name, width, height]);
    localStorage.setItem('sspp_size_list', JSON.stringify(sspp_sizeList));
    
    inputs[0].value = '';
    inputs[1].value = '';
    inputs[2].value = '';
    
    _sspp_updateSizeSelector();
}

function sspp_selectSize(me) {
    const sizeItem = me.parentNode;
    const index = sizeItem.getAttribute('index') - 1;
    if (index > -1) {
        size = sspp_sizeList[index];
        sspp_setSize(size[1], size[2]);
    }
}

function sspp_removeSize(me) {
    const sizeItem = me.parentNode;
    const index = sizeItem.getAttribute('index') - 1;
    if (index > -1) {
        sspp_sizeList.splice(index, 1);
        localStorage.setItem('sspp_size_list', JSON.stringify(sspp_sizeList));
        sizeItem.remove();
        _sspp_updateSizeSelector();
    }
}

function sspp_newClip(me) {
    const textArea = _promptArea();
    const negaTextArea = _negaPromptArea();

    const inputs = me.parentNode.querySelectorAll('input');
    const name = inputs[0].value;
    
    if (!name) {
        alert('Please fill in name field');
        return;
    }
    
    sspp_clipList.push([name, textArea.value, negaTextArea.value]);
    localStorage.setItem('sspp_clip_list', JSON.stringify(sspp_clipList));
    
    inputs[0].value = '';
    _sspp_updateClipSelector();
}

function sspp_selectClip(me) {
    const clipItem = sspp_clipList[me.parentNode.getAttribute('index') - 1];
    
    if (clipItem) {
        const textArea = _promptArea();
        const negaTextArea = _negaPromptArea();
        if (textArea && negaTextArea) {
            textArea.value = clipItem[1];
            textArea.dispatchEvent(new Event('input', { bubbles: true }));
            negaTextArea.value = clipItem[2];
            negaTextArea.dispatchEvent(new Event('input', { bubbles: true }));
            document.getElementById('sd-smartphone-plus-panel').classList.remove('clip-select');
        }
    }
}

function sspp_removeClip(me) {
    const clipItem = me.parentNode;
    const index = clipItem.getAttribute('index') - 1;
    if (index > -1) {
        sspp_clipList.splice(index, 1);
        localStorage.setItem('sspp_clip_list', JSON.stringify(sspp_clipList));
        // remove the element from the DOM
        clipItem.remove();
        // update the selector UI
        _sspp_updateClipSelector();
    }
}

// セレクターを閉じる
function sspp_closeSelector(me) {
    document.getElementById('sd-smartphone-plus-panel').classList.remove('clip-select', 'size-select')    
}


// サイズセレクターの UI を更新する
function _sspp_updateSizeSelector() {
    const sizeSelector = document.getElementById('sspp-size-selector');

    // remove any existing generated selector items (those with an index)
    const sizeItems = sizeSelector.querySelectorAll('.selector-item[index]');
    sizeItems.forEach(item => item.remove());

    // If we have a template item captured during initialization, clone it for each size
    if (sspp_sizeSelectorItem) {
        sspp_sizeList.forEach((size, idx) => {
            const clone = sspp_sizeSelectorItem.cloneNode(true);
            clone.setAttribute('index', idx + 1);
            const labelBtn = clone.querySelector('.selector-item-label');
            if (labelBtn) {
                labelBtn.textContent = `${size[0]} (${size[1]}x${size[2]})`;
                labelBtn.setAttribute('onclick', 'sspp_selectSize(this)');
            }
            const removeBtn = clone.querySelector('.sspp-close.selector-item-button');
            if (removeBtn) {
                removeBtn.setAttribute('onclick', 'sspp_removeSize(this)');
            }
            const lastItem = document.getElementById('sspp-size-new-item');
            sizeSelector.insertBefore(clone, lastItem);
        });
    }
}

// クリップセレクターの UI を更新する
function _sspp_updateClipSelector() {
    const clipSelector = document.getElementById('sspp-clip-selector');
    const clipItems = clipSelector.querySelectorAll('.selector-item[index]');
    clipItems.forEach(item => item.remove());
    
    // 新しいクリップアイテムを追加
    const addButton = clipSelector.querySelector('.selector-item:not([index])');
    if (sspp_clipSelectorItem) {
        sspp_clipList.forEach((prompts, idx) => {
            const clone = sspp_clipSelectorItem.cloneNode(true);
            clone.setAttribute('index', idx + 1);
            const labelBtn = clone.querySelector('.selector-item-label');
            if (labelBtn) {
                labelBtn.textContent = `${prompts[0]}`;
                labelBtn.setAttribute('onclick', 'sspp_selectClip(this)');
            }
            const removeBtn = clone.querySelector('.sspp-close.selector-item-button');
            if (removeBtn) {
                removeBtn.setAttribute('onclick', 'sspp_removeClip(this)');
            }
            const lastItem = document.getElementById('sspp-clip-new-item');
            clipSelector.insertBefore(clone, lastItem);
        });
    }
}


// サイズ表示を更新する
function _sspp_updateSizeDisplay() {
    const size = _sizeInputs();
    if (!size) return;
    const sizeLabel = document.querySelector('#sspp-size>span.sspp-button-label');
    sizeLabel.textContent = `${size[0].value}x${size[1].value}`;
}


// テキストエリア内の現在の単語を選択/解除する
class WordOperations {
    selectWord(hold) {
        if (hold) this.unselectWord();
        else this.selectCurrentWord();
    }

    _selectCurrentWord() {
        const textArea = _promptArea();
        if (!textArea) return;
        const text = textArea.value;
        let start = textArea.selectionStart;
        while (start > 0 && !/\s/.test(text[start - 1])) start--;
        let end = textArea.selectionEnd;
        while (end < text.length && !/\s/.test(text[end])) end++;
        textArea.setSelectionRange(start, end);
        textArea.focus();
    }
    
    _unselectWord() {
        const textArea = _promptArea();
        if (!textArea) return;
        const pos = textArea.selectionEnd;
        textArea.setSelectionRange(pos, pos);
        textArea.focus();
    }

    selectPrevWord(hold) {
        const textArea = _promptArea();
        if (!textArea) return;
        this.selectCurrentWord();
        const text = textArea.value;
        let end = textArea.selectionStart;
        if (end === 0) return;
        end--;
        while (end > 0 && /\s/.test(text[end - 1])) end--;
        let start = end;
        while (start > 0 && !/\s/.test(text[start - 1])) start--;
        textArea.setSelectionRange(start, hold ? textArea.selectionEnd : end);
        textArea.focus();
    }
    
    selectNextWord(hold) {
        const textArea = _promptArea();
        if (!textArea) return;
        this.selectCurrentWord();
        const text = textArea.value;
        let start = textArea.selectionEnd;
        if (start === text.length) return;
        while (start < text.length && /\s/.test(text[start])) start++;
        let end = start;
        while (end < text.length && !/\s/.test(text[end])) end++;
        textArea.setSelectionRange(hold ? textArea.selectionStart : start, end);
        textArea.focus();
    }

    changerate(rateGain) {
        const textArea = _promptArea();
        if (!textArea) return;
        this.selectCurrentWord();
        const text = textArea.value;
        const before = text.substring(0, textArea.selectionStart);
        const after = text.substring(textArea.selectionStart);
        const newAfter = after.replace(/(:\s*([\d.]+))?\s*\)/, (m, p1, p2) => {
            const rate = (p2 ? (parseFloat(p2) || 0) : 1.1) + rateGain;
            return `:${(rate < 0) ? 0 : rate.toFixed(1)})`;
        });
        textArea.value = before + newAfter;
        textArea.dispatchEvent(new Event('input', { bubbles: true }));
        textArea.setSelectionRange(before.length, before.length);
    }

    emphasize() {
        const textArea = _promptArea();
        if (!textArea) return;
        this.selectCurrentWord();
        const text = textArea.value;
        const before = text.substring(0, textArea.selectionStart);
        const content = text.substring(textArea.selectionStart, textArea.selectionEnd);
        const after =  text.substring(textArea.selectionEnd);
        const contentR = content.replaceAll(/[()]/g, '');
        const newBefore = before.replace(/^(.*)\((?!.*[)>])([^(]*)$/s, '$1$2');
        const newContent = (/^\([^<()>]*\)$/s.test(content)) ? contentR : `(${contentR})`;
        const newAfter  = after.replace(/^([^<(]*)\)(.*)$/s, '$1$2');
        textArea.value = newBefore + newContent + newAfter;
        textArea.dispatchEvent(new Event('input', { bubbles: true }));
        textArea.setSelectionRange(newBefore.length, newBefore.length + newContent.length);
    }
}
const sspp_wordOps = new WordOperations();





// CSSのインジェクション/解除を切り替える
function _sspp_toggleResponsiveCSS() {
    const cssID = 'responsive-design-css';
    const existingLink = document.getElementById(cssID);
    
    if (!existingLink) {
        // CSSが注入されていない場合 → 注入する
        const link = document.createElement('link');
        link.id = cssID;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = 'file=extensions/sd-webui-smartphone-plus/responsive.css?n='+((Math.random()*10000)>>0);
        document.head.appendChild(link);
        return true
    } else {
        existingLink.remove();
        return false
    }
}
