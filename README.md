# SD WebUI Mobile Plus

<div align="center">

**A comprehensive mobile optimization extension for AUTOMATIC1111's Stable Diffusion WebUI**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

---

## 📱 Overview

**SD WebUI Mobile Plus** transforms the Stable Diffusion WebUI into a mobile-friendly interface, providing an optimized experience for smartphones and tablets. With responsive design, touch-friendly controls, and a powerful mobile control panel, you can generate high-quality images on the go.

### Key Highlights

- 🎯 **Responsive Design** - Automatically adapts to screens under 768px width
- 🎮 **Mobile Control Panel** - Quick-access toolbar for common operations
- ✏️ **Advanced Text Editing** - Word-level navigation and prompt manipulation
- 📋 **Prompt History** - Automatic extraction from generated images
- 🔧 **UI Optimization** - Streamlined interface with toggle-able sections
- 🤖 **Gemini API Integration** - AI-assisted features (in development)

---

## 🚀 Installation

### Method 1: Install from URL (Recommended)

1. Open your Stable Diffusion WebUI
2. Navigate to the **Extensions** tab
3. Select the **Install from URL** sub-tab
4. Paste the following URL into the repository field:
   ```
   https://github.com/keim/sd-webui-mobile-plus
   ```
5. Click **Install**
6. Restart the WebUI

### Method 2: Manual Installation

1. Clone this repository into your `extensions` directory:
   ```bash
   cd stable-diffusion-webui/extensions
   git clone https://github.com/keim/sd-webui-mobile-plus
   ```
2. Restart the WebUI

### Verification

After installation, the **InjectCSS** button will appear at the bottom of the page when accessing from a mobile device (viewport width < 768px).

---

## 📖 Usage Guide

### Activating Mobile Mode

1. **Access from Mobile Device** - Open the WebUI on your smartphone or tablet
2. **Click InjectCSS Button** - Located at the bottom of the page
3. **Responsive Mode Activated** - The button label changes to **ExtractCSS**
4. **Toggle Anytime** - Click again to deactivate and return to desktop layout

> **💡 Tip**: Desktop users can test mobile mode using browser developer tools (F12) to simulate mobile viewport dimensions.

### Mobile Control Panel (SP+)

Once activated, a floating control panel appears at the top of the interface with the following features:

#### 🎨 Quick Actions
- **Generate** - Instant access to image generation button
- **Clipboard** - Manage and recall prompt snippets

#### ✏️ Text Editing Tools
| Button | Function |
|--------|----------|
| **prev** | Select previous word in prompt |
| **select** | Select/deselect word under cursor |
| **next** | Select next word in prompt |
| **emph** | Wrap selected text in parentheses `()` for emphasis |
| **-0.1** | Decrease emphasis weight by 0.1 |
| **+0.1** | Increase emphasis weight by 0.1 |

#### 🎚️ UI Toggles
- **Negative** - Show/hide negative prompt textarea
- **Props** - Show/hide advanced settings panel (sampler, CFG scale, seed, dimensions, batch settings)
- **Size** - Quick access to image size presets
- **Clip** - Open clipboard manager for saved prompts

### 📋 Prompt History

The extension automatically extracts prompts from your generated images (up to 500 most recent), making it easy to:
- Review previous prompts
- Reuse successful settings
- Track your generation history
- Learn from past results

Access prompt history through the **Mobile+** tab in the WebUI interface.

---

## ⚙️ Configuration

### Settings Panel

Navigate to **Settings** → **Mobile+** in the WebUI to configure:

| Option | Description |
|--------|-------------|
| **Gemini API Key** | (Optional) Enter your Google Gemini API key for AI-assisted features |

### Supported Tabs

The extension provides optimized experiences for:
- ✅ **txt2img** - Text-to-image generation
- ✅ **img2img** - Image-to-image transformation

Controls automatically adapt based on the active tab.

---

## 📁 Project Structure

```
sd-webui-mobile-plus/
├── scripts/
│   ├── mobule-plus.py              # Main extension script
│   └── panel.html                  # Control panel HTML template
├── javascript/
│   ├── responsive_design.js        # Core mobile functionality
│   └── modules/
│       └── geminiapi.js           # Gemini API integration
├── svg/                            # UI icon assets
│   ├── arrow-expand-horizontal.svg
│   ├── clipboard-text-multiple.svg
│   ├── code-parentheses.svg
│   └── ... (additional icons)
├── responsive.css                  # Mobile-optimized styles
├── style.css                       # Additional UI styles
├── LICENSE                         # MIT License
└── README.md                       # This file
```

