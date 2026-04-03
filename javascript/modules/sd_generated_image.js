// Stable Diffusion によって生成された画像のメタ情報を保持するクラス
export class SDGeneratedImage {
    constructor({
        url = null,
        positive_prompt = '',
        negative_prompt = '',
        width = null,
        height = null,
        size = null,
        steps = null,
        sampler = null,
        cfg_scale = null,
        seed = null,
        model = null,
        model_hash = null,
        denoising_strength = null,
        clip_skip = null,
        ensd = null,
        version = null,
        hires_upscale = null,
        hires_steps = null,
        hires_upscaler = null,
        vae = null,
        vae_hash = null,
        lora_hashes = null,
        ti_hashes = null,
        schedule_type = null,
        schedule_rho = null,
        sgm_noise_multiplier = null,
        ...extra
    } = {}) {
        this.url = url;
        this.positive_prompt = positive_prompt;
        this.negative_prompt = negative_prompt;
        this.width = width;
        this.height = height;
        this.size = size ?? (width && height ? `${width}x${height}` : null);
        this.steps = steps;
        this.sampler = sampler;
        this.cfg_scale = cfg_scale;
        this.seed = seed;
        this.model = model;
        this.model_hash = model_hash;
        this.denoising_strength = denoising_strength;
        this.clip_skip = clip_skip;
        this.ensd = ensd;
        this.version = version;
        this.hires_upscale = hires_upscale;
        this.hires_steps = hires_steps;
        this.hires_upscaler = hires_upscaler;
        this.vae = vae;
        this.vae_hash = vae_hash;
        this.lora_hashes = lora_hashes;
        this.ti_hashes = ti_hashes;
        this.schedule_type = schedule_type;
        this.schedule_rho = schedule_rho;
        this.sgm_noise_multiplier = sgm_noise_multiplier;
        // Python 側で追加された未知のパラメータも保持
        Object.assign(this, extra);
    }

    // APIレスポンスのオブジェクト1件から生成
    static fromApiResponse(data) {
        return new SDGeneratedImage(data);
    }

    // APIレスポンスの配列からまとめて生成
    static fromApiResponseList(list) {
        return list.map(SDGeneratedImage.fromApiResponse);
    }
}
