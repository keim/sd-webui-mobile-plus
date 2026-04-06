// サイズセレクター操作クラス
export class SizeSelector {
    constructor(uiController) {
        this.uiController = uiController;
        this._el = null;
        this._widthSelect = null;
        this._blockInput = null;
        this._aspectButtons = [];
        this._selectedAspectButton = null;
        this._aspectCanvas = null;
    }

    initialize() {
        // DOM要素の取得
        this._el = document.getElementById("sspp-size-selector");
        if (!this._el) return;

        this._widthSelect = document.getElementById("sspp-width-select");
        this._blockInput = document.getElementById("sspp-block-input");
        this._aspectCanvas = document.getElementById("sspp-aspect-canvas");
        this._aspectButtons = Array.from(this._el.querySelectorAll("button.sspp-aspect-button"));

        if (this._widthSelect) {
            this._widthSelect.addEventListener("change", () => this._onAspectInputChange());
        }
        if (this._blockInput) {
            this._blockInput.addEventListener("input", () => this._onAspectInputChange());
        }

        this._aspectButtons.forEach((button) => {
            button.addEventListener("click", () => this._onAspectButtonClick(button));
        });

        const defaultAspectButton = this._el.querySelector(".sspp-aspect-1-1");
        if (defaultAspectButton) {
            this._setActiveAspectButton(defaultAspectButton);
            this._renderAspectPreview(this._getSelectedAspectRatio());
        }
    }


    _onAspectButtonClick(button) {
        this._setActiveAspectButton(button);
        this._applyAspectSelection();
    }

    _onAspectInputChange() {
        if (!this._selectedAspectButton) return;
        this._applyAspectSelection();
    }

    _applyAspectSelection() {
        const ratio = this._getSelectedAspectRatio();
        const squareWidth = Number.parseInt(this._widthSelect?.value ?? "", 10);
        const blockSize = Number.parseInt(this._blockInput?.value ?? "", 10);

        if (!ratio || !Number.isFinite(squareWidth) || squareWidth <= 0 || !Number.isFinite(blockSize) || blockSize <= 0) {
            return;
        }

        const [widthRatio, heightRatio] = ratio;
        const { width, height } = this._calculateAspectSize(squareWidth, blockSize, widthRatio, heightRatio);

        this.uiController.setupSizeProps(width, height);
        this.uiController.updateSizeLabel();
        this._renderAspectPreview(ratio, width, height);
    }

    _setActiveAspectButton(button) {
        this._aspectButtons.forEach((aspectButton) => {
            const isActive = aspectButton === button;
            aspectButton.classList.toggle("selected", isActive);
            aspectButton.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
        this._selectedAspectButton = button;
    }

    _getSelectedAspectRatio() {
        const aspectName = this._selectedAspectButton?.dataset.aspect ?? "";
        const matches = aspectName.match(/^aspect(\d+)-(\d+)$/);
        if (!matches) return null;
        return [Number.parseInt(matches[1], 10), Number.parseInt(matches[2], 10)];
    }

    _calculateAspectSize(squareWidth, blockSize, widthRatio, heightRatio) {
        const area = squareWidth * squareWidth;
        const aspectRatio = widthRatio / heightRatio;
        const width = Math.max(blockSize, Math.round(Math.sqrt(area * aspectRatio) / blockSize) * blockSize);
        const height = Math.max(blockSize, Math.round(Math.sqrt(area / aspectRatio) / blockSize) * blockSize);
        return { width, height };
    }

    _renderAspectPreview(ratio, width = null, height = null) {
        if (!this._aspectCanvas || !ratio) return;

        const context = this._aspectCanvas.getContext("2d");
        if (!context) return;

        const canvasWidth = this._aspectCanvas.width;
        const canvasHeight = this._aspectCanvas.height;
        const [widthRatio, heightRatio] = ratio;
        const previewRatio = widthRatio / heightRatio;
        const padding = 32;
        const availableWidth = canvasWidth - padding * 2;
        const availableHeight = canvasHeight - padding * 2;

        let rectWidth = availableWidth;
        let rectHeight = rectWidth / previewRatio;
        if (rectHeight > availableHeight) {
            rectHeight = availableHeight;
            rectWidth = rectHeight * previewRatio;
        }

        const x = (canvasWidth - rectWidth) / 2;
        const y = (canvasHeight - rectHeight) / 2;

        context.clearRect(0, 0, canvasWidth, canvasHeight);
        context.fillStyle = "#f7f7f7";
        context.fillRect(0, 0, canvasWidth, canvasHeight);

        context.strokeStyle = "#d0d0d0";
        context.lineWidth = 1;
        for (let index = 1; index < 4; index++) {
            const guideX = padding + (availableWidth / 4) * index;
            const guideY = padding + (availableHeight / 4) * index;
            context.beginPath();
            context.moveTo(guideX, padding);
            context.lineTo(guideX, canvasHeight - padding);
            context.stroke();
            context.beginPath();
            context.moveTo(padding, guideY);
            context.lineTo(canvasWidth - padding, guideY);
            context.stroke();
        }

        context.fillStyle = "#dbeafe";
        context.fillRect(x, y, rectWidth, rectHeight);
        context.strokeStyle = "#2563eb";
        context.lineWidth = 4;
        context.strokeRect(x, y, rectWidth, rectHeight);

        context.fillStyle = "#1f2937";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = "bold 28px sans-serif";
        context.fillText(`${widthRatio}:${heightRatio}`, canvasWidth / 2, canvasHeight / 2 - 18);

        if (width && height) {
            context.font = "24px sans-serif";
            context.fillText(`${width} x ${height}`, canvasWidth / 2, canvasHeight / 2 + 22);
        }
    }
}
