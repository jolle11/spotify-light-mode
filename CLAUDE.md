# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome/Chromium browser extension (Manifest V3) that transforms Spotify's web interface from dark mode to light mode with a user-controllable toggle. The extension applies visual filters to invert colors while preserving the appearance of images, videos, and background images.

## Architecture

The extension uses Manifest V3 with three main components:

### Core Files

- **manifest.json**: Manifest V3 configuration with permissions for `storage` and `tabs`, and host permissions for `https://open.spotify.com/*`
- **content.js**: Runs at `document_start` on Spotify pages. Dynamically injects CSS for light mode and uses a MutationObserver to correct background-image elements
- **popup.html/popup.js**: User interface with a toggle switch. Manages user preference via `chrome.storage.sync` and sends messages to content scripts
- **background.js**: Service worker that initializes default state (enabled by default) and optionally updates extension icon based on toggle state
- **light-mode.css**: Static CSS file (currently not actively used; CSS is injected dynamically by content.js)

### State Management Flow

1. **Initial load**: `background.js` sets `lightModeEnabled: true` in `chrome.storage.sync` on install
2. **Content script**: Reads storage on page load and applies/removes light mode accordingly
3. **User toggle**: `popup.js` updates storage and sends `toggleLightMode` message to all Spotify tabs
4. **Persistence**: User preference persists across browser sessions via `chrome.storage.sync`

### Light Mode Implementation

The light mode effect is achieved through CSS filters dynamically injected into the page:
- A `<style>` element with ID `spotify-light-mode-styles` is injected into `<head>`
- Body receives `filter: invert(1) hue-rotate(180deg)` to convert dark theme to light
- Images and videos get the same filter to reverse the inversion
- Elements with inline `background-image` styles are detected via MutationObserver and get individual filter corrections applied
- A class `spotify-lm-corrected` tracks which elements have been corrected

## Development Workflow

### Loading the Extension

1. Open Chrome/Chromium and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked" and select this directory
4. Navigate to `https://open.spotify.com/` to test

### Making Changes

After modifying files:
- **content.js changes**: Click refresh icon on extension in `chrome://extensions/`, then reload Spotify tab
- **popup.js/popup.html changes**: Close and reopen the popup (or reload extension)
- **background.js changes**: Click refresh icon on extension
- **manifest.json changes**: Click refresh icon on extension, then reload Spotify tab

### Testing Toggle Functionality

1. Load extension and navigate to Spotify
2. Click extension icon to open popup
3. Toggle the switch on/off to verify immediate visual changes
4. Reload Spotify tab to verify state persists
5. Check console logs for "Spotify Light Mode content script loaded"

## Key Technical Details

- **Dynamic CSS injection**: CSS is injected/removed programmatically rather than loaded as a static file, enabling instant toggle without page reload
- **MutationObserver**: Continuously monitors DOM for new elements with `background-image` inline styles and applies filter corrections
- **Chrome Storage API**: Uses `chrome.storage.sync` for cross-device synchronization of user preference
- **Messaging**: `chrome.tabs.sendMessage()` communicates toggle state changes from popup to content scripts
- **Default state**: Extension is enabled by default (`lightModeEnabled !== false`)
