// 画面上部のInjectパネルの表示/非表示を切り替える
function insertPanel() {
    const panel = document.getElementById('sd-smartphone-plus-panel');
    const root = document.getElementById('tabs').parentNode;

    _setOnClick('sspp-inject-css', () => {
        root.classList.toggle('sspp-opened', _toggleResponsiveCSS());
    })
    // Negaボタンの追加
    _setOnClick('sspp-nega-prompt', e => {
        root.classList.toggle("nega-prompt-hidden");
    });
    // Configボタンの追加
    _setOnClick('sspp-config', e => {
        root.classList.toggle("config-hidden");
    });
    // Sizeボタンの追加
    _setOnClick('sspp-size', e => {
        panel.classList.toggle("size-select");
    });
    sspp_updateSizeDisplay();
    root.appendChild(panel);
    root.classList.add('config-hidden', 'nega-prompt-hidden');


    const helper = document.getElementById('sd-smartphone-plus-prompt-helper');
    const t2i = document.getElementById('txt2img_prompt_container');
    _setOnClick('sspp-generate', e => {
        const generateButton = document.getElementById('txt2img_generate');
        generateButton.click();
    })
    _setOnClick('sspp-prevword', e => {
        _sspp_selectPrevWord(_promptTextArea(), helper.classList.contains("word-select"))
    });
    _setOnClick('sspp-currword', e => {
        sspp_selectWord(panel.classList.contains("word-select"));
        helper.classList.toggle("word-select");
    });
    _setOnClick('sspp-nextword', e => {
        _sspp_selectNextWord(_promptTextArea(), helper.classList.contains("word-select"))
    });
    _setOnClick('sspp-parentheses', e => {
        _sspp_emphasize(_promptTextArea());
    });
    _setOnClick('sspp-ratedown', e => {
        _sspp_changerate(_promptTextArea(), -0.05);
    });
    _setOnClick('sspp-rateup', e => {
        _sspp_changerate(_promptTextArea(), +0.05);
    });
    t2i.appendChild(helper);
    

    console.log("Responsive design CSS injector has been loaded.");
}


// 現在選択されているタブの名前を取得する
function _currentTab() {
    return document.querySelector('#tabs button.selected').textContent.trim().toLowerCase();
}

// 現在のタブに対応するプロンプトテキストエリアを取得する
function _promptTextArea() {
    const tab = _currentTab();
    if (tab === 'txt2img') {
        return document.querySelector('#txt2img_prompt textarea');
    } else if (tab === 'img2img') {
        return document.querySelector('#img2img_prompt textarea');
    }
    return null;
}


// パネルにボタンを追加するユーティリティ関数
function _setOnClick(id, onClick) {
    document.getElementById(id).addEventListener('click', onClick);
}


// サイズ選択ボタンが押されたときの処理
function sspp_setSize(width, height) {
    const widthInput = document.querySelector('#txt2img_width input');
    const heightInput = document.querySelector('#txt2img_height input');
    widthInput.value = width;
    heightInput.value = height;
    widthInput.dispatchEvent(new Event('input', { bubbles: true }));
    heightInput.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('sd-smartphone-plus-panel').classList.remove("size-select");
    sspp_updateSizeDisplay();
}

// サイズ表示を更新する
function sspp_updateSizeDisplay() {
    const widthInput = document.querySelector('#txt2img_width input');
    const heightInput = document.querySelector('#txt2img_height input');
    const sizeLabel = document.querySelector('#sspp-size>span.sspp-button-label');
    sizeLabel.textContent = `${widthInput.value}x${heightInput.value}`;
}


// テキストエリア内の現在の単語を選択/解除する
function sspp_selectWord(hold) {
    const textArea = _promptTextArea();
    if (!textArea) return;
    if (hold) _sspp_unselectWord(textArea);
    else _sspp_selectCurrentWord(textArea);
}
function _sspp_selectCurrentWord(textArea) {
    const text = textArea.value;
    let start = textArea.selectionStart;
    while (start > 0 && !/\s/.test(text[start - 1])) start--;
    let end = textArea.selectionEnd;
    while (end < text.length && !/\s/.test(text[end])) end++;
    textArea.setSelectionRange(start, end);
    textArea.focus();
}
function _sspp_unselectWord(textArea) {
    const pos = textArea.selectionEnd;
    textArea.setSelectionRange(pos, pos);
    textArea.focus();
}

// テキストエリア内の前の単語を選択する
function _sspp_selectPrevWord(textArea, hold) {
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
function _sspp_selectNextWord(textArea, hold) {
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

function _sspp_changerate(textArea, rateGain) {
    _sspp_selectCurrentWord(textArea);
    const text = textArea.value;
    const before = text.substring(0, textArea.selectionStart);
    const after = text.substring(textArea.selectionStart);
    const newAfter = after.replace(/(:\s*([\d.]+))?\s*\)/, (m, p1, p2) => {
        const rate = (p2 ? (parseFloat(p2) || 0) : 1.1) + rateGain;
        return `:${(rate < 0) ? 0 : rate.toFixed(2)})`;
    });
    textArea.value = before + newAfter;
    textArea.dispatchEvent(new Event('input', { bubbles: true }));
    textArea.setSelectionRange(before.length, before.length);
}

function _sspp_emphasize(textArea) {
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
function _toggleResponsiveCSS() {
    const cssID = 'responsive-design-css';
    const existingLink = document.getElementById(cssID);
    
    if (!existingLink) {
        // CSSが注入されていない場合 → 注入する
        const link = document.createElement('link');
        link.id = cssID;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = 'file=extensions/sd-webui-smartphone-plus/responsive.css';
        document.head.appendChild(link);
        return true
    } else {
        existingLink.remove();
        return false
    }
}