---

## 🎯 Features in Detail

### Responsive Design
- **Adaptive Layout** - Interface automatically adjusts for screens < 768px
- **Optimized Navigation** - Horizontal scrolling tabs for easy access
- **Compact Elements** - Streamlined UI components for better space utilization
- **Touch-Friendly** - Larger tap targets and gesture-friendly controls

### Mobile Optimizations
- 📦 **Compact Cards** - Checkpoint and LoRA selectors optimized for mobile
- 📝 **Streamlined Prompts** - Fixed height textareas (12rem) for better screen usage
- 🎨 **Image Display** - Proper aspect ratio handling for generated images
- 🔝 **Fixed Navigation** - Tab bar remains accessible at the top
- 👁️ **Smart Hiding** - Unnecessary UI elements automatically hidden on mobile

### Text Editing Capabilities
- **Word-Level Navigation** - Jump between prompt words efficiently
- **Quick Selection** - Select words with a single tap
- **Emphasis Controls** - Add/modify emphasis weights without typing
- **Batch Editing** - Apply changes to multiple selected words

### AI Integration (In Development)
- 🤖 **Gemini API** - Planned features for AI-assisted prompt generation
- 💡 **Smart Suggestions** - Context-aware prompt improvements
- 🔄 **Auto-Enhancement** - Intelligent prompt refinement

---

## 💡 Mobile Usage Tips

1. **Maximize Screen Space** - Use the **Props** toggle to hide settings you rarely adjust
2. **Quick Workflow** - Keep the **Negative** prompt hidden when not needed
3. **Save Presets** - Create size presets for your most-used dimensions
4. **Clipboard Manager** - Store frequently used prompt fragments for quick access
5. **Word Selection** - Use prev/next/select for precise editing without a keyboard
6. **Emphasis Fine-Tuning** - Use ±0.1 buttons for quick weight adjustments
7. **Prompt History** - Review your successful prompts from the Mobile+ tab

---

## 🔧 Technical Details

### How It Works

1. **CSS Injection System**
   - Dynamically injects responsive CSS rules for mobile devices
   - Overrides default WebUI styles when viewport < 768px
   - Toggleable on-demand without page refresh

2. **Control Panel Integration**
   - Floating panel inserted into the DOM structure
   - Event-driven architecture for responsive interactions
   - Tab-aware functionality that adapts to context

3. **JavaScript Event System**
   - Monitors tab changes and user interactions
   - Provides seamless mobile navigation experience
   - Viewport optimization with proper meta tags

4. **Image Processing**
   - Scans output directory for PNG files
   - Extracts metadata and prompts from image EXIF data
   - Maintains history of up to 500 recent generations

---

## 🌐 Compatibility

### Requirements
- **AUTOMATIC1111's Stable Diffusion WebUI** (latest version recommended)
- **Python** 3.8 or higher
- **Gradio** (included with SD WebUI)

### Tested Platforms
- ✅ iOS (Safari, Chrome)
- ✅ Android (Chrome, Firefox, Samsung Internet)
- ✅ iPad/Tablets
- ✅ Desktop browsers (with mobile viewport simulation)

### Extension Compatibility
Compatible with most SD WebUI extensions. Tested alongside:
- ControlNet
- Dynamic Prompts
- Additional Networks
- And many others

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Report Issues** - Found a bug? [Open an issue](https://github.com/keim/sd-webui-mobile-plus/issues)
2. **Suggest Features** - Have ideas? Share them in discussions
3. **Submit PRs** - Code improvements and fixes are appreciated
4. **Documentation** - Help improve guides and examples
5. **Testing** - Test on different devices and report compatibility

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 🙏 Credits

Developed with ❤️ for the Stable Diffusion community to enhance mobile accessibility and improve the creative workflow on mobile devices.

**Special Thanks:**
- AUTOMATIC1111 and contributors for the amazing Stable Diffusion WebUI
- The entire SD community for inspiration and feedback

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/keim/sd-webui-mobile-plus/issues)
- **Discussions**: [GitHub Discussions](https://github.com/keim/sd-webui-mobile-plus/discussions)

---

<div align="center">

**Made with passion for mobile AI art generation**

⭐ Star this repository if you find it useful!

</div>
