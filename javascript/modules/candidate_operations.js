// 入力候補辞書操作
export class CandidateOperations {
    constructor(uiController) {
        this.uiController = uiController;
        this._wordDictionary = {};
        this._candidateList = {};
        this._currentWord = "";
        this._targetText = "";
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
                Object.keys(this._wordDictionary[word]).forEach((context) => {
                    this._wordDictionary[word][context] *= 0.95;
                });
            }
            // コンテキスト単語を登録
            for (let c = 1; c <= 4; c++) {
                const context = words[i + c];
                if (context && !(context in this._wordDictionary)) this._wordDictionary[context] = {};
                if (context) {
                    if (!(context in this._wordDictionary[word])) this._wordDictionary[word][context] = 0;
                    this._wordDictionary[word][context] += 5 - c;
                    if (!(word in this._wordDictionary[context])) this._wordDictionary[context][word] = 0;
                    this._wordDictionary[context][word] += 5 - c;
                }
            }
            // 遅延して候補リストを更新（スコアの減衰と新しいコンテキストの追加を反映）
            this._candidateList[word] = null;
        });
        // 最初と最後の単語も特別に登録
        if (words.length > 0) {
            const cmax = Math.min(4, words.length);
            for (let c = 1; c <= cmax; c++) {
                const firstWord = words[c - 1];
                if (!(firstWord in this._wordDictionary.__first__)) this._wordDictionary.__first__[firstWord] = 0;
                this._wordDictionary.__first__[firstWord] += 5 - c;
            }
            this._candidateList.__first__ = null;
        }
    }

    _splitWords(prompt) {
        return prompt
            .split(/[\s,()]+|:\s*[\d.]+\s*\)/)
            .map((w) => w.trim().toLowerCase())
            .filter((w) => w !== "");
    }

    getCandidates(targetText) {
        const scores = this._wordDictionary[targetText];
        if (!scores) {
            // 辞書にない単語は、これまでの候補リストから部分一致するものを返す
            if (this._currentWord in this._candidateList) {
                return this._candidateList[this._currentWord].filter(item => item.word.startsWith(targetText));
            }
            return [];
        }

        // 辞書にある単語は、そのスコアに基づいて候補リストを生成
        this._currentWord = targetText;
        if (!this._candidateList[targetText]) {
            this._candidateList[targetText] = Object.keys(scores)
                .map((candidateWord) => ({ word: candidateWord, score: scores[candidateWord] }))
                .sort((a, b) => b.score - a.score);
        }
        return this._candidateList[targetText];
    }

    // 入力候補の表示
    show() {
        const textArea = this.uiController.lastPromptArea();
        if (!textArea) return;
        const cursor = this.uiController._matchWordAtPosition(textArea.value, textArea.selectionEnd, -1);
        if (!cursor) return;
        let targetText = textArea.value.substring(cursor.start, cursor.end).trim().toLowerCase();
        // targetText が空白だったら、__first__ の候補を表示
        if (targetText === "") targetText = "__first__";
        if (this._targetText === targetText) return;
        this._targetText = targetText;

        this.updateCandidateButtons(targetText);
    }

    // 入力候補ボタンの更新
    updateCandidateButtons(targetText) {
        const onClickCandidate = (word) => {
            const textArea = this.uiController.lastPromptArea();
            if (!textArea) return;
            const cursor = this.uiController._matchWordAtPosition(textArea.value, textArea.selectionEnd, -1) || {
                start: textArea.selectionEnd,
                end: textArea.selectionEnd,
            };
            let targetText = textArea.value.substring(cursor.start, cursor.end).trim().toLowerCase();
            const before = textArea.value.substring(0, cursor.end - (word.startsWith(targetText) ? targetText.length : 0));
            const after = textArea.value.substring(cursor.end);
            let insertWord = word;
            if (before && !/\s$/.test(before)) insertWord = ` ${insertWord}`;
            if (after && !/^\s/.test(after)) insertWord = `${insertWord} `;
            textArea.value = before + insertWord + after;
            textArea.dispatchEvent(new Event("input", { bubbles: true }));
            const pos = before.length + insertWord.length;
            textArea.setSelectionRange(pos, pos);
            textArea.focus();
            setTimeout(() => this.show(), 1000);
        };

        const textArea = this.uiController.lastPromptArea();
        if (!textArea) return;

        const candidates = this.getCandidates(targetText);

        const candidateDiv = document.getElementById("sspp-candidate");
        candidateDiv.classList.add("hidden");

        const words = this._splitWords(textArea.value);
        candidateDiv.classList.remove("hidden");
        candidateDiv.innerHTML = "";
        let count = 0;
        let i = 0;
        while (count < 6 && i < candidates.length) {
            const item = candidates[i++];
            // 既にプロンプト内に存在する単語は候補から除外
            // if (words.includes(item.word)) continue;
            const btn = document.createElement("button");
            btn.textContent = item.word;
            btn.className = "helper";
            btn.addEventListener("click", () => onClickCandidate(item.word));
            candidateDiv.appendChild(btn);
            count++;
        }
    }
}
