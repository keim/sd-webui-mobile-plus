// テキストセレクター操作クラス
export class TextSelector {
    constructor(uiController) {
        this.uiController = uiController;

        // テキストリストの初期化
        const textListJSON = localStorage.getItem("sspp_text_list");
        if (textListJSON) {
            this._list = JSON.parse(textListJSON);
        } else {
            // デフォルトテキストリスト
            this._list = [""];
        }

        this._el = null;
        this._elItem = null;
    }

    initialize() {
        // DOM要素の取得
        this._el = document.getElementById("sspp-text-selector");
        if (!this._el) return;

        this._elItem = this._el.querySelector('.sspp-text-item[index="1"]');
        if (this._elItem) this._elItem.remove();

        this.refresh();
        this.updateToggleStates();
    }

    // テキストリストの更新とUIの再描画
    refresh() {
        if (!this._el || !this._elItem) return;

        // テキストアイテムを追加する関数
        const _appendNewTextItem = (index, text) => {
            if (!this._el || !this._elItem) return;
            const clone = this._elItem.cloneNode(true);
            clone.setAttribute("index", index + 1);

            const labelBtn = clone.querySelector(".sspp-text-item-label");
            if (labelBtn) {
                labelBtn.textContent = text || "　";
                labelBtn.addEventListener("click", () => this._onSelectText(index));
            }

            const editBtn = clone.querySelector(".sspp-text-item-edit");
            if (editBtn) {
                editBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this._onEditText(index);
                });
            }

            this._el.appendChild(clone);
        }

        // 既存のテキストアイテムをクリア
        const textItems = this._el.querySelectorAll(".sspp-text-item[index]");
        textItems.forEach((item) => item.remove());

        // テキストリストから新しいテキストアイテムを追加
        this._list.forEach((text, index) => {
            _appendNewTextItem(index, text);
        });

        // 空テキストアイテムがないのであれば追加
        if (!this._list.some((text) => text === "")) {
            this._list.push("");
            _appendNewTextItem(this._list.length - 1, "");
            this._saveList();
        }

        this.updateToggleStates();
    }

    // プロンプトエリアの内容に応じてテキストアイテムのトグル状態を更新
    updateToggleStates() {
        if (!this._el) return;

        const targetArea = this.uiController.lastPromptArea();
        const promptValue = targetArea?.value || "";
        const textItems = this._el.querySelectorAll(".sspp-text-item[index]");

        textItems.forEach((itemElem) => {
            const index = Number.parseInt(itemElem.getAttribute("index"), 10) - 1;
            const text = this._list[index] || "";
            const isToggled = text !== "" && this._findPromptTextMatch(promptValue, text) !== null;
            itemElem.classList.toggle("is-toggled", isToggled);
        });
    }

    // テキストを追加または更新
    addText(text) {
        // 空白をトリムしたテキストが空であれば何もしない
        const trimmedText = (text || "").trim();
        if (trimmedText === "") return;

        // 既に同じテキストが存在するのであれば何もしない
        if (this._list.includes(trimmedText)) return;

        // 最後の空テキストがあれば置き換え、なければ追加
        const emptyIndex = this._list.findIndex((t) => t === "");
        if (emptyIndex > -1) {
            this._list[emptyIndex] = trimmedText;
        } else {
            this._list.push(trimmedText);
        }

        this._saveList();
        this.refresh();
    }

    // 指定したインデックスのテキストを更新
    updateTextAt(index, text) {
        // インデックスが範囲外であれば何もしない
        if (index < 0 || index >= this._list.length) return;

        const trimmedText = (text || "").trim();
        if (trimmedText === "") {
            // 空文字の場合は削除
            this._list.splice(index, 1);
        } else {
            // 空でない場合は更新
            this._list[index] = trimmedText;
        }

        this._saveList();
        this.refresh();
    }

    // テキストアイテムが選択されたときの処理
    _onSelectText(index) {
        // インデックスに対応するテキストを取得
        const text = this._list[index];
        console.log("いんでっくすクリック:", text === "");
        if (text === "") {
            console.log("空文字クリック")
            this._onEditText(index);
            return;
        }

        // 直前にフォーカスが当たっていたプロンプトエリアを取得
        const targetArea = this.uiController.lastPromptArea();
        if (!targetArea) return;

        const currentValue = targetArea.value || "";

        // 既に同じテキストが含まれている場合は削除（トグル動作）
        const matchedText = this._findPromptTextMatch(currentValue, text);
        if (matchedText) {
            const matchStart = matchedText.index;
            const matchEnd = matchStart + matchedText[0].length;
            const newValue = currentValue.slice(0, matchStart) + currentValue.slice(matchEnd);
            this.uiController._updateValue(targetArea, newValue);
            targetArea.focus();
            targetArea.setSelectionRange(matchStart, matchStart);
            // Android: ソフトウェアキーボード表示を抑制
            targetArea.blur();
            this.updateToggleStates();
            return;
        }

        // 含まれていない場合はカーソル位置へ挿入
        const selectionStart = targetArea.selectionStart ?? currentValue.length;
        const selectionEnd = targetArea.selectionEnd ?? currentValue.length;
        const needsLeadingSpace = selectionStart > 0 && currentValue[selectionStart - 1] !== " ";
        const insertText = `${needsLeadingSpace ? " " : ""}${text}`;
        const newValue = currentValue.slice(0, selectionStart) + insertText + currentValue.slice(selectionEnd);
        this.uiController._updateValue(targetArea, newValue);
        const nextCaret = selectionStart + insertText.length;
        targetArea.focus();
        targetArea.setSelectionRange(nextCaret, nextCaret);
        // Android: ソフトウェアキーボード表示を抑制
        targetArea.blur();
        this.updateToggleStates();
    }

    _onEditText(index) {
        const currentText = this._list[index];
        const newText = prompt("テキストを編集:", currentText);

        // キャンセル
        if (newText === null) return;

        this.updateTextAt(index, newText);
    }

    _saveList() {
        localStorage.setItem("sspp_text_list", JSON.stringify(this._list));
    }

    _findPromptTextMatch(promptValue, text) {
        const searchPattern = this._buildPromptTextRegex(text);
        if (!searchPattern) return null;
        return searchPattern.exec(promptValue);
    }

    _buildPromptTextRegex(text) {
        const trimmedText = (text || "").trim();
        if (trimmedText === "") return null;

        const pattern = this._buildFlexibleSearchPattern(
            trimmedText.replace(/:\s*[\d.]+(?=\s*[)>])/g, "__SSPP_OPTIONAL_EMPHASIS__")
        );

        return new RegExp(pattern);
    }

    _buildFlexibleSearchPattern(text) {
        return text
            .split(/(__SSPP_OPTIONAL_EMPHASIS__|[,\s]+)/)
            .filter((part) => part !== "")
            .map((part) => {
                if (part === "__SSPP_OPTIONAL_EMPHASIS__") return "(?:\\s*:\\s*[\\d.]+)?";
                return /[ ,\s]+/.test(part) ? "[,\\s]+" : this._escapeRegExp(part);
            })
            .join("");
    }

    _escapeRegExp(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
}
