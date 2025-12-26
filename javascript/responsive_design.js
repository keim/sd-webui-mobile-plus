// 画面上部のInjectパネルの表示/非表示を切り替える
function insertPanel() {
    _initialize();
    _initWordDictionary();
    _setupMenuButtons();
    _addEventListener();
    _insertInteractiveWidget();

    _sspp_updateSizeDisplay();
    _sspp_updateSizeSelector();
    _sspp_updateClipSelector();
    _constructCandidateButtons("__first__")

    console.log("Responsive design CSS injector has been loaded.");
}

// グローバル変数
const _sspp_tabNames = [];
let _sspp_currentTabName = '';
const sspp_sizeList = [];
let sspp_clipList = [];
let sspp_sizeSelectorItem = null;
let sspp_clipSelectorItem = null;
let geminiapi = null;
const sspp_wordDictionary = {};
const sspp_candidateList = {};
let sspp_currentWord = '';


// 初期化処理
function _initialize() {
    // サイズリストとクリップリストをローカルストレージから読み込む
    const sizeListJSON = localStorage.getItem('sspp_size_list');
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
    sspp_sizeSelectorItem = document.querySelector('#sspp-size-selector .selector-item[index="1"]');
    sspp_clipSelectorItem = document.querySelector('#sspp-clip-selector .selector-box[index="1"]');
    if (sspp_sizeSelectorItem) sspp_sizeSelectorItem.remove();
    if (sspp_clipSelectorItem) sspp_clipSelectorItem.remove();

    // Gemini API モジュールの動的インポート
    import("./modules/geminiapi.js").then(module => {
        geminiapi = module.geminiapi();
    }).catch(err => {
        console.error("Failed to load geminiapi module:", err);
    });
}

// 辞書初期化
function _initWordDictionary() {
    const promptHistoryBox = document.getElementById("sspp_prompt_history");
    sspp_clipList = JSON.parse(promptHistoryBox.querySelector("textarea, input").value);
    sspp_wordDictionary['__first__'] = {}
    sspp_clipList.reverse().forEach(([url, posi, nega]) => this._appendWordDictionaryByPrompt(posi));
}

function _splitWords(prompt) {
    return prompt.split(/[\s,()]+|:\s*[\d.]+\s*\)/).map(w=>w.trim().toLowerCase()).filter(w=>w!=='');
}

function _appendWordDictionaryByPrompt(prompt) {
    const words = _splitWords(prompt);

    // 各単語とそのコンテキストを辞書に登録
    words.forEach((word, i) => {
        if (word && !(word in sspp_wordDictionary)) {
            // 新しい単語の場合は辞書を初期化
            sspp_wordDictionary[word] = {};
        } else {
            // 出現した単語の記録済みスコアを0.95倍する
            Object.keys(sspp_wordDictionary[word]).forEach(context => {
                sspp_wordDictionary[word][context] *= 0.95;
            });
        }
        // コンテキスト単語を登録
        for (let c=1; c<=4; c++) {
            const context = words[i + c];
            if (context && !(context in sspp_wordDictionary)) sspp_wordDictionary[context] = {};
            if (context) {
                if (!(context in sspp_wordDictionary[word])) sspp_wordDictionary[word][context] = 0;
                sspp_wordDictionary[word][context] += 5-c;
                if (!(word in sspp_wordDictionary[context])) sspp_wordDictionary[context][word] = 0;
                sspp_wordDictionary[context][word] += 5-c;
            }
        }
        sspp_candidateList[word] = null;
    });
    // 最初と最後の単語も特別に登録
    if (words.length > 0) {
        const cmax = Math.min(4, words.length);
        for (let c=1; c<=cmax; c++) {
            const firstWord = words[c - 1];
            const lastWord = words[words.length - c];
            if (!(firstWord in sspp_wordDictionary['__first__'])) sspp_wordDictionary['__first__'][firstWord] = 0;
            sspp_wordDictionary['__first__'][firstWord] += 5-c;
        }
        sspp_candidateList['__first__'] = null;
    }
}

