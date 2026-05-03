# Night Wardens Storefront + Digital Library Update

Upload/replace these files in your GitHub repo root:

- index.html
- app.js
- service-worker.js
- storefront.html
- digital-library.html
- commercial-blueprint.html
- assets/nw-commercial-blueprint.css
- assets/nw-commercial-blueprint.js

Then open:

`https://YOUR-GITHUB-ACCOUNT.github.io/NightWardensCharacterSheet/?v=19.0`

## What changed

- The main index now links to Storefront and Digital Library before and after login.
- Added `storefront.html` as a clean production-style public storefront placeholder.
- Added `digital-library.html` as a local book reader / Ask the Dossier page.
- Digital Library supports TXT, Markdown, JSON, pasted text, and PDF text extraction when the browser can load PDF.js.
- The book assistant answers from the current book text only.
- Optional WebLLM uses Qwen2.5 0.5B by default for phone-friendly performance.
- If WebLLM fails, structured search fallback still works.

## Important notes

This is still a static GitHub Pages implementation. True account-owned library items, purchase entitlements, admin product upload, and secure owned-content LLM access should move to the commercial stack later: Next.js + Supabase + Stripe + Storage.
