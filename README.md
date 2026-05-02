# Night Wardens Auto-GM — Shared + Private v3

Upload these files to the root of your GitHub Pages repo:

- `auto-gm.html`
- `auto_gm_data.json`

Optional Firebase shared campaign support uses the existing `firebase-config.js` from the Digital Field Office v6 package.

## Access

`https://scottas369-collab.github.io/NightWardensCharacterSheet/auto-gm.html?v=3`

## Modes

### Solo / Local Case
Device-only interactive fiction Auto-GM. Saves in browser storage and can export/import JSON.

### Shared Campaign Case
Uses Firebase Auth + Firestore when configured. Public case state, party-visible narration, and shared transcript sync to:

`campaigns/{campaignId}/autoGmCases/{caseId}`

### Private Player View
Shows the shared case plus the player's private branch narration. Private notes can be stored locally and, with Firebase sign-in, pushed to:

`users/{uid}/privateAutoGmCases/{campaignId_caseId}`

## Command examples

- `new case`
- `look`
- `status`
- `add Riley`
- `split Riley to church basement`
- `Riley: investigate altar; Sam: talk witness; Alex: prep salt line`
- `private Alex: research symbol`
- `public Riley: cast veil snap; Sam: prep iron trap`
- `confront`
- `resolve`

## Firebase rules

The included `auto_gm_firestore.rules` is a safe starting point. It allows shared Auto-GM cases only to campaign members, and private Auto-GM logs only to the signed-in owner.
