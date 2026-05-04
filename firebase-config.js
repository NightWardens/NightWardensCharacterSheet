// firebase-config.js
// Night Wardens Firebase client config.
// Safe for frontend use. DO NOT put firebase-admin or serviceAccountKey.json in GitHub Pages.

window.firebaseConfig = {
  apiKey: "AIzaSyDv8mkLCohfgjD7SWqg3d5-uNaYYXMUboQ",
  authDomain: "nightwardenswebsite.firebaseapp.com",
  projectId: "nightwardenswebsite",
  storageBucket: "nightwardenswebsite.firebasestorage.app",
  messagingSenderId: "298794027808",
  appId: "1:298794027808:web:fa1ed523ac4430b2b76545",
  measurementId: "G-7EVEHLN642"
};

// Alias used by newer Night Wardens packages.
window.NW_FIREBASE_CONFIG = window.firebaseConfig;
