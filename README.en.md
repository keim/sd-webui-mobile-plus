# SD WebUI Mobile Plus

[![JP](https://img.shields.io/badge/lang-JP-22a565.svg)](README.md) [![EN](https://img.shields.io/badge/lang-EN-1f6feb.svg)](README.en.md)

An extension that optimizes AUTOMATIC1111 Stable Diffusion WebUI for mobile devices. Beyond layout adjustments, it minimizes text input with various input assistance features, reducing the inconvenience of software keyboards.

## Overview

- Injects customized stylesheets optimized for narrow screens
- Organizes the interface with feature-based screen switching for efficient workflows
- Displays candidate words with similar distances from prompt history; insert with one tap
- Restores parameters from txt2img, img2img, and saved history files
- Simple text snippet functionality: register frequently used strings and insert/remove with one click
- Word-level cursor movement, range selection, wrapping phrases in parentheses, emphasis rate adjustments
- Calculates optimal image dimensions from base pixel size, block size, and aspect ratio
- Fullscreen mode support to maximize screen usage (experimental)
- Auto-save/restore of key parameters for mobile browsers with unstable sessions
- Additional tweaks: software keyboard suppression, workarounds for OS file picker restrictions, etc.

## Installation

### Install from URL

1. Open Extensions in WebUI
2. Select "Install from URL"
3. Enter the URL below:

```text
https://github.com/keim/sd-webui-mobile-plus
```

4. Click Install
5. Restart WebUI

### Manual Installation

```bash
cd stable-diffusion-webui/extensions
git clone https://github.com/keim/sd-webui-mobile-plus
```

Restart WebUI after installation.

## Usage

### 1. Enable Mobile UI

- When viewport width is 768px or less, "InjectCSS" and "InjectCSS & FullScreen" buttons appear at the bottom of the screen.
- Click either button to open the control panel.

### 2. Main features of the SP+ panel

- **Generate**: Executes generation in the current tab (saves current settings before generation)
- **Switch / Menu toggle**: Switch between text-input support mode and settings support mode
- **Negative / Render / Sampler / Batch / Checkpoints / Lora**: Switches displayed UI groups
- **txt2img / img2img / saved**: Browse history files and restore parameters
- **prev / select / next / emph / -0.1 / +0.1**: Word selection and emphasis editing
- **Snippet**: Display text snippet list
- **Size**: Set size from base pixel size, block size, and aspect ratio
- **ExtractCSS**: Disable mobile UI mode

### 3. UI switching features

- **Negative**:
  Switches to a view focused on the negative prompt input area.
- **Render**:
  Switches to image-related settings such as resolution and img2img source image.
- **Sampler**:
  Switches to generation settings like Sampler / Schedule Type / Steps / CFG / Seed.
- **Batch**:
  Switches to batch settings (count / size, etc.).
- **Checkpoints / Lora**:
  Switches extra tabs (checkpoints / lora) display state.
- **Switch**:
  Toggles menu items between text-input support mode and settings support mode.

### 4. Word operation features

- **prev / next**:
  Move to previous/next word.
- **select**:
  Move across words while maintaining selection state.
- **emph**:
  Wraps selected text with `( ... )` and normalizes emphasis notation.
- **-0.1 / +0.1**:
  Adjusts the first emphasis value after cursor position by 0.1 units (e.g., `(word:1.2)`).
- **Candidate display**:
  Shows up to 6 candidate words sorted by proximity from prompt history and allows insertion.

### 5. History recall features

- Three sources available:
  - `txt2img`: txt2img output history
  - `img2img`: img2img output history
  - `saved`: Files under outdir_save
- Reads image metadata (Prompt / Size / Steps / Sampler / CFG / Seed / Schedule Type / Denoising, etc.) and applies to UI.
- Clipboard list uses infinite scroll loading 30 items per page.
- If "Apply Seed Value" is unchecked, seed is not applied from history and is re-randomized for each generation.

### 6. Text snippet registration, insertion, and removal features

- Snippets are saved in LocalStorage as `sspp_text_list`.
- Open Text menu to view the list; click labels to insert into current prompt.
- If equivalent text already exists (numbers in emphasis notation and consecutive spaces are excluded), it removes it as a toggle action.
- Edit and delete (by entering empty text) available via the edit button for each row.

### 7. Parameter saving and restoration

- Settings are saved to LocalStorage on Generate execution.
  - Storage key: `sspp_sdWebUIParameters`
  - Saved items:
    - model
    - txt2img/img2img width, height, steps, sampler, cfg_scale, seed, schedule_type
    - img2img denoising_strength
    - img2img image URL
- While InjectCSS is active, the positive prompt of the current tab is automatically backed up every 10 seconds.
  - Storage keys: `sspp_txt2img_prompt`, `sspp_img2img_prompt`
- On InjectCSS activation, `restoreBackupParameters()` is executed.
  A confirmation dialog appears only if the current txt2img/img2img prompt differs from the backup.
- Clicking OK executes `loadCurrentParameters()` to restore saved settings in bulk.

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

- PNG history extraction limit is `MAX_IMAGES` in `scripts/mobile-plus.py` (currently 200)
- DOM structure changes in WebUI may require selector adjustments

## License

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
