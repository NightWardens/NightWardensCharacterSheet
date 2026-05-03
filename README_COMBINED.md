# Night Wardens Auto-GM — Combined Pass 1-7 Package

This package contains two parts:

## 1) deploy_to_github_root
Upload these files directly to the root of your GitHub Pages repository:

- auto-gm.html
- auto-gm-pass7.js

Then open:

https://scottas369-collab.github.io/NightWardensCharacterSheet/auto-gm.html?v=7.2

## 2) source_passes
This folder archives the full source/data from Passes 1-7:

- Pass 1: data core / CSV vocabularies / master JSON foundation
- Pass 2: typed command parser
- Pass 3: character roll integration and setback/consequence tables
- Pass 4: witness and investigation engine
- Pass 5: creature AI and clue trail
- Pass 6: shared/private campaign layer
- Pass 7: integrated webpage

## Important note
The Pass 7 deploy file is already the working integrated browser version. It inlines/simplifies the major logic from Passes 1-6 into `auto-gm-pass7.js` so GitHub Pages can run it as a static site without a build step.

The earlier pass folders are still included here as developer/reference source so we can keep expanding the Auto-GM brain later without losing the modular pieces.
