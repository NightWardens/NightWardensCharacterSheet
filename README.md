# Night Wardens Auto-GM Pass 16 — NPC Voices, Warden HQs, Recruitable Wardens, Dialogue Profiles

Upload these files to the GitHub Pages repo root:

- `auto-gm.html`
- `auto-gm-pass13.js`
- `auto-gm-llm-adapter.js`
- `auto_gm_modular_library.json`
- `README.md`

Open:

`https://scottas369-collab.github.io/NightWardensCharacterSheet/auto-gm.html?v=16.0`

## New in Pass 16

- Assigns voice profiles to witnesses, strangers, recruitable allies, available Wardens, and creatures.
- Adds Warden HQ modules to generated cases.
- Adds an RNG-based available Warden roster per case.
- Adds a Warden recruit pool with roles, services, bonuses, voice profiles, and dialogue options.
- Adds character profile support for NPCs, Wardens, strangers, and entities.
- Adds dialogue option listings for NPCs and creatures.
- Adds creature interaction commands such as observe, taunt, and parley.
- Keeps small talk ephemeral unless it becomes a solid clue.
- Keeps the structured Auto-GM as the source of truth; the LLM can phrase dialogue but cannot invent hidden clues.

## New commands

```text
list hq
list wardens
hq
hq refresh
profile Mrs Harlan
profile entity
profile Arden Cross
dialogue Mrs Harlan
dialogue entity
dialogue Arden Cross
recruit Arden Cross
ask Arden Cross about role
ask Arden Cross about case
observe entity
taunt entity
parley entity
```

## Notes

Warden availability is rolled when a case is generated. Use `hq refresh` to reroll who is currently available at the Warden HQ. Recruitable Wardens can join as NPC allies if the recruitment check succeeds and any cost is paid.
