// Copy this file to config.js and fill in your own values.
//
// firebaseConfig is meant to be public/client-side — it's not a secret.
// Firebase's own docs are explicit about this: safety is enforced by the
// Firestore security rules (see firestore.rules), not by hiding this object.
// That's also why it's fine for config.js to be committed to git in a
// no-build static site like this one — there's no server-side step to
// inject it at deploy time otherwise.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Whoever/whatever takes turns, in a fixed rotation order. Edit names/order
// here. The queue, avatars (avatars/<name-lowercased>.glb), and rotation
// logic all key off these exact strings.
export const NAMES = ["Alex", "Sam", "Jordan"];

// Site branding. This template isn't tied to dishwashing specifically —
// change these to repurpose it for any recurring shared duty (trash,
// grocery runs, watering plants, whatever rotates in your house).
export const BRANDING = {
  title: "Turn Tracker",
  headerMain: "Turn",
  headerAccent: "Tracker",
  tagline: "whoever's turn, that's their job.",
};
