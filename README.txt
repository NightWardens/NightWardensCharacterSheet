Night Wardens Digital Field Office v6 - Firebase Sync Beta

Upload/replace these files in your GitHub Pages repo root:
- index.html
- app.js
- night_wardens_data.json
- manifest.webmanifest
- service-worker.js
- firebase-config.js
- README.txt

Optional Firebase files included for setup/reference:
- firestore.rules
- firebase.json

Firebase setup:
1. Create a Firebase project.
2. Add a Web App in Firebase project settings.
3. Copy the Firebase Web App config into firebase-config.js.
4. Authentication -> Sign-in method -> enable Google.
5. Authentication -> Settings -> Authorized domains -> add:
   scottas369-collab.github.io
6. Firestore Database -> Create database.
7. Firestore Rules -> paste firestore.rules and publish.
8. Upload this package to GitHub Pages.
9. Open with ?v=6.0 after deploy to force the new service worker.

What v6 adds:
- Google sign-in when Firebase is configured.
- Local login still works as an offline fallback.
- Cloud sync button.
- Characters sync under users/{uid}/characters.
- Shared campaigns sync under campaigns/{campaignId} with memberIds.
- Join codes use joinCodes/{CODE}.
- Campaign chats currently sync as part of the campaign object.

Prototype warning:
The included Firestore rules are a beta starting point for playtesting, not final production security. Before public launch, campaign invites and chat permissions should be tightened further, and large chats should move into subcollections.
