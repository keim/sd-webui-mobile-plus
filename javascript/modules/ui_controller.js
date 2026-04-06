// SDwebui 由来のUI操作クラス (※webui 側の更新で動作しなくなる可能性あり。)
export class UIController {
    constructor(fileInfoAPI) {
        // UI要素のセレクタを定義
        this.radios = {
            resize_mode: "#resize_mode input[name=radio-resize_mode]",
            img2img_mask_mode: "#img2img_mask_mode input[name=radio-img2img_mask_mode]",
            img2img_inpainting_fill: "#img2img_inpainting_fill input[name=radio-img2img_inpainting_fill]",
            img2img_inpaint_full_res: "#img2img_inpaint_full_res input[name=radio-img2img_inpaint_full_res]",
        };
        this.textareas = {
            txt2img_prompt: "#txt2img_prompt textarea",
            txt2img_neg_prompt: "#txt2img_neg_prompt textarea",
            img2img_prompt: "#img2img_prompt textarea",
            img2img_neg_prompt: "#img2img_neg_prompt textarea",
        };
        this.inputs = {
            txt2img_sampling: "#txt2img_sampling input",
            txt2img_scheduler: "#txt2img_scheduler input",
            txt2img_steps: "#txt2img_steps input",
            txt2img_width: "#txt2img_width input",
            txt2img_height: "#txt2img_height input",
            txt2img_batch_count: "#txt2img_batch_count input",
            txt2img_batch_size: "#txt2img_batch_size input",
            txt2img_cfg_scale: "#txt2img_cfg_scale input",
            txt2img_seed: "#txt2img_seed input",
            txt2img_subseed_show: "#txt2img_subseed_show input",
            txt2img_subseed: "#txt2img_subseed input",
            txt2img_subseed_strength: "#txt2img_subseed_strength input",
            txt2img_seed_resize_from_w: "#txt2img_seed_resize_from_w input",
            txt2img_seed_resize_from_h: "#txt2img_seed_resize_from_h input",
            txt2img_script_list: "#txt2img_script_container #script_list input",

            img2img_inpaint_full_res_padding: "#img2img_inpaint_full_res_padding input",
            "soft_inpainting_enabled-visible-checkbox": "#soft_inpainting_enabled-visible-checkbox input",
            mask_blend_power: "#mask_blend_power input",
            mask_blend_scale: "#mask_blend_scale input",
            inpaint_detail_preservation: "#inpaint_detail_preservation input",

            img2img_mask_blur: "#img2img_mask_blur input",
            img2img_mask_alpha: "#img2img_mask_alpha input",
            img2img_sampling: "#img2img_sampling input",
            img2img_scheduler: "#img2img_scheduler input",
            img2img_steps: "#img2img_steps input",
            img2img_width: "#img2img_width input",
            img2img_height: "#img2img_height input",
            img2img_scale: "#img2img_scale input",
            img2img_batch_count: "#img2img_batch_count input",
            img2img_batch_size: "#img2img_batch_size input",
            img2img_cfg_scale: "#img2img_cfg_scale input",
            img2img_seed: "#img2img_seed input",
            img2img_subseed_show: "#img2img_subseed_show input",
            img2img_subseed: "#img2img_subseed input",
            img2img_subseed_strength: "#img2img_subseed_strength input",
            img2img_seed_resize_from_w: "#img2img_seed_resize_from_w input",
            img2img_seed_resize_from_h: "#img2img_seed_resize_from_h input",
            img2img_script_list: "#img2img_script_container #script_list input",
        };
        this.uis = {
            txt2img_hires: "#txt2img_hr",
            txt2img_refiner: "#txt2img_enable",
            img2img_refiner: "#img2img_enable",
        };

        this._tabNames = [];
        this._lastPromptArea = null;
        this._eventReciever = null;

        this.fileInfoAPI = fileInfoAPI;
    }

    root() {
        return document.getElementsByClassName("contain")[0];
    }

    panel() {
        return document.getElementById("sd-smartphone-plus-panel");
    }

    changePanelUIType(type) {
        const newType = this.root().getAttribute("uitype") === type ? "default" : type;
        this.root().setAttribute("uitype", newType);
        const extraTabName = newType === "checkpoints" || newType === "lora" ? newType : "generation";
        const tab = this.extraTabs(extraTabName);
        if (tab) tab.click();
        return newType;
    }

    changeSubMenuType(submenu) {
        const newSubmenu = this.panel().getAttribute("submenu") === submenu ? "default" : submenu;
        this.panel().setAttribute("submenu", newSubmenu);
        return newSubmenu;
    }

