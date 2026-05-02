# Night Wardens Auto-GM Web v1

This is a standalone web page prototype for a tarot-driven Auto-GM.

## Files
- `index.html` — main webpage
- `auto_gm_data.json` — editable story/card/oracle data
- `README.md`

## How to use on GitHub Pages
Upload `index.html` and `auto_gm_data.json` to your repo root or a folder such as `/auto-gm/`.

Example:
`https://scottas369-collab.github.io/NightWardensCharacterSheet/auto-gm/`

## Features
- Generates a tarot-based case.
- Tracks phase, pressure clock, visible symptom, possible entities, hidden truth, anchor, and kill condition.
- Supports typed commands like `look`, `investigate altar`, `talk to witness`, `prep salt line`, `cast veil snap`, `attack entity`.
- Supports split-party simultaneous actions.
- Saves to browser storage.
- Exports/imports case JSON.

## Notes
This is v1. The next upgrade can connect it to the Digital Field Office's Firebase campaigns/chats so each player sees private branch narration while the campaign log stores shared outcomes.
