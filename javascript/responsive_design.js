// 画面上部のInjectパネルの表示/非表示を切り替える
function insertPanel() {
    _setupMenuButtons();
    _addEventListener();
    _insertInteractiveWidget();
    _sspp_updateSizeDisplay();
    console.log("Responsive design CSS injector has been loaded.");
}

const _sspp_tabNames = [];
let _sspp_currentTabName = '';

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
        _sspp_selectPrevWord(panel.classList.contains("word-select"));
    });
    // [Current word]
    onclick('sspp-currword', e => {
        sspp_selectWord(panel.classList.contains("word-select"));
        panel.classList.toggle("word-select");
    });
    // [Next word]
    onclick('sspp-nextword', e => {
        _sspp_selectNextWord(panel.classList.contains("word-select"));
    });
    // [Emphasize]
    onclick('sspp-parentheses', e => {
        _sspp_emphasize();
    });
    // [rate down]
    onclick('sspp-ratedown', e => {
        _sspp_changerate(-0.1);
    });
    // [rate up]
    onclick('sspp-rateup', e => {
        _sspp_changerate(0.1);
    });

    // [Generate]
    onclick('sspp-generate', e => {
        const generateButton = _generateButton();
        if (generateButton) generateButton.click();
    });

    root.appendChild(panel);
    root.classList.add('config-hidden', 'nega-prompt-hidden');
}

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

const sspp_sizeList = []
function sspp_newSize(e) {
    
}

function sspp_selectSize(e) {
    
}

function sspp_removeSize(e) {
    
}

const sspp_clipList = []
function sspp_newClip(e) {
    const textArea = _promptArea();
    sspp_clipList.push(textArea.value);
}

function sspp_selectClip(e) {
    
}

function sspp_removeClip(e) {
    
}


function sspp_closeSelector() {
    document.getElementById('sd-smartphone-plus-panel').classList.remove('clip-select', 'size-select')    
}

// サイズ表示を更新する
function _sspp_updateSizeDisplay() {
    const size = _sizeInputs();
    if (!size) return;
    const sizeLabel = document.querySelector('#sspp-size>span.sspp-button-label');
    sizeLabel.textContent = `${size[0].value}x${size[1].value}`;
}


// テキストエリア内の現在の単語を選択/解除する
function sspp_selectWord(hold) {
    if (hold) _sspp_unselectWord();
    else _sspp_selectCurrentWord();
}
function _sspp_selectCurrentWord() {
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
function _sspp_unselectWord() {
    const textArea = _promptArea();
    if (!textArea) return;
    const pos = textArea.selectionEnd;
    textArea.setSelectionRange(pos, pos);
    textArea.focus();
}

// テキストエリア内の前の単語を選択する
function _sspp_selectPrevWord(hold) {
    const textArea = _promptArea();
    if (!textArea) return;
    _sspp_selectCurrentWord(textArea);
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

// テキストエリア内の次の単語を選択する
function _sspp_selectNextWord(hold) {
    const textArea = _promptArea();
    if (!textArea) return;
    _sspp_selectCurrentWord(textArea);
    const text = textArea.value;
    let start = textArea.selectionEnd;
    if (start === text.length) return;
    while (start < text.length && /\s/.test(text[start])) start++;
    let end = start;
    while (end < text.length && !/\s/.test(text[end])) end++;
    textArea.setSelectionRange(hold ? textArea.selectionStart : start, end);
    textArea.focus();
}

// ":n)" のn値を変更
function _sspp_changerate(rateGain) {
    const textArea = _promptArea();
    if (!textArea) return;
    _sspp_selectCurrentWord(textArea);
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

// "()"で囲う
function _sspp_emphasize() {
    const textArea = _promptArea();
    if (!textArea) return;
    _sspp_selectCurrentWord(textArea);
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