function sspp_getCandidateList(word) {
    const scores = sspp_wordDictionary[word];
    if (!scores) return [];
    if (!sspp_candidateList[word]) {
        sspp_candidateList[word] = Object.keys(scores).map(word=>({ word, score: scores[word]})).sort((a, b) => b.score - a.score);
    }
    return sspp_candidateList[word];
}

function _onClickCandidate(word) {
    const textArea = _promptArea();
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
    sspp_showCandidateList();
}

function sspp_showCandidateList() {
    const textArea = _promptArea();
    if (!textArea) return;

    const cursor = sspp_wordOps._matchWordAtPosition(textArea.value, textArea.selectionEnd, -1);
    if (!cursor) return;
    const currentWord = textArea.value.substring(cursor.start, cursor.end).trim().toLowerCase();
    if (sspp_currentWord === currentWord) return;
    sspp_currentWord = currentWord;
    _constructCandidateButtons(currentWord)
}

function _constructCandidateButtons(targetWord) {
    const textArea = _promptArea();
    if (!textArea) return;
    const candidates = sspp_getCandidateList(targetWord);
    if (candidates.length === 0) return;
    const candidateDiv = document.getElementById('sspp-candidate');
    candidateDiv.classList.add('hidden');

    const words = _splitWords(textArea.value);
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
        _sspp_updateSizeDisplay();
        panel.classList.toggle("size-select");
    });
    // [Clipboard selector]
    onclick('sspp-clip', e => {
        panel.classList.toggle("clip-select");
    })

    // [Previous word]
    onclick('sspp-prevword', e => {
        sspp_wordOps.selectPrevWord(panel.classList.contains("word-select"));
        sspp_showCandidateList();
    });
    // [Current word]
    onclick('sspp-currword', e => {
        sspp_wordOps.selectWord(panel.classList.contains("word-select"));
        panel.classList.toggle("word-select");
        sspp_showCandidateList();
    });
    // [Next word]
    onclick('sspp-nextword', e => {
        sspp_wordOps.selectNextWord(panel.classList.contains("word-select"));
        sspp_showCandidateList();
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
        const textArea = _promptArea();
        if (textArea) this._appendWordDictionaryByPrompt(textArea.value)
    });

    root.appendChild(panel);
    root.classList.add('config-hidden', 'nega-prompt-hidden');
}

// タブ変更イベントの追加
function _addEventListener() {
    const tabButtons = document.querySelectorAll('#tabs>.tab-nav>button');
    tabButtons.forEach(btn => _sspp_tabNames.push(btn.textContent.trim().toLowerCase()));
    _sspp_currentTabName = _currentTabName();

    const tabsElem = document.getElementById('tabs')

    tabsElem.addEventListener("click", e => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const tabName = btn.textContent.trim().toLowerCase();
        if (!_sspp_tabNames.includes(tabName)) return;
        _sspp_currentTabName = tabName;
        _sspp_updateSizeDisplay();
    });

    tabsElem.addEventListener('keyup', e => {
        const textarea = e.target.closest("textarea");
        if (textarea === _promptArea()) sspp_showCandidateList();
    });
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



// 現在選択されているタブの名前/UIを取得する
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



function sspp_setPrompt(posiPrompt, negaPrompt) {
    const posiPromptArea = _promptArea()
    const negaPromptArea = _negaPromptArea()
    if (posiPromptArea) posiPromptArea.value = posiPrompt
    if (negaPromptArea) negaPromptArea.value = negaPrompt
}