    toggleSubmenu() {
        this.panel().classList.toggle("menu-opened");
        if (this.panel().classList.contains("menu-opened")) {
            this.updateSizeLabel();
        } else {
            this.changeSubMenuType("default");
            this.changePanelUIType("default");
        }
    }

    initialize() {
        // タブ名の取得
        this._tabNames = [];
        const tabButtons = document.querySelectorAll("#tabs>.tab-nav>button");
        tabButtons.forEach((btn) => this._tabNames.push(btn.textContent.trim().toLowerCase()));

        // イベント受け取り要素(gradioで再レンダリングの影響を受けない要素)の取得
        this._eventReciever = document; // document.getElementById("tabs");

        // タブ切り替え時のイベントリスナー登録
        this.addEventListener("#tabs>.tab-nav>button", "click", () => {
            this.updateSizeLabel();
        });

        // プロンプトエリアへのフォーカス追跡
        const promptAreas = document.querySelectorAll("#txt2img_prompt textarea, #txt2img_neg_prompt textarea, #img2img_prompt textarea, #img2img_neg_prompt textarea");
        promptAreas.forEach((textarea) => {
            textarea.addEventListener("focusin", () => {
                this._lastPromptArea = textarea;
            });
        });

        // パネルUIタイプ初期化
        this.root().setAttribute("uitype", "default");

        // accept属性の削除（スマホのファイル選択でアクセスフォルダを限定させない）
        document.querySelectorAll("input[accept]").forEach((input) => {
            input.removeAttribute("accept");
        });

        // ドロップダウンUIにreadonly属性を付与して、ソフトウェアキーボード出現を抑制
        document.querySelector("#txt2img_styles input").setAttribute("readonly", "true");
        document.querySelector("#txt2img_sampling input").setAttribute("readonly", "true");
        document.querySelector("#txt2img_scheduler input").setAttribute("readonly", "true");
        document.querySelector("#img2img_styles input").setAttribute("readonly", "true");
        document.querySelector("#img2img_sampling input").setAttribute("readonly", "true");
        document.querySelector("#img2img_scheduler input").setAttribute("readonly", "true");
    }

    // UIController 経由でイベントリスナーを登録
    addEventListener(query, event, handler) {
        if (this._eventReciever) {
            this._eventReciever.addEventListener(event, (e => {
                const target = e.target.closest(query);
                if (target) handler(e, target);
            }));
        }
    }

    // サーバサイドからプロンプト履歴を受け取る
    getPromptHistory() {
        const promptHistoryBox = document.getElementById("sspp_prompt_history");
        if (!promptHistoryBox) return [];
        return JSON.parse(promptHistoryBox.querySelector("textarea, input").value);
    }

    // 現在のタブ名を取得
    currentTabName() {
        return document.querySelector("#tabs button.selected").textContent.trim().toLowerCase();
    }

    // txt2img と img2img のプロンプト入力要素を取得
    promptArea() {
        const tabName = this.currentTabName();
        if (tabName !== "txt2img" && tabName !== "img2img") return null;
        return document.querySelector(`#${tabName}_prompt textarea`);
    }

    // txt2img と img2img のネガティブプロンプト入力要素を取得
    negaPromptArea() {
        const tabName = this.currentTabName();
        if (tabName !== "txt2img" && tabName !== "img2img") return null;
        return document.querySelector(`#${tabName}_neg_prompt textarea`);
    }

    // 最後にフォーカスが当たったプロンプトエリアを取得
    lastPromptArea() {
        if (this._lastPromptArea && this._lastPromptArea.closest("body")) {
            return this._lastPromptArea;
        }
        return this.promptArea() ?? this.negaPromptArea();
    }

    // text 内の position 位置にある単語を特定する（directionFlag: -1=前方検索, 1=後方検索）
    _matchWordAtPosition(text, position, directionFlag = 0) {
        const re = /[^\s,():]+|:\s*[\d.]+/g;
        let prevStart = 0;
        let prevEnd = 0;
        position = Math.max(0, Math.min(position + directionFlag, text.length));
        for (let match; (match = re.exec(text)) !== null;) {
            const start = match.index;
            const end = start + match[0].length;
            if (position <= end) {
                if (start <= position) return { start, end };
                if (directionFlag < 0) return { start: prevStart, end: prevEnd };
                if (directionFlag > 0) return { start, end };
                return null;
            }
            prevStart = start;
            prevEnd = end;
        }
        return directionFlag < 0 ? { start: prevStart, end: prevEnd } : null;
    }

