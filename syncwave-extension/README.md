# SyncWave Extension Setup

This folder contains the source code for the SyncWave browser extension.

## How to Install

### Chrome / Brave / Edge
1. Open `chrome://extensions` in your browser.
2. Enable **Developer mode** (toggle in the top right).
3. Click **Load unpacked**.
4. Select the `syncwave-extension` folder.

### Firefox
1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on...**.
3. Select the `manifest.json` file inside the `syncwave-extension` folder.

## Important Note on Firebase SDK
Manifest V3 does not allow loading scripts from remote CDNs. To make the extension fully functional, you need to include the Firebase SDK files locally in this folder.

1. Download the following files from the Firebase SDK (compat version is recommended for this setup):
   - `firebase-app-compat.js`
   - `firebase-firestore-compat.js`
2. Place them inside the `syncwave-extension` folder.
3. Update `background.js` to import them:
   ```javascript
   importScripts('firebase-app-compat.js', 'firebase-firestore-compat.js', 'firebase-config.js');
   ```

## Features
- **Real-time Sync**: Sync YouTube playback with friends in private rooms.
- **Floating Navbar**: A sleek, draggable control bar injected into YouTube.
- **Audio Mode**: Listen to YouTube videos without the video feed (saves bandwidth/focus).
- **PlaySync**: Automatically follow the room's current video and time.
