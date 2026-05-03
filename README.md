# Night Wardens Auto-GM — Pass 18.1 Shared Ready + Shared Party Notes

Upload these files to the root of your GitHub Pages repo:

- `auto-gm.html`
- `auto-gm-pass13.js`
- `auto-gm-llm-adapter.js`
- `auto-gm-sync-adapter.js`
- `auto_gm_modular_library.json`
- `README.md`

Open:

`https://scottas369-collab.github.io/NightWardensCharacterSheet/auto-gm.html?v=18.1`

## Added in 18.1

Shared party notes now update when sent.

Use the main IF command box:

- `note check the bell chain before entering the lower room`
- `party note Mrs Harlan mentioned meetings under the church`
- `notes`
- `clear notes confirm`

Notes are saved into the shared Auto-GM case state. If Firebase/Firestore sync is configured, the note is published with the case state and appears for every connected player on that Auto-GM campaign. Casual small talk is still ephemeral unless it reveals a real clue.

## Existing Pass 18 behavior

- Shared campaign ready-up for drawing a new case
- Real-player ready status
- Firebase-ready case sync
- Local fallback when Firebase is not configured
- Public/private logs, private clue reveal, NPC/HQ commands, LLM helper, TTS setup, and turn-based combat
