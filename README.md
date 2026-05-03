# Night Wardens Auto-GM — Pass 7 Website Integration

This package turns the Auto-GM passes into a working static GitHub Pages webpage.

## Upload to GitHub repo root

Upload these files to the root of your `NightWardensCharacterSheet` repository:

```text
auto-gm.html
auto-gm-pass7.js
```

Then open:

```text
https://scottas369-collab.github.io/NightWardensCharacterSheet/auto-gm.html?v=7.1
```

## What this integrates

Pass 7 combines the prior Auto-GM layers into one working browser app:

- typed command parser
- character JSON import
- roll engine using character attributes and skills
- support skill offsets
- setback consequences
- witness questioning with topics, trust, fear, lies, and hidden truths
- investigation narrowing and clue discovery
- creature AI response based on pressure, failure, entity behavior, and action type
- public party transcript
- private player branch logs
- reveal private clue to party flow
- local save/load/export/import
- campaign-aware URL parameters

## Campaign route support

If your campaign manager opens an Auto-GM campaign with:

```text
auto-gm.html?campaignId=abc123&campaignCode=WARDEN9&caseId=main
```

this page stores its local case data under that campaign/case key.

## Character import

Use the Characters tab to import a character JSON exported from the Digital Field Office.
The engine tries to read:

- `name`
- `role`
- `attributes` or `stats`
- `skills` or `skillRanks`
- `move` / `movement`
- `conditions`

It supports both lower-case and title-case attribute names.

## Typed command examples

```text
look
Riley: investigate altar
Sam: ask Mrs Harlan about the bell
private Alex: research black star symbol
Riley: prep salt line; Sam: cast Veil Snap
Alex: move church basement
Riley: shoot the demon with silver
private Morgan: reveal clue
```

## Public vs private

Public commands go to the party transcript:

```text
Riley: investigate altar
public Sam: talk to witness
```

Private commands go to that player's branch log:

```text
private Alex: research sigil
private Riley: move basement
```

Private clues can later be revealed into the party transcript.

## Firebase note

This pass is intentionally static and local-first. It is Firebase-ready in structure, but does not require Firebase to run.
A later sync patch can connect the `caseState`, public transcript, and private logs to Firestore using the same campaign ID.

## Suggested main app link

In the main Digital Field Guide campaign manager, Auto-GM campaigns should link to:

```html
<a href="auto-gm.html?campaignId=CAMPAIGN_ID&campaignCode=JOIN_CODE&caseId=main">Open Auto-GM</a>
```