    // txt2img と img2img のサイズ入力要素を取得
    sizeInputs() {
        const tabName = this.currentTabName();
        if (tabName === "txt2img" || tabName === "img2img") return [
            document.querySelector(`#${tabName}_width input`),
            document.querySelector(`#${tabName}_height input`),
        ];
        if (tabName === "extras") return [
            document.querySelector(`#extras_upscaling_resize_w input`),
            document.querySelector(`#extras_upscaling_resize_h input`),
        ];
    }

    // アスペクト比ボタンのラベルを更新
    updateSizeLabel() {
        const size = this.sizeInputs();
        if (!size) return;
        const sizeLabel = document.querySelector("#sspp-size>span.sspp-button-label");
        if (sizeLabel) sizeLabel.textContent = `${size[0].value}x${size[1].value}`;
    }

    // txt2img と img2img の追加タブ要素を取得
    extraTabs(tab) {
        const tabName = this.currentTabName();
        if (tabName !== "txt2img" && tabName !== "img2img") return null;
        const tabs = document.querySelectorAll(`#${tabName}_extra_tabs>.tab-nav>button`);
        let tabElems = null;
        tabs.forEach((btn) => {
            if (btn.textContent.trim().toLowerCase() === tab) tabElems = btn;
        });
        return tabElems;
    }

    // img2img のファイル入力要素を取得
    img2imgFileInput() {
        const selectors = [
            "#img2img_image input[type=\"file\"]",
            "#img2img_img2img_tab input[type=\"file\"]",
            "#img2img input[type=\"file\"]",
        ];
        for (const selector of selectors) {
            const input = document.querySelector(selector);
            if (input) return input;
        }
        return null;
    }

    // URL画像をimg2imgのファイル入力に登録
    async setImg2ImgImageFromUrl(imageUrl) {
        const fileInput = this.img2imgFileInput();
        if (!fileInput || !imageUrl) return false;

        const isSameOrigin = (url) => {
            try {
                return new URL(url).origin === location.origin;
            } catch {
                return true;
            }
        };

        let response;
        if (isSameOrigin(imageUrl)) {
            response = await fetch(imageUrl);
        } else {
            response = await this.fileInfoAPI.fetchProxyImage(imageUrl);
            if (!response.ok) {
                // プロキシ失敗時は直接取得を試す（CORSで失敗する可能性あり）
                response = await fetch(imageUrl);
            }
        }
        if (!response.ok) return false;

        const blob = await response.blob();
        if (!blob.type || !blob.type.startsWith("image/")) return false;

        const rawName = imageUrl.split("/").pop() || "image";
        const safeName = (rawName.split("?")[0] || "image").replace(/[^a-zA-Z0-9._-]/g, "_");
        const ext = blob.type.split("/")[1] || "png";
        const fileName = /\.[a-zA-Z0-9]+$/.test(safeName) ? safeName : `${safeName}.${ext}`;

        const file = new File([blob], fileName, { type: blob.type });
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        fileInput.dispatchEvent(new Event("input", { bubbles: true }));

        return true;
    }

    // txt2img、img2img、extras タブで生成を実行
    generate() {
        const tabName = this.currentTabName();
        if (tabName !== "txt2img" && tabName !== "img2img" && tabName !== "extras") return false;
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
            inputElem.dispatchEvent(new Event("input", { bubbles: true }));
        }
    }

    // SDGeneratedImage オブジェクトのパラメータを WebUI に反映
    async applyImageData(image) {
        if (!image) return;

        if (image.positive_prompt && image.negative_prompt) {
            this.setupPrompt(image.positive_prompt, image.negative_prompt);
        }
        if (image.width && image.height) {
            this.setupSizeProps(image.width, image.height);
        }

        const tabName = this.currentTabName();
        if (tabName !== "txt2img" && tabName !== "img2img") return;

        const parameterMap = [
            { key: `${tabName}_steps`, value: image.steps },
            { key: `${tabName}_sampling`, value: image.sampler },
            { key: `${tabName}_cfg_scale`, value: image.cfg_scale },
            { key: `${tabName}_seed`, value: image.seed },
            { key: `${tabName}_scheduler`, value: image.schedule_type },
        ];

        parameterMap.forEach(({ key, value }) => {
            if (value !== null && value !== undefined) {
                this._setInputValue(key, value);
            }
        });

        if (tabName === "img2img" && image.url) {
            await this.setImg2ImgImageFromUrl(image.url);
        }
    }

    // inputs オブジェクト内のキーを指定してパラメータを設定
    _setInputValue(inputKey, value) {
        const selector = this.inputs[inputKey];
        if (!selector) return;
        const elem = document.querySelector(selector);
        this._updateValue(elem, value);
    }
}
