# SD WebUI Mobile Plus

[![JP](https://img.shields.io/badge/lang-JP-22a565.svg)](README.md) [![EN](https://img.shields.io/badge/lang-EN-1f6feb.svg)](README.en.md)

AUTOMATIC1111 Stable Diffusion WebUI をスマートフォン向けに最適化する拡張です。レイアウト変更だけでなく、様々な入力補助機能により文字入力を極力少なくして、ソフトウェアキーボードの煩わしさを緩和します。

## 概要

- 狭い画面で作業しやすいようにカスタマイズされたスタイルシートを挿入
- インターフェイスを整理して機能毎に画面を切り替える方式を採用する事で作業を効率化
- 過去のプロンプトから距離の近いワードを候補として表示、挿入
- txt2img、img2img、saved の履歴ファイルを選択してパラメータを復元
- シンプルなテキストスニペット機能。よく使う文字列を登録して、1クリックで挿入/除去
- 単語単位のカーソル移動・範囲選択機能、選択範囲をカッコで囲う機能、重み表現の増減機能
- 基準ピクセルサイズ・ブロックサイズ・アスペクト比から、最適な画角を計算して設定する機能
- 画面を効率よく利用するために､フルスクリーンモードを維持する機能（実験的）
- セッションを維持できないモバイルブラウザ向けに、主要パラメータの自動保存･復元に対応
- その他、ソフトウェアキーボード出現を抑制や、OSによる参照フォルダ制限の回避など

## インストール

### URL から導入

1. WebUI の Extensions を開く
2. Install from URL を選択
3. 下記 URL を入力

```text
https://github.com/keim/sd-webui-mobile-plus
```

4. Install を実行
5. WebUI を再起動

### 手動導入

```bash
cd stable-diffusion-webui/extensions
git clone https://github.com/keim/sd-webui-mobile-plus
```

導入後に WebUI を再起動してください。

## 使い方

### 1. モバイルUIの有効化

- 画面幅 768px 以下で「InjectCSS」ボタンと「InjectCSS & FullScreen」ボタンが画面下部に表示されます。
- ボタンクリックで操作パネルが出現します。

### 2. SP+ パネルの主な機能

- Generate: 現在のタブで生成実行（生成前に現在設定を保存）
- Switch / メニュー切替（文字入力支援モード、設定支援モード）
- Negative / Render / Sampler / Batch / Checkpoints / Lora: 表示UIの切替
- txt2img / img2img / saved: 履歴ファイルの参照・設定復元
- prev / select / next / emph / -0.1 / +0.1: 単語選択と強調編集
- Snippet: テキストスニペット表示
- Size: 基準ピクセルサイズ・ブロックサイズ・アスペクト比からサイズを設定
- ExtractCSS: モバイルUIモードの解除

### 3. 表示UI切り替え機能

- `Negative`:
   ネガティブプロンプト入力欄を中心にした表示に切り替えます。
- `Render`:
   解像度やimg2img元画像など画像設定に切り替えます。
- `Sampler`:
   Sampler / Schedule Type / Steps / CFG / Seed などの生成用設定に切り替えます。
- `Batch`:
   バッチ系設定（count / size など）に切り替えます。
- `Checkpoints` / `Lora`:
   追加タブ (`checkpoints` / `lora`) の表示状態に切り替えます。
- `Switch`:
   メニュー項目を「文字入力支援モード」「設定支援モード」に切り替えます。

### 4. 単語操作機能

- `prev` / `next`:
   前後の単語へ移動します。
- `select`:
   選択状態を維持しながら単語移動します。
- `emph`:
   選択中の語句を `( ... )` で囲み、重み表現を整形します。
- `-0.1` / `+0.1`:
   カーソル位置より後で最初に出現するを重み表現を 0.1 単位で増減します（例: `(word:1.2)`）。
- 候補表示:
   プロンプト履歴から算出した単語間の距離の近い順に、最大6件の候補を表示して挿入できます。

### 5. 履歴呼び出し機能

- 参照元は 3 種類です。
   - `txt2img`: txt2img 出力履歴
   - `img2img`: img2img 出力履歴
   - `saved`: outdir_save 配下の保存履歴
- 画像メタ情報（Prompt / Size / Steps / Sampler / CFG / Seed / Schedule Type / Denoising など）を読み取り、UIへ反映します。
- クリップ一覧は無限スクロール方式で、1ページ 30 件ずつ追加読み込みします。
- `Apply Seed Value` のチェックを OFF にすると、履歴適用時に Seed は適用せず生成ごとに再抽選できます。

### 6. テキストスニペットの登録・挿入・除去機能

- スニペットは `sspp_text_list` として LocalStorage に保存されます。
- `Text` メニューで一覧を表示し、ラベルクリックで現在のプロンプトへ挿入します。
- 同一文言（重み表現の数字と連続する空白文字は対象外）が既に含まれる場合はトグル動作で除去します。
- 各行の編集ボタンから、編集・削除（空文字入力）を行えます。

### 7. パラメータ保存と復元

- `Generate` 実行時に LocalStorage へ現在設定を保存します。
   - 保存先: `sspp_sdWebUIParameters`
   - 保存対象:
      - model
      - txt2img/img2img の width, height, steps, sampler, cfg_scale, seed, schedule_type
      - img2img の denoising_strength
      - img2img の画像URL
- InjectCSS 有効中は、10秒ごとに現在タブの positive prompt を自動バックアップします。
   - 保存先: `sspp_txt2img_prompt`, `sspp_img2img_prompt`
- InjectCSS 有効化時に `restoreBackupParameters()` が実行され、
   現在の txt2img/img2img prompt とバックアップが異なる場合のみ確認ダイアログを表示します。
- ダイアログで OK を選ぶと `loadCurrentParameters()` を実行し、保存済み設定を一括復元します。


## 対応タブ

- txt2img
- img2img
- extras（Generate ボタン実行の対象として対応）

## プロジェクト構成

```text
sd-webui-mobile-plus/
   scripts/
      mobile-plus.py
      panel.html
   javascript/
      responsive_design.js
      modules/
         candidate_operations.js
         clipboard_selector.js
         file_info_api.js
         geminiapi.js
         sd_generated_image.js
         size_selector.js
         text_selector.js
         ui_controller.js
         word_operations.js
   responsive.css
   style.css
   svg/
   LICENSE
   README.md
```

## 補足

- PNG 解析による履歴取得上限は `scripts/mobile-plus.py` の `MAX_IMAGES`（現状 200）
- WebUI 側の DOM 構造変更によって、一部セレクタ調整が必要になる場合があります

## ライセンス

MIT License

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/keim/sd-webui-mobile-plus/issues)
- **Discussions**: [GitHub Discussions](https://github.com/keim/sd-webui-mobile-plus/discussions)

---

<div align="center">

**Made with passion for mobile AI art generation**

⭐ Star this repository if you find it useful!

</div>
