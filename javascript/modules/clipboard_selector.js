// クリップボードセレクター操作クラス
export class ClipboardSelector {
    constructor(uiController, fileInfoAPI) {
        this.uiController = uiController;
        this.fileInfoAPI = fileInfoAPI;
        this._el = null;
        this._elItem = null;
        this._images = [];
        this._requestId = 0;
        
        // 無限スクロール用状態
        this._currentSubmenu = "default";
        this._nextStart = 0;
        this._isLoading = false;
        this._hasMore = true;
        this._pageSize = 30;
        this._scrollListener = null;
    }

    // 初期化処理
    initialize() {
        this._el = document.getElementById("sspp-clip-selector");
        this._elItem = this._el.querySelector('.sspp-clip-item[index="1"]');
        if (this._elItem) this._elItem.remove();
    }

    // サブメニューに対応する画像一覧を取得して更新
    async loadBySubmenu(submenu) {
        const currentRequestId = ++this._requestId;
        
        // スクロールリスナー削除（既存なら）
        if (this._scrollListener) {
            this._el?.removeEventListener("scroll", this._scrollListener);
            this._scrollListener = null;
        }
        
        // サブメニュー情報をリセット
        this._currentSubmenu = submenu;
        this._nextStart = 0;
        this._isLoading = false;
        this._hasMore = true;
        
        // 画像リストをリセット
        this.refresh([], true);
        
        if (submenu === "default") {
            return;
        }

        // 初回読み込み：30件を取得
        await this._loadNextPage(currentRequestId);
        
        // スクロールリスナーをセットアップ
        this._setupInfiniteScroll();
    }

    // クリップボードセレクターを更新 (SDGeneratedImage[] を渡す)
    // append=true の場合は既存の画像に追加、false の場合は全置換
    refresh(images = [], replace = true) {
        const newImages = Array.isArray(images) ? images.filter((image) => image?.url) : [];
        
        if (replace) {
            // 全置換モード
            this._images = newImages;
            if (!this._el || !this._elItem) return;
            const clipItems = this._el.querySelectorAll(".sspp-clip-item[index]");
            clipItems.forEach((item) => item.remove());
            
            for (let idx = this._images.length - 1; idx >= 0; idx--) {
                this._appendNewClipItem(idx, this._images[idx].url);
            }
        } else {
            // 追加モード（無限スクロール時）
            const startIdx = this._images.length;
            this._images.push(...newImages);
            
            if (!this._el || !this._elItem) return;
            
            for (let idx = newImages.length - 1; idx >= 0; idx--) {
                this._appendNewClipItem(startIdx + idx, this._images[startIdx + idx].url);
            }
        }
    }

    // クリップアイテムを追加
    _appendNewClipItem(index, imageUrl) {
        if (!this._el || !this._elItem) return;
        const clone = this._elItem.cloneNode(true);
        clone.setAttribute("index", index + 1);
        clone.setAttribute("style", `background-image:url(${imageUrl});`);
        clone.addEventListener("click", (e) => this._onSelectClip(e.currentTarget));
        this._el.appendChild(clone);
    }

    // クリップボード項目が選択されたときの処理
    async _onSelectClip(me) {
        const index = me.getAttribute("index") - 1;
        if (this._images[index]) {
            const image = this._images[index];
            
            // チェックボックス状態を確認
            const applySeedCheckbox = document.getElementById("sspp-apply-seed");
            const shouldApplySeed = applySeedCheckbox && applySeedCheckbox.checked;
            
            // オブジェクトをコピーしてから seed 値を修正
            const imageToApply = shouldApplySeed ? image : { ...image, seed: -1 };
            
            // SDGeneratedImage のパラメータを WebUI に適用
            await this.uiController.applyImageData(imageToApply);
            // ラベルを更新
            this.uiController.updateSizeLabel();
            // メニューを閉じる
            this.uiController.closeSubmenu();
        }
    }

    // 無限スクロール用リスナーをセットアップ
    _setupInfiniteScroll() {
        if (!this._el) return;
        
        this._scrollListener = () => {
            // スクロール位置が底に近いかを判定（底から100pxまでを閾値）
            if (this._el.scrollHeight - this._el.scrollTop - this._el.clientHeight < 100) {
                if (!this._isLoading && this._hasMore) {
                    this._loadNextPage(this._requestId);
                }
            }
        };
        
        this._el.addEventListener("scroll", this._scrollListener);
    }

    // 次ページの画像を読み込む
    async _loadNextPage(requestId) {
        if (this._isLoading || this._currentSubmenu === "default") return;
        
        this._isLoading = true;
        
        const fetchers = {
            "clip-t2i": (start) => this.fileInfoAPI.fetchTxt2Img(start, this._pageSize),
            "clip-i2i": (start) => this.fileInfoAPI.fetchImg2Img(start, this._pageSize),
            "clip-out": (start) => this.fileInfoAPI.fetchOutdirSave(start, this._pageSize),
        };
        
        const fetcher = fetchers[this._currentSubmenu];
        if (!fetcher) {
            this._isLoading = false;
            return;
        }
        
        try {
            const images = await fetcher(this._nextStart);
            
            if (requestId !== this._requestId) {
                this._isLoading = false;
                return;
            }
            
            if (!Array.isArray(images) || images.length === 0) {
                this._hasMore = false;
            } else {
                this._nextStart += this._pageSize;
                // 追加モード（replace=false）で画像を追加
                this.refresh(images, false);
            }
        } catch (err) {
            if (requestId === this._requestId) {
                console.error("[Mobile+] Failed to load more clipboard images:", err);
            }
        } finally {
            this._isLoading = false;
        }
    }
}
