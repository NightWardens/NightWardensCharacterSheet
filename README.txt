Night Wardens Digital Field Office v7

Upload/replace all files in your GitHub Pages repository root.

Main site:
  index.html
  app.js
  night_wardens_data.json
  manifest.webmanifest
  service-worker.js
  firebase-config.js

Auto-GM separate page:
  auto-gm.html
  auto_gm_data.json

What changed:
- Restored the original main index page instead of replacing it with Auto-GM.
- Auto-GM is now a separate page.
- Auto-GM visible title now reads:
    Night Wardens
    Digital Field Guide
- Campaign creation/manager now has a checkbox:
    Use Auto-GM for this campaign
- If a campaign has Auto-GM enabled, opening it from the campaign list launches auto-gm.html with campaign parameters.
- Service worker cache bumped to v7.

After upload, open:
  https://scottas369-collab.github.io/NightWardensCharacterSheet/?v=7

Auto-GM direct:
  https://scottas369-collab.github.io/NightWardensCharacterSheet/auto-gm.html?v=7

If the old page appears, refresh twice. On installed Android PWA, uninstall/reinstall or clear app cache if needed.
