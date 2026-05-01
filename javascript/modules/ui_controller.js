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
            txt2img_edit_style_prompt: "#txt2img_edit_style_prompt textarea",
            txt2img_edit_style_neg_prompt: "#txt2img_edit_style_neg_prompt textarea",
            img2img_edit_style_prompt: "#img2img_edit_style_prompt textarea",
            img2img_edit_style_neg_prompt: "#img2img_edit_style_neg_prompt textarea",
        };
        this.inputs = {
            txt2img_sampler: "#txt2img_sampling input",
            txt2img_schedule_type: "#txt2img_scheduler input",
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
            txt2img_styles: "#txt2img_styles input",
            txt2img_styles_edit_select: "#txt2img_styles_edit_select input",
            txt2img_script_list: "#txt2img_script_container #script_list input",

            img2img_inpaint_full_res_padding: "#img2img_inpaint_full_res_padding input",
            "soft_inpainting_enabled-visible-checkbox": "#soft_inpainting_enabled-visible-checkbox input",
            mask_blend_power: "#mask_blend_power input",
            mask_blend_scale: "#mask_blend_scale input",
            inpaint_detail_preservation: "#inpaint_detail_preservation input",

            img2img_mask_blur: "#img2img_mask_blur input",
            img2img_mask_alpha: "#img2img_mask_alpha input",
            img2img_sampler: "#img2img_sampling input",
            img2img_schedule_type: "#img2img_scheduler input",
            img2img_steps: "#img2img_steps input",
            img2img_width: "#img2img_width input",
            img2img_height: "#img2img_height input",
            img2img_scale: "#img2img_scale input",
            img2img_batch_count: "#img2img_batch_count input",
            img2img_batch_size: "#img2img_batch_size input",
            img2img_cfg_scale: "#img2img_cfg_scale input",
            img2img_denoising_strength: "#img2img_denoising_strength input",
            img2img_seed: "#img2img_seed input",
            img2img_subseed_show: "#img2img_subseed_show input",
            img2img_subseed: "#img2img_subseed input",
            img2img_subseed_strength: "#img2img_subseed_strength input",
            img2img_seed_resize_from_w: "#img2img_seed_resize_from_w input",
            img2img_seed_resize_from_h: "#img2img_seed_resize_from_h input",
            img2img_styles: "#img2img_styles input",
            img2img_styles_edit_select: "#img2img_styles_edit_select input",
            img2img_script_list: "#img2img_script_container #script_list input",
            extras_upscaler_1: "#extras_upscaler_1 input",
            extras_upscaler_2: "#extras_upscaler_2 input",
            extras_upscaler_2_visibility: "#extras_upscaler_2_visibility input",
        };
        this.uis = {
            txt2img_hires: "#txt2img_hr",
            txt2img_refiner: "#txt2img_enable",
            img2img_refiner: "#img2img_enable",
        };
        this.models = {
            checkpoints: "#setting_sd_model_checkpoint input",
        };
        this.fileinput = {
            img2img: "#img2img_img2img_tab input[type=\"file\"]",
            sketch: "#img2img_img2img_sketch_tab input[type=\"file\"]",
            inpaint: "#img2img_inpaint_tab input[type=\"file\"]",
            "inpaint sketch": "#img2img_inpaint_sketch_tab input[type=\"file\"]",
            "inpaint upload": "#img2img_inpaint_upload_tab input[type=\"file\"]",
            extras_image: "#extras_image input[type=\"file\"]",
            pnginfo_image: "#pnginfo_image input[type=\"file\"]",
        };
        this.fileimg = {
            img2img: "#img2img_img2img_tab img",
        };

        this._tabNames = [];
        this._lastPromptArea = null;
        this._eventReciever = null;
        this._backupPromptCronId = null;
        this._submenuTabNames = ["checkpoints", "lora", "batch", "clip-t2i", "clip-i2i", "clip-out"];
        this._submenuTab = "checkpoints";
        this.fileInfoAPI = fileInfoAPI;
    }

    root() {
        return document.getElementsByClassName("contain")[0];
    }

    panel() {
        return document.getElementById("sd-smartphone-plus-panel");
    }

    togglePanel(enabled) {
        this.root().classList.toggle('sspp-injected', enabled);
        if (enabled) {
            this.restoreBackupParameters().then(restored => {
                if (restored) alert("設定が復元されました。");
            });
            this.startBackupCron();
        } else {
            this.stopBackupCron();
        }
    }

    // localstorageのバックアップと現在のプロンプト内容を比較して、復元するか確認してから復元する
    async restoreBackupParameters() {
        const txt2imgPromptArea = document.querySelector(this.textareas.txt2img_prompt);
        const img2imgPromptArea = document.querySelector(this.textareas.img2img_prompt);
        const txt2imgBackup = localStorage.getItem("sspp_txt2img_prompt");
        const img2imgBackup = localStorage.getItem("sspp_img2img_prompt");

        const hasTxt2imgDiff = txt2imgBackup !== null && (txt2imgPromptArea?.value || "") !== txt2imgBackup;
        const hasImg2imgDiff = img2imgBackup !== null && (img2imgPromptArea?.value || "") !== img2imgBackup;

        if (!hasTxt2imgDiff && !hasImg2imgDiff) return false;

        const shouldRestore = window.confirm("保存された設定のバックアップが現在の内容と異なります。復元しますか？");
        if (!shouldRestore) return false;

        return await this.loadCurrentParameters();
    }
            
    changePanelUIType(type) {
        // submenu ボタン：現在が submenu内の機能(_submenuTabNames) であれば default に、そうでなければ submenu内の機能に切り替え
        // submenu内の機能：選択された機能パネルに切り替える
        // submenu外の機能：トグル形式で"default"と相互に切り替える
        const newType = type => {
            const current = this.root().getAttribute("uitype");
            if (type === "submenu") return this._submenuTabNames.includes(current) ? "default" : this._submenuTab;
            if (this._submenuTabNames.includes(type)) return this._submenuTab = type;
            return current === type ? "default" : type;
        }
        const uiType = newType(type);
        this.root().setAttribute("uitype", uiType);
        // extraTabNameは、checkpoints/lora タブがあればその名前を、なければ generation タブを指定
        const extraTabName = uiType === "checkpoints" || uiType === "lora" ? uiType : "generation";
        const tab = this.extraTabs(extraTabName);
        if (tab) tab.click();
        return uiType;
    }

    initialize() {
        // 全タブの名前を取得
        this._tabNames = [];
        this._tabClassName = "";
        const tabButtons = document.querySelectorAll("#tabs>.tab-nav>button");
        tabButtons.forEach((btn) => {
            this._tabNames.push(btn.textContent.trim().toLowerCase())
        });

        // イベント受け取り要素(gradioで再レンダリングの影響を受けない要素)の取得
        this._eventReciever = document; // document.getElementById("tabs");

        // ボタンクリックでタブ切り替えを検出してサイズラベルを更新
        this.addSafeEventListener("button", "click", (e, target) => {
            const buttonFaceText = target.textContent.trim().toLowerCase();
            // タブ切り替えの検出
            if (this._tabNames.includes(buttonFaceText)) {
                ssppUI.updateSizeLabel();
                sspp_sizeSelector.clearSelection();
            }
        });
        
        // プロンプトエリアへのフォーカス追跡（textareasマップを利用）
        const promptSelectors = Object.values(this.textareas).join(", ");
        const promptAreas = document.querySelectorAll(promptSelectors);
        promptAreas.forEach((textarea) => {
            textarea.addEventListener("focusin", () => {
                this._lastPromptArea = textarea;
            });
        });

        // input[type=range]が変更されたら、現在フォーカスが当たっているUIのフォーカスを外す
        // （スマホでスライダー操作後にキーボードが消えない問題の対策）
        this.addSafeEventListener("input[type=range]", "change", () => {
            const activeElement = document.activeElement;
            if (activeElement && activeElement.tagName === "INPUT" && activeElement.type === "range") {
                activeElement.blur();                // フォーカスが外れた後に、最後にフォーカスが当たっていたプロンプトエリアも念のためフォーカスを外す（これもスマホでスライダー操作後にキーボードが消えない問題の対策）
            }
        });

        // パネルUIタイプ初期化
        this.root().setAttribute("uitype", "default");

        // accept属性の削除（スマホのファイル選択でアクセスフォルダを限定させない）
        document.querySelectorAll("input[accept]").forEach((input) => {
            input.removeAttribute("accept");
        });

        // ドロップダウンUIにreadonly属性を付与 (ソフトウェアキーボードの出現を抑制)
        const dropdownInputKeys = [
            "txt2img_sampler",
            "txt2img_schedule_type",
            "txt2img_styles",
            "txt2img_styles_edit_select",
            "txt2img_script_list",
            "img2img_sampler",
            "img2img_schedule_type",
            "img2img_styles",
            "img2img_styles_edit_select",
            "img2img_script_list",
            "extras_upscaler_1",
            "extras_upscaler_2",
        ];
        dropdownInputKeys.forEach((key) => {
            const selector = this.inputs[key];
            if (selector) {
                const elem = document.querySelector(selector);
                if (elem) {
                    elem.setAttribute("readonly", "true");
                }
            }
        });
    }

    // UIController 経由でイベントリスナーを登録
    // gradio では、イベント発行時に remove されるため、親要素を含めた query は指定できない。
    addSafeEventListener(query, event, handler) {
        if (this._eventReciever) {
            this._eventReciever.addEventListener(event, (e) => {
                const target = e.target.closest(query);
                if (target) handler(e, target);
            });
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

    // 現在のimg2imgタブ名を取得
    currentImg2ImgTabName() {
        return document.querySelector("#mode_img2img button.selected").textContent.trim().toLowerCase();
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
        const sizeLabel = document.querySelector("#sspp-size");
        if (sizeLabel) sizeLabel.textContent = `${size[0].value} x ${size[1].value}`;
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

    // txt2img、img2img、extras タブで生成を実行
    generate() {
        // 生成可能なタブか確認
        const tabName = this.currentTabName();
        if (tabName !== "txt2img" && tabName !== "img2img" && tabName !== "extras") return false;
        // 生成前に現在の設定値を保存
        this.saveCurrentParameters();
        // 生成ボタンをクリック
        const generateButton = document.getElementById(`${tabName}_generate`);
        if (!generateButton) return false;
        generateButton.click();
        // defaultタブに切り替える
        this.changePanelUIType("default");
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

    // 10秒ごとに現在タブのプロンプトをバックアップ
    startBackupCron() {
        if (this._backupPromptCronId !== null) return false;
        this._backupPromptCronId = window.setInterval(() => {
            this._backupPrompt();
        }, 10000);
        return true;
    }

    // プロンプトバックアップの定期実行を停止
    stopBackupCron() {
        if (this._backupPromptCronId === null) return false;
        window.clearInterval(this._backupPromptCronId);
        this._backupPromptCronId = null;
        return true;
    }

    // 現在タブのプロンプトをlocalstorageに退避
    _backupPrompt() {
        const tabName = this.currentTabName();
        if (tabName !== "txt2img" && tabName !== "img2img") return false;
        const promptArea = this.promptArea();
        localStorage.setItem(`sspp_${tabName}_prompt`, promptArea?.value || "");
        return true;
    }

    // 現在のタブのサイズプロパティを変更
    setupSizeProps(width, height) {
        const sizeUI = this.sizeInputs();
        if (!sizeUI) return;
        this._updateValue(sizeUI[0], width);
        this._updateValue(sizeUI[1], height);
    }

    // URL画像をimg2imgのファイル入力に登録
    async setupImg2ImgImageFromUrl(imageUrl) {
        const fileInput = document.querySelector(this.fileinput['img2img']);
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

    // img2img タブの画像ソースURLを取得
    getImg2ImgImageSource(tab) {
        const imgElem = document.querySelector(this.fileimg['img2img']);
        if (!imgElem) return null;
        return imgElem.getAttribute("src");
    }

    // inputs オブジェクト内のキーを指定してパラメータを設定
    _setInputValue(key, value) {
        const selector = this.inputs[key];
        if (!selector) return;
        const elem = document.querySelector(selector);
        this._updateValue(elem, value);
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

        // プロンプトとサイズを反映
        this.setupPrompt(image.positive_prompt || "", image.negative_prompt || "");
        this.setupSizeProps(image.width || 1024, image.height || 1024);

        // その他のパラメータを反映
        const tabName = this.currentTabName();
        if (tabName !== "txt2img" && tabName !== "img2img") return;

        // 反映するパラメータのマッピングを定義
        const parameterMap = [
            { key: `${tabName}_steps`, value: image.steps },
            { key: `${tabName}_sampler`, value: image.sampler },
            { key: `${tabName}_cfg_scale`, value: image.cfg_scale },
            { key: `${tabName}_seed`, value: image.seed },
            { key: `${tabName}_schedule_type`, value: image.schedule_type },
        ];
        if (tabName === "img2img") {
            parameterMap.push({ key: `${tabName}_scale`, value: image.denoising_strength });
        }

        // パラメータを適用
        parameterMap.forEach(({ key, value }) => {
            if (value !== null && value !== undefined) {
                this._setInputValue(key, value);
            }
        });

        // img2img タブで URL がある場合は画像をセット
        if (tabName === "img2img" && image.url) {
            await this.setupImg2ImgImageFromUrl(image.url);
        }

        // 変更後のパラメータを保存
        this.saveCurrentParameters();
        
        // サイズラベルの更新
        this.updateSizeLabel();
    }

    // 現在のパラメータ設定値をlocalstorageに保存
    saveCurrentParameters() {
        // txt2img と img2img のパラメータを取得
        const txt2imgParams = this._getParametersByTabName("txt2img");
        const img2imgParams = this._getParametersByTabName("img2img", true);
        
        // プロンプトを別キーで保存
        if (txt2imgParams.positive_prompt) {
            localStorage.setItem('sspp_txt2img_prompt', txt2imgParams.positive_prompt);
            delete txt2imgParams.positive_prompt;
        }
        if (img2imgParams.positive_prompt) {
            localStorage.setItem('sspp_img2img_prompt', img2imgParams.positive_prompt);
            delete img2imgParams.positive_prompt;
        }
        
        // モデル名とimg2imgの画像URLも保存
        const parameters = {
            model: this._getCurrentModel(),
            txt2img: txt2imgParams,
            img2img: img2imgParams,
            img2imgURL: this.getImg2ImgImageSource()
        };
        localStorage.setItem('sspp_sdWebUIParameters', JSON.stringify(parameters));
    }

    // localstorageからパラメータを読み込んで適用
    async loadCurrentParameters() {
        const saved = localStorage.getItem('sspp_sdWebUIParameters');
        if (!saved) return false;

        try {
            const parameters = JSON.parse(saved);
            
            // モデルを適用
            if (parameters.model) this._setModel(parameters.model);
            
            // プロンプトを別キーから読み込んで統合
            const txt2imgParams = parameters.txt2img || {};
            txt2imgParams.positive_prompt = localStorage.getItem('sspp_txt2img_prompt') || "";
            this._applyTabParameters("txt2img", txt2imgParams);
            
            const img2imgParams = parameters.img2img || {};
            img2imgParams.positive_prompt = localStorage.getItem('sspp_img2img_prompt') || "";
            this._applyTabParameters("img2img", img2imgParams, true);

            // img2img fileURLの再設定
            if (parameters.img2imgURL) {
                await this.setupImg2ImgImageFromUrl(parameters.img2imgURL);
            }

            // サイズラベルの更新
            this.updateSizeLabel();

            return true;
        } catch (e) {
            console.error('パラメータの読み込みに失敗しました:', e);
            return false;
        }
    }

    // 現在のモデル(checkpoints)を取得
    _getCurrentModel() {
        const elem = document.querySelector(this.models.checkpoints);
        return elem ? elem.value : null;
    }

    // 指定タブの現在パラメータを取得
    _getParametersByTabName(tabName, includeDenoising = false) {
        const params = {};

        // textareasから取得
        const textareaFieldMapping = {
            positive_prompt: `${tabName}_prompt`,
            negative_prompt: `${tabName}_neg_prompt`,
        };

        Object.entries(textareaFieldMapping).forEach(([key, fieldName]) => {
            const selector = this.textareas[fieldName];
            if (selector) {
                const elem = document.querySelector(selector);
                if (elem) params[key] = elem.value;
            }
        });

        // inputsから取得
        const inputFieldMapping = {
            width: `${tabName}_width`,
            height: `${tabName}_height`,
            steps: `${tabName}_steps`,
            sampler: `${tabName}_sampler`,
            cfg_scale: `${tabName}_cfg_scale`,
            seed: `${tabName}_seed`,
            schedule_type: `${tabName}_schedule_type`,
        };

        if (includeDenoising) {
            inputFieldMapping.denoising_strength = `${tabName}_denoising_strength`;
        }
        
        Object.entries(inputFieldMapping).forEach(([key, fieldName]) => {
            const selector = this.inputs[fieldName];
            if (selector) {
                const elem = document.querySelector(selector);
                if (elem) params[key] = elem.value;
            }
        });
        
        return params;
    }

    // モデル(checkpoints)を設定
    _setModel(modelName) {
        const selector = this.models.checkpoints;
        const elem = document.querySelector(selector);
        if (elem) {
            this._updateValue(elem, modelName);
            // ドロップダウン選択肢を反映させるためのイベント
            elem.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    // 指定タブのパラメータを適用
    _applyTabParameters(tabName, params, includeDenoising = false) {
        // textareasへの適用
        const textareaFieldMapping = {
            positive_prompt: `${tabName}_prompt`,
            negative_prompt: `${tabName}_neg_prompt`,
        };

        Object.entries(textareaFieldMapping).forEach(([key, fieldName]) => {
            const selector = this.textareas[fieldName];
            if (selector && params[key] !== undefined) {
                const elem = document.querySelector(selector);
                this._updateValue(elem, params[key]);
            }
        });

        // inputsへの適用
        const inputFieldMapping = {
            width: `${tabName}_width`,
            height: `${tabName}_height`,
            steps: `${tabName}_steps`,
            sampler: `${tabName}_sampler`,
            cfg_scale: `${tabName}_cfg_scale`,
            seed: `${tabName}_seed`,
            schedule_type: `${tabName}_schedule_type`,
        };

        if (includeDenoising) {
            inputFieldMapping.denoising_strength = `${tabName}_denoising_strength`;
        }

        Object.entries(inputFieldMapping).forEach(([key, fieldName]) => {
            const selector = this.inputs[fieldName];
            if (selector && params[key] !== undefined) {
                const elem = document.querySelector(selector);
                this._updateValue(elem, params[key]);
            }
        });
    }
}
