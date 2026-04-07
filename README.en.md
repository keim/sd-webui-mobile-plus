# SD WebUI Mobile Plus

[![JP](https://img.shields.io/badge/lang-JP-22a565.svg)](README.md) [![EN](https://img.shields.io/badge/lang-EN-1f6feb.svg)](README.en.md)

An extension that optimizes AUTOMATIC1111 Stable Diffusion WebUI for smartphones.

## Overview

- Injects a customized stylesheet to improve usability on small screens.
- Organizes UI by feature and lets you switch visible controls for efficient mobile workflows.
- Suggests related words based on prompt history and inserts them with one tap.
- Restores parameters from txt2img, img2img, and saved history entries.
- Lets you register simple text snippets and insert/remove them with one tap.
- Supports word-level navigation, range selection, wrapping with parentheses, and emphasis rate adjustments.
- Calculates and sets optimized size from base pixel size, block size, and aspect ratio.
- Keeps fullscreen mode for better screen usage (experimental).
- Auto-saves/restores key txt2img and img2img parameters for mobile browsers with unstable sessions.
- Includes additional mobile-focused tweaks (software keyboard suppression, file picker behavior improvements, etc.).

## Installation

### Install from URL

1. Open Extensions in WebUI.
2. Select Install from URL.
3. Enter the repository URL below:

```text
https://github.com/keim/sd-webui-mobile-plus
```

4. Click Install.
5. Restart WebUI.

### Manual installation

```bash
cd stable-diffusion-webui/extensions
git clone https://github.com/keim/sd-webui-mobile-plus
```

Restart WebUI after installation.

## Usage

### 1. Enable mobile UI

- When viewport width is 768px or less, InjectCSS and InjectCSS & FullScreen buttons appear at the bottom.
- Clicking either button opens the control panel.

### 2. Main features in SP+ panel

- Generate: runs generation in the current tab (and saves current settings before generation).
- Switch / menu mode toggle (text-input support mode and settings support mode).
- Negative / Render / Sampler / Batch / Checkpoints / Lora: switch displayed UI groups.
- txt2img / img2img / saved: browse history and restore settings.
- prev / select / next / emph / -0.1 / +0.1: word selection and emphasis editing.
- Text: shows text snippet list.
- Size: sets size from base pixel size, block size, and aspect ratio.
- ExtractCSS: disables mobile UI mode.

### 3. UI switching details

- Negative:
  Switches to a view focused on the negative prompt area.
- Render:
  Switches to image-related settings such as resolution and img2img source image.
- Sampler:
  Switches to generation settings such as Sampler / Schedule Type / Steps / CFG / Seed.
- Batch:
  Switches to batch settings (count / size, etc.).
- Checkpoints / Lora:
  Switches extra panel tabs to checkpoints/lora views.
- Switch:
  Toggles the menu groups between text-support controls and settings-support controls.

### 4. Word operation features

- prev / next:
  Move to previous/next word.
- select:
  Moves across words while keeping selection state.
- emph:
  Wraps selected text with `( ... )` and normalizes emphasis notation.
- -0.1 / +0.1:
  Decreases/increases emphasis value by 0.1 (example: `(word:1.2)`).
- Candidate suggestions:
  Shows up to 6 candidate words sorted by proximity learned from prompt history.

### 5. History recall features

- Three data sources:
  - txt2img: txt2img output history
  - img2img: img2img output history
  - saved: files under outdir_save
- Reads image metadata (Prompt / Size / Steps / Sampler / CFG / Seed / Schedule Type / Denoising, etc.) and applies it to UI.
- Clipboard list uses infinite scroll and loads 30 items per page.
- If Apply Seed Value is OFF, seed is not applied from history and is re-randomized.

### 6. Text snippet register/insert/remove features

- Snippets are stored in LocalStorage as `sspp_text_list`.
- Open Text menu and click labels to insert into the current prompt area.
- If equivalent text already exists (ignoring emphasis number and repeated spaces), it is removed as a toggle action.
- Each row supports edit/delete (delete by setting empty text).

### 7. Parameter save and restore

- On Generate, current settings are saved to LocalStorage.
  - Key: `sspp_sdWebUIParameters`
  - Includes:
    - model
    - txt2img/img2img width, height, steps, sampler, cfg_scale, seed, schedule_type
    - img2img denoising_strength
    - img2img image URL
- While InjectCSS mode is active, positive prompt of current tab is auto-backed up every 10 seconds.
  - Keys: `sspp_txt2img_prompt`, `sspp_img2img_prompt`
- On InjectCSS activation, `restoreBackupParameters()` runs.
  If current prompt differs from backup, a confirmation dialog is shown.
- If you press OK, `loadCurrentParameters()` restores saved settings.

## Supported tabs

- txt2img
- img2img
- extras (supported as a Generate target)

## Project structure

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
   README.en.md
```

## Notes

- PNG history extraction limit is `MAX_IMAGES` in `scripts/mobile-plus.py` (currently 200).
- If WebUI DOM structure changes, some selectors may need updates.

## License

MIT License

---

## Support

- **Issues**: [GitHub Issues](https://github.com/keim/sd-webui-mobile-plus/issues)
- **Discussions**: [GitHub Discussions](https://github.com/keim/sd-webui-mobile-plus/discussions)
