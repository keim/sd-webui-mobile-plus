// ファイル情報APIとの通信を行うクラス
export class FileInfoAPI {
    static _imageClass = null;

    static setImageClass(imageClass) {
        this._imageClass = imageClass;
    }

    // APIレスポンスから SDGeneratedImage[] を返す共通処理
    static async _fetchImages(url) {
        const resp = await fetch(url);
        if (!resp.ok) return [];
        const data = await resp.json();
        if (!data.success || !Array.isArray(data.images)) return [];
        return this._imageClass ? this._imageClass.fromApiResponseList(data.images) : data.images;
    }

    // txt2img 画像を取得
    static fetchTxt2Img(start = 0, count = 50) {
        return FileInfoAPI._fetchImages(`/api/mobile-plus/txt2img?start=${start}&count=${count}`);
    }

    // img2img 画像を取得
    static fetchImg2Img(start = 0, count = 50) {
        return FileInfoAPI._fetchImages(`/api/mobile-plus/img2img?start=${start}&count=${count}`);
    }

    // 全保存画像を取得
    static fetchOutdirSave(start = 0, count = 50) {
        return FileInfoAPI._fetchImages(`/api/mobile-plus/outdir?start=${start}&count=${count}`);
    }

    // 外部URL画像を同一オリジン経由で取得
    static fetchProxyImage(url) {
        return fetch(`/api/mobile-plus/proxy-image?url=${encodeURIComponent(url)}`);
    }
}
