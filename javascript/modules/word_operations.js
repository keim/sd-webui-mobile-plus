// テキストエリア内の単語操作
export class WordOperations {
    constructor(uiController) {
        this.uiController = uiController;
    }

    selectWord(hold) {
        if (hold) this._unselectWord();
        else this._selectCurrentWord();
    }


    _selectCurrentWord() {
        const textArea = this.uiController.lastPromptArea();
        if (!textArea) return;
        const cursor = this.uiController._matchWordAtPosition(textArea.value, textArea.selectionStart);
        if (cursor) textArea.setSelectionRange(cursor.start, cursor.end);
        textArea.focus();
    }

    _unselectWord() {
        const textArea = this.uiController.lastPromptArea();
        if (!textArea) return;
        const pos = textArea.selectionStart;
        textArea.setSelectionRange(pos, pos);
        textArea.focus();
    }

    selectPrevWord(hold) {
        const textArea = this.uiController.lastPromptArea();
        if (!textArea) return;
        const cursor = this.uiController._matchWordAtPosition(textArea.value, textArea.selectionStart, -1);
        if (cursor) textArea.setSelectionRange(cursor.start, hold ? textArea.selectionEnd : cursor.end);
        textArea.focus();
    }

    selectNextWord(hold) {
        const textArea = this.uiController.lastPromptArea();
        if (!textArea) return;
        const cursor = this.uiController._matchWordAtPosition(textArea.value, textArea.selectionEnd, 1);
        if (cursor) textArea.setSelectionRange(hold ? textArea.selectionStart : cursor.start, cursor.end);
        textArea.focus();
    }

    changeRate(rateGain) {
        const textArea = this.uiController.lastPromptArea();
        if (!textArea) return;
        this._selectCurrentWord();
        const text = textArea.value;
        const before = text.substring(0, textArea.selectionStart);
        const after = text.substring(textArea.selectionStart);
        const match = after.match(/:?(\s*)([\d.]+)?(\s*\))/);
        if (match) {
            const rate = (match[2] ? parseFloat(match[2]) || 0 : 1.1) + rateGain;
            const rateText = `:${match[1]}${rate < 0 ? 0 : rate.toFixed(1)}`;
            const newAfter =
                after.slice(0, match.index) +
                rateText +
                match[3] +
                after.slice(match.index + match[0].length);
            textArea.value = before + newAfter;
            textArea.dispatchEvent(new Event("input", { bubbles: true }));
            const start = before.length + match.index;
            textArea.setSelectionRange(start, start + rateText.length);
            textArea.focus();
        }
    }

    emphasize() {
        const textArea = this.uiController.lastPromptArea();
        if (!textArea) return;
        if (textArea.selectionStart === textArea.selectionEnd) this._selectCurrentWord();
        
        const text = textArea.value;
        const before = text.substring(0, textArea.selectionStart);
        const content = text.substring(textArea.selectionStart, textArea.selectionEnd);
        const after = text.substring(textArea.selectionEnd);

        const contentR = content.replaceAll(/[<>()]|:\s*[\d.]+/g, "");

        const newBefore = before.replace(/^(.*)\((?!.*[)>])([^(]*)$/s, "$1$2");
        const newContent = /^\([^<>()]*\)$/s.test(content) ? contentR : `(${contentR})`;
        const newAfter = after.replace(/^([^<(]*?)[:.\d\s]*\)(.*)$/s, "$1$2");

        textArea.value = newBefore + newContent + newAfter;
        textArea.dispatchEvent(new Event("input", { bubbles: true }));
        textArea.setSelectionRange(newBefore.length, newBefore.length + newContent.length);
        textArea.focus();
    }
}
