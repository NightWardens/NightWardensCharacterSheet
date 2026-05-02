Night Wardens Beyond Lite v4

Upload/replace these files in the GitHub Pages repo root:
- index.html
- night_wardens_data.json
- manifest.webmanifest
- service-worker.js
- icons/ folder, if present

What changed in v4:
- Separate landing/login screen.
- Remember Me auto-login using browser cache.
- Dashboard after login with Load Character, New Character, Join Campaign.
- Saved character list with open/export/delete.
- Saved campaign list with open/export/delete.
- Guided character creation remains included.
- Campaign manager supports local campaigns, players, assigned characters, and local chats.
- Local-only account/campaign/chat storage with vault export/import.

Important:
This is still a static GitHub Pages app. True Google login, cloud sync, player-only chats, and cross-device campaigns require a backend such as Firebase Auth + Firestore or Supabase Auth + Row Level Security.
