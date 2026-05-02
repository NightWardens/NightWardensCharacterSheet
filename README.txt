Night Wardens Beyond Lite v3

Upload these files to the root of your GitHub Pages repository:

- index.html
- night_wardens_data.json

This version adds:
- Landing page with local login/create account
- Dashboard: load character, new character, join campaign
- Guided character creation wizard
- Character image upload saved into exported JSON
- Corrected role attribute recalculation: base 9 + role bonuses
- Guided leveling with role-tier gates before shared skills
- Campaign manager with local campaigns, players, join codes, and chats
- Device autosave through localStorage
- Export/import full vault JSON
- Export/import individual character JSON

Current limitation:
This is a static GitHub Pages/localStorage app. Google sign-in and true private multiplayer campaign chat require a backend such as Firebase Auth + Firestore or Supabase Auth + database policies.

Next suggested package:
Firebase-enabled version with Google login, synced characters, synced campaigns, and per-campaign chat permissions.
