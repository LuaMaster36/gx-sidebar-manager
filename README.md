# GX Sidebar Manager

A customizable sidebar extension for Opera GX and Chrome browsers that allows you to manage quick-access buttons with categories, keyboard shortcuts, and flexible opening modes.

![Extension Screenshot](screenshot.png) *(Add a screenshot if available)*

## Features

- 🚀 **Quick Access Buttons**: Create and organize your favorite websites as buttons
- 🗂 **Categories**: Organize buttons into customizable categories
- ⌨ **Keyboard Shortcuts**:
  - `Alt+Shift+S`: Open/close sidebar
  - `Alt+1`/`Alt+2`: Quick access to assigned buttons
- 🌈 **Customizable UI**: Dark theme with accent colors matching Opera GX
- 🔄 **Multiple Opening Modes**:
  - New Tab
  - Current Tab
  - Popup Window
- 📌 **Drag & Drop**:
  - Reorder buttons
  - Add new buttons from bookmarks or open tabs
- 🖼 **Automatic Favicons**: Automatically fetches icons for your buttons
- ⚡ **Quick Assignment**: Assign buttons to quick-access slots

## Installation

### For Users
1. Download the latest release from the [Releases page](#) *(add link when available)*
2. In Opera/Chrome, go to `opera://extensions` or `chrome://extensions`
3. Enable "Developer mode"
4. Drag and drop the `.crx` file or load the unpacked extension

### For Developers
1. Clone this repository
2. In Opera/Chrome, go to `opera://extensions` or `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the repository folder

## Usage

1. Click the extension icon or use `Alt+Shift+S` to open the sidebar
2. Use the options page to:
   - Add new buttons
   - Create categories
   - Assign quick-access shortcuts
   - Customize button behavior

## Technical Details

- **Manifest Version**: 3
- **Permissions**:
  - `storage` - Save button configurations
  - `tabs` - Interact with browser tabs
  - `bookmarks` - Access bookmarks for drag & drop
  - `sidePanel` - Opera sidebar functionality
  - `webNavigation` - Detect start pages

## File Structure
/
├── icons/ - Extension icons in multiple sizes
├── manifest.json - Extension configuration
├── options.html - Options page UI
├── options.js - Options page logic
├── panel.html - Sidebar UI
├── panel.js - Sidebar logic
└── sw.js - Service worker (background script)

