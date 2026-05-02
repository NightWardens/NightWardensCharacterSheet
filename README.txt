Night Wardens Digital Field Office v4.4 Cache Fix

This version keeps the previous layout and uses the visible landing title:
Night Wardens Digital Field Office

IMPORTANT UPDATE STEP:
Upload/replace ALL files in the repo root, especially service-worker.js.
The old installed app/browser may keep showing an older cached header until the service worker updates.

Files to upload:
- index.html
- night_wardens_data.json
- manifest.webmanifest
- service-worker.js
- app.js
- icons/ if present

After committing to GitHub Pages:
1. Open the site in Chrome.
2. Add ?v=4.4 to the URL once, like:
   https://scottas369-collab.github.io/NightWardensCharacterSheet/?v=4.4
3. Refresh twice.
4. On Android, if installed as an app and it still shows old text, open App Info > Storage > Clear cache, or uninstall/reinstall the PWA.

This is still local-only unless connected to Firebase/Supabase later.