// Size Selector
function sspp_newSize(me) {
    const inputs = me.parentNode.querySelectorAll('input');
    const name = inputs[0].value;
    const width = parseInt(inputs[1].value);
    const height = parseInt(inputs[2].value);
    
    if (!width || !height) {
        alert('Please fill in width and height fields');
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
    const index = me.parentNode.getAttribute('index') - 1;
    const sizeItem = sspp_sizeList[index];
    if (sizeItem) {
        sspp_setSize(sizeItem[1], sizeItem[2]);
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

function sspp_setSize(width, height) {
    const sizeUI = _sizeInputs();
    if (sizeUI) {
        sizeUI[0].value = width;
        sizeUI[0].dispatchEvent(new Event('input', { bubbles: true }));
        sizeUI[1].value = height;
        sizeUI[1].dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('sd-smartphone-plus-panel').classList.remove("size-select");
        _sspp_updateSizeDisplay();
    }
}

function _sspp_updateSizeSelector() {
    const sizeSelector = document.querySelector('#sspp-size-selector>.selector-board');

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

function _sspp_updateSizeDisplay() {
    const size = _sizeInputs();
    if (!size) return;
    const sizeLabel = document.querySelector('#sspp-size>span.sspp-button-label');
    sizeLabel.textContent = `${size[0].value}x${size[1].value}`;
}



// Clipboard Selector
function sspp_selectClip(me) {
    const index = me.getAttribute('index') - 1;
    const clipItem = sspp_clipList[index];
    if (clipItem) {
        sspp_setPrompt(clipItem[1], clipItem[2]);
        sspp_setSize(clipItem[3], clipItem[4]);
    }
}

function _sspp_updateClipSelector() {
    const clipSelector = document.querySelector('#sspp-clip-selector>.selector-board');
    const clipItems = clipSelector.querySelectorAll('.selector-item[index]');
    clipItems.forEach(item => item.remove());
    
    // 新しいクリップアイテムを追加
    if (sspp_clipSelectorItem) {
        sspp_clipList.forEach((prompts, idx) => {
            const clone = sspp_clipSelectorItem.cloneNode(true);
            clone.setAttribute('index', idx + 1);
            clone.setAttribute('style', `background-image:url(${prompts[0]});`);
            clone.setAttribute('onclick', 'sspp_selectClip(this)');
            clipSelector.appendChild(clone);
        });
    }
}

// セレクターを閉じる
function sspp_closeSelector(me) {
    document.getElementById('sd-smartphone-plus-panel').classList.remove('clip-select', 'size-select')    
}



// テキストエリア内の現在の単語を選択/解除する
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
        const textArea = _promptArea();
        if (!textArea) return;
        const cursor = this._matchWordAtPosition(textArea.value, textArea.selectionStart);
        if (cursor) textArea.setSelectionRange(cursor.start, cursor.end);
        textArea.focus();
    }
    
    _unselectWord() {
        const textArea = _promptArea();
        if (!textArea) return;
        const pos = textArea.selectionStart;
        textArea.setSelectionRange(pos, pos);
        textArea.focus();
    }

    selectPrevWord(hold) {
        const textArea = _promptArea();
        if (!textArea) return;
        const cursor = this._matchWordAtPosition(textArea.value, textArea.selectionStart, -1);
        if (cursor) textArea.setSelectionRange(cursor.start, hold ? textArea.selectionEnd : cursor.end);
        textArea.focus();
    }
    
    selectNextWord(hold) {
        const textArea = _promptArea();
        if (!textArea) return;
        const cursor = this._matchWordAtPosition(textArea.value, textArea.selectionEnd, 1);
        if (cursor) textArea.setSelectionRange(hold ? textArea.selectionStart : cursor.start, cursor.end);
        textArea.focus();
    }

    changerate(rateGain) {
        const textArea = _promptArea();
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
        const textArea = _promptArea();
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
function _sspp_toggleResponsiveCSS() {
    const cssID = 'responsive-design-css';
    const existingLink = document.getElementById(cssID);
    
    if (!existingLink) {
        const link = document.createElement('link');
        link.id = cssID;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = `file=extensions/sd-webui-mobile-plus/responsive.css?n=${(Math.random()*10000)>>0}`;
        document.head.appendChild(link);
        return true
    } else {
        existingLink.remove();
        return false
    }
}
