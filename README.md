# Night Wardens — Installable Web App Bundle

This folder contains an installable Progressive Web App (PWA) version of the Night Wardens character tool.

## Files
- `index.html` — the single-page character sheet app
- `manifest.webmanifest` — Android/Chrome install metadata
- `service-worker.js` — offline cache support
- `assets/icon-192.png` and `assets/icon-512.png` — app icons

## Important Android note
Android will not reliably install a PWA from a local `file://` folder. To get the app into the Android app drawer/library like a real app, host this folder over HTTPS. Good free options are GitHub Pages, Netlify, Cloudflare Pages, or your own website.

## Install on Android after hosting
1. Upload the unzipped folder to an HTTPS web host.
2. Open the hosted `index.html` page in Chrome on Android.
3. Tap the three-dot menu.
4. Tap **Install app** or **Add to Home screen**.
5. Launch **Night Wardens** from the home screen/app drawer.

## Saving character data
The app supports:
- browser/device autosave using localStorage
- manual Save to Browser
- Download Character JSON
- Load Character JSON from the device

For reliable long-term backups, use Download Character JSON after sessions.

## Offline support
Once opened from an HTTPS host, the service worker caches the app for offline use. Character data remains on the device unless exported.
