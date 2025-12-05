# sd-webui-smartphone-plus

A Stable Diffusion WebUI extension that optimizes the interface for smartphone and mobile devices by injecting responsive CSS and providing mobile-friendly controls.

## Features

### 📱 Responsive Design
- Automatically adapts the WebUI interface for screens with width < 768px
- Optimized tab navigation with horizontal scrolling
- Compact UI elements for better mobile usability
- Toggle-able CSS injection for on-demand responsive mode

### 🎮 Mobile Control Panel
A dedicated control panel (SP+) with quick-access buttons for common operations:

- **Generate Button**: Quick access to image generation
- **Text Editing Tools**:
  - Word navigation (previous/current/next word selection)
  - Emphasis control: Wrap selected text in parentheses `(word)`
  - Weight adjustment: Modify emphasis weights with ±0.1 increments
- **UI Toggles**:
  - **Negative Prompt**: Show/hide negative prompt area
  - **Props**: Show/hide advanced settings (sampler, CFG, seed, etc.)
  - **Size**: Quick size preset selector
  - **Clip**: Clipboard management for prompts

### 🔧 Optimization Features
- Compact checkpoint and LoRA card display
- Streamlined prompt textarea (12rem height)
- Hidden unnecessary UI elements on mobile
- Fixed tab navigation bar at the top
- Optimized image display with proper aspect ratios

### 🤖 Gemini API Integration
- (on going)

## Installation

1. Goto 'Extentions' panel and select 'install from URL' tab:

2. Input below url into 'URL for extension's git repository':
   https://github.com/yourusername/sd-webui-smartphone-plus.git

3. Restart the Stable Diffusion WebUI

4. The extension will be available in the "SP+" tab

## Usage

### Activating Responsive Mode

1. Click the **InjectCSS** button in bottom area of the page, to activate responsive mode
2. The button label will change to **ExtractCSS** when active
3. Click again to deactivate and return to normal mode

> **Note**: The responsive CSS is only effective when the viewport width is less than 768px. Desktop users should access the interface from a mobile device or use browser developer tools to simulate mobile viewport.

### Control Panel Features

The SP+ control panel appears at the top of the interface and provides the following controls:

#### Text Editing
- **prev**: Select the previous word in the prompt
- **select**: Select/deselect the current word under the cursor
- **next**: Select the next word in the prompt
- **emph**: Wrap the selected text in parentheses for emphasis
- **-0.1/+0.1**: Decrease/increase emphasis weight by 0.1

#### UI Toggles
- **Negative**: Toggle visibility of the negative prompt area
- **Props**: Toggle visibility of advanced settings (sampler, CFG scale, seed settings, dimensions, batch settings, etc.)
- **Size**: Open size preset selector
- **Clip**: Open clipboard manager for prompt snippets

### Configuration

1. Go to **Settings** → **SP+** in the WebUI
2. Configure the following options:
   - **Gemini API Key**: (Optional) Enter your Gemini API key for AI-assisted features

## Requirements

- [AUTOMATIC1111's Stable Diffusion WebUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui)
- Python 3.8+
- Gradio (included with SD WebUI)

## Supported Tabs

The extension is optimized for:
- txt2img
- img2img

Controls and features are automatically adapted based on the currently active tab.

## File Structure

```
sd-webui-smartphone-plus/
├── scripts/
│   └── smartphone-plus.py          # Main extension script
├── javascript/
│   ├── responsive_design.js        # Core functionality
│   └── modules/
│       └── geminiapi.js           # Gemini API integration
├── svg/                           # UI icons
├── responsive.css                 # Mobile-optimized styles
├── style.css                      # Additional styles
├── LICENSE
└── README.md
```

## How It Works

1. **CSS Injection**: The extension dynamically injects responsive CSS rules that override the default WebUI styles for mobile devices
2. **Custom UI Panel**: A floating control panel is inserted into the interface, providing quick access to common operations
3. **Event Listeners**: JavaScript monitors tab changes and user interactions to provide seamless mobile experience
4. **Viewport Optimization**: Sets the interactive-widget meta tag to ensure proper mobile browser behavior

## Compatibility

- Tested with AUTOMATIC1111's Stable Diffusion WebUI
- Works on iOS and Android browsers
- Best experience on screen widths < 768px
- Compatible with most SD WebUI extensions

## Tips for Mobile Use

1. Use **Props** toggle to hide advanced settings you don't frequently adjust
2. Use **Negative** toggle to maximize screen space for the main prompt
3. Create size presets for your commonly used dimensions
4. Save frequent prompts to the clipboard manager
5. Use the word selection tools for precise prompt editing without a mouse

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

[View License](LICENSE)

## Credits

Developed for the Stable Diffusion community to improve mobile accessibility and usability.

---

**Note**: This extension is designed to enhance the mobile experience without modifying the core WebUI functionality. All features can be toggled on/off as needed.
