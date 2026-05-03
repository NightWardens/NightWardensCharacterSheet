# Night Wardens Storefront + Admin Placeholder Package

Upload these files to your GitHub Pages repo root:

- `storefront.html`
- `digital-library.html`
- `admin.html`
- `products.json`
- `firebase-config.js`
- `assets/nw-store-admin.css`
- `assets/nw-store-admin.js`

Optional backend/security files:

- `firestore.rules`
- `storage.rules`

## What this does

- Stages your four Square payment links as locked products.
- Buy buttons are disabled until an admin toggles the product to available.
- Admin can edit products, add links, add download URLs, and toggle availability.
- Admin can upload files to Firebase Storage if Firebase is configured.
- Admin can export `products.json` if staying static on GitHub Pages.
- Digital library claim page lets buyers submit manual proof details.

## Current Square links staged

- Core Rules: https://square.link/u/d5EDfDS2
- Bestiary: https://square.link/u/pWAUR38Z
- Tarot Guide: https://square.link/u/p2GoCvP2
- Grimoire: https://square.link/u/WlRHZoAV

## Admin security

A static GitHub Pages site cannot send email 2FA by itself.

The secure path included here uses Firebase Google sign-in and restricts admin access to:

`geeklitgames@gmail.com`

For real 2FA, enable 2-Step Verification on that Google account. Firebase Auth will use Google's sign-in security.

## Firebase setup

1. Create a Firebase project.
2. Add a Web App.
3. Enable Authentication > Google.
4. Add your GitHub Pages domain as an authorized domain.
5. Create Firestore.
6. Create Storage.
7. Paste the config into `firebase-config.js`.
8. Publish the included `firestore.rules` and `storage.rules`.

## Static fallback

If Firebase is not configured:

1. Open `admin.html`.
2. Use Local Export Mode.
3. Edit products.
4. Export `products.json`.
5. Upload/replace `products.json` in GitHub.

## Important limitation

Square payment links do not automatically grant library access unless you add a backend/webhook later. For now, use the claim form + manual admin grant.


## Firebase config included

This package includes `firebase-config.js` already filled with the Night Wardens Firebase web app config. Upload it to your GitHub repo root.

Do not upload any `serviceAccountKey.json` or `firebase-admin` code to GitHub Pages. That is server-only and belongs only in Firebase Cloud Functions or another secure backend later.

Current live URL to test after upload:

```text
https://nightwardens.github.io/NightWardensCharacterSheet/admin.html?v=firebase-config-1
```

Authorized domain needed in Firebase Authentication:

```text
nightwardens.github.io
```
