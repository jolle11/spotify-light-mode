# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome/Chromium + Firefox (121+) extension (Manifest V3) that re-themes Spotify's web player (light, dark, sepia, high contrast, vintage) using CSS filters, preserving images, videos and background images.

## Architecture

- **shared.js**: `globalThis.ThemeCore` — theme list, setting defaults, `withDefaults`, `resolveTheme` (manual / follow system / schedule) and `manualThemeChange`. Loaded before every other script (content script list, popup `<script>`, `importScripts` in the Chrome service worker, `background.scripts` in Firefox).
- **content.js**: IIFE (safe to re-inject; destroys a previous instance via `window.__spotifyThemeInstance`). Reads settings from `chrome.storage.sync` and reacts to `storage.onChanged`, system theme changes and schedule minute ticks. Injects `<style id="spotify-theme-styles">` with the filter on `html` (not `body`, to avoid breaking `position: fixed`). Inline `background-image` elements get the `data-spotify-theme-bg` attribute (MutationObserver, started after `DOMContentLoaded`); the CSS undoes the filter for them. Handles hover preview through a `theme-preview` port from the popup. Reports its effective theme to the background for the per-tab icon.
- **popup.html/popup.js**: Only writes to storage and re-renders from `storage.onChanged`. Theme grid, follow-system, schedule (light/dark start times), brightness slider, "keep player bar dark", hover preview, shortcut hint.
- **background.js**: Fills in missing defaults on install/update (never overwrites), re-injects scripts into open tabs, sets icons (global + per tab), keyboard commands (`toggle-theme` Alt+Shift+L, `cycle-theme` Alt+Shift+T) and the Spotify context menu.

### Settings (`chrome.storage.sync`)

`selectedTheme`, `lastLightTheme`, `useSystemTheme`, `scheduleEnabled`, `scheduleLightStart`, `scheduleDarkStart`, `brightness` (70–130), `keepPlayerDark`. Follow-system and schedule are mutually exclusive; choosing a theme manually disables both.

### Filter notes

Child filters must undo the page filter in reverse order (e.g. page `invert hue-rotate contrast saturate brightness(b)` → media `brightness(1/b) saturate⁻¹ contrast⁻¹ hue-rotate invert`). Sepia cannot be undone, so sepia/vintage don't correct media and "keep player dark" only works on inverted themes.

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
3. Pick themes / toggle options to verify immediate visual changes
4. Reload Spotify tab to verify state persists
5. Test hover preview, keyboard shortcuts and the right-click menu on Spotify
