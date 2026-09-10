# Bartan Turn 🍽️

Shows whose turn it is to wash utensils today, synced across everyone's phone, with a "skip today" button that logs who skipped and moves to the next person.

No backend server, no build step — a static site (`index.html` / `style.css` / `app.js`) backed by a free Firebase Firestore database for the shared state, deployable on GitHub Pages.

## How it works

- `NAMES` in `config.js` is the fixed rotation order.
- A single shared doc (`state/pointer`) tracks `{ index, date }` — who's up and as of what date. On every page load it auto-advances day-by-day up to today.
- Tapping **skip** logs a doc in `skips/` (`{ date, person }`) and immediately advances the pointer to the next person, same day.
- Everything syncs live across devices via Firestore listeners — no login, anyone can skip for whoever's currently up.

## 1. Create a free Firebase project

1. Go to https://console.firebase.google.com/ → **Add project** → give it any name (e.g. `bartan-turn`) → you can disable Google Analytics, not needed.
2. Once created, click the **Web** icon (`</>`) to register a web app → name it anything → you don't need Firebase Hosting.
3. Copy the `firebaseConfig` object it shows you.
4. In this project, open `config.js` and paste your values in, and edit `NAMES` to your actual flatmate names/order:

   ```js
   export const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "...",
   };
   export const NAMES = ["H", "J", "S", "V", "Y"];
   ```

## 2. Turn on Firestore

1. In the Firebase console, go to **Build → Firestore Database → Create database**. Start in **production mode**, pick any region.
2. Go to the **Rules** tab and replace the rules with:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /state/pointer {
         allow read: if true;
         allow write: if request.resource.data.keys().hasOnly(['index', 'date'])
                      && request.resource.data.index is int
                      && request.resource.data.date is string;
       }
       match /skips/{id} {
         allow read: if true;
         allow create: if request.resource.data.keys().hasOnly(['date', 'person', 'ts']);
       }
     }
   }
   ```

   This keeps writes shaped correctly but still requires no login — fine for a trusted flat. Click **Publish**.

## 3. Run it locally to test

Any static file server works, e.g.:

```
npx serve .
```

or in VS Code, use the "Live Server" extension. Open the printed localhost URL — you should see today's name, and tapping skip should log it and move to the next person (check the Firestore console to see the docs appear).

> Note: opening `index.html` directly via `file://` won't work — ES module imports require an actual HTTP server.

## 4. Host it on GitHub Pages

```
git init
git add .
git commit -m "bartan turn tracker"
gh repo create bartan-turn --public --source=. --push
```

(or create the repo manually on github.com and `git remote add origin ...` + `git push -u origin main`)

Then on GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: main /(root)**. Your site will be live at `https://<username>.github.io/bartan-turn/` within a minute or two.
