# Bartan Turn 🍽️

Shows whose turn it is to do a recurring shared chore today, synced live across everyone's phone, with a "skip" button that logs who skipped and moves to the next person. Built for dishwashing duty in a flat of five, but nothing about it is dish-specific — rename it, change the rotation, and it works for any recurring shared duty.

![Screenshot of the app: a warm gradient background, "बर्तन ट्रैकर" logo, today's name in giant type, a queue of who's up next, and an animated 3D avatar standing on a glowing rotating dial](screenshot.png)

No backend server, no build step — plain HTML/CSS/JS, backed by a free Firebase Firestore database for the shared state, deployable on GitHub Pages.

## Features

- **Live sync** across every device — no login, no accounts, just a shared link.
- **Auto-advancing rotation** — the pointer catches itself up day-by-day on load, so the app works correctly even if nobody opens it for a week.
- **Skip logging** — tap skip if you're not around today; it's logged permanently and the turn moves on.
- **Animated background dial** — a rotating, glowing dashboard-style piece (anime.js) in the visual language of animejs.com's own homepage, restyled around kitchen utensils.
- **Optional real 3D avatars** — drop a rigged `.glb` model in `avatars/<name>.glb` and that person's actual 3D avatar pops up and stands on the dial with a looping idle animation; anyone without one just gets a plain initial-letter badge. Entirely optional, degrades gracefully.
- **Configurable branding** — the name, tagline, and rotation list all live in one config file. Nothing about the chore itself is hardcoded into the markup.

## Tech stack

- Vanilla HTML/CSS/JS, ES modules, zero build step
- [Firebase Firestore](https://firebase.google.com/docs/firestore) (free tier) for shared state
- [anime.js](https://animejs.com/) for the background dial
- [three.js](https://threejs.org/) + GLTFLoader for the optional 3D avatars
- Hosted on GitHub Pages

## Quick start — fork and configure your own

### 1. Fork or clone this repo

```
git clone https://github.com/<you>/bartan-turn.git
cd bartan-turn
```

### 2. Create a free Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com/) → **Add project** → any name → you can disable Google Analytics, not needed.
2. Click the **Web** icon (`</>`) to register a web app → any name → you don't need Firebase Hosting.
3. Copy the `firebaseConfig` object it shows you — you'll need it in step 4.
4. Go to **Build → Firestore Database → Create database**. Start in **production mode**, pick any region.
5. Go to the **Rules** tab, paste in the contents of [`firestore.rules`](firestore.rules) from this repo, and click **Publish**.

### 3. Configure the app

```
cp config.example.js config.js
```

Open `config.js` and fill in:
- `firebaseConfig` — the object you copied in step 2.3.
- `NAMES` — whoever/whatever takes turns, in rotation order.
- `BRANDING` — the site title, header text, and tagline. Change these to repurpose the app for a different chore.

`config.js` is meant to be committed — see the comment at the top of `config.example.js` for why that's fine even though it holds your Firebase config.

### 4. Run it locally

```
npx serve .
```

Open the printed URL. ES module imports require an actual HTTP server — opening `index.html` directly via `file://` won't work.

### 5. Deploy to GitHub Pages

```
git add .
git commit -m "configure my instance"
gh repo create <your-repo-name> --public --source=. --remote=origin --push
```

Then on GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: master /(root)**. Live in a minute or two at `https://<you>.github.io/<repo>/`.

## Adding 3D avatars (optional)

Without any setup, everyone gets a plain colored circle with their initial. To give someone a real animated 3D avatar instead:

1. Go to [Avaturn](https://avaturn.me) (or another glTF-exporting avatar tool) and create an avatar from a selfie.
2. **Download the "Avatar with animation" export**, not the plain T-Pose one — the app relies on the export's own baked idle animation for a natural standing pose. A pure T-Pose export renders with arms stiffly out to the sides.
3. Save the file as `avatars/<name>.glb`, where `<name>` is that person's entry in `NAMES`, **lowercased** (e.g. `NAMES` has `"Sachin"` → `avatars/sachin.glb`).
4. Reload the page. `avatar-3d.js` picks it up automatically next time that person is up — no code changes needed.

Models are a few MB each; only whoever's turn it is today gets loaded, not all of them at once.

## Project structure

```
index.html          Markup — layout, the SVG dial, the avatar mount point
style.css            All styling, including the mobile/desktop layout split
app.js               Firestore sync, rotation logic, skip handling, branding injection
config.js            Your Firebase config, NAMES, and BRANDING — committed, not a secret (see above)
config.example.js    Template to copy to config.js
dial-animation.js    The animated background dial (anime.js)
avatar-3d.js         Loads/renders/animates the optional 3D avatars (three.js)
avatars/             Optional per-person .glb models — avatars/<name>.glb
firestore.rules      The Firestore security rules — paste into the Firebase console
```

## Known limitations

- **No auth** — anyone with the link can skip for anyone. Fine for a trusted flat; not meant for anything more adversarial than that.
- **Firebase config is committed** — this is intentional (see `config.example.js`), not an oversight. It's not a secret; security is enforced by `firestore.rules`, not by hiding the API key. If you fork this, your flatmates' names end up in your repo's git history the same way.
- **Avatar files are a few MB each** — fine for a handful of flatmates on a personal project, not something you'd want at real scale.
- **`master` is the default branch** — GitHub Pages setup above assumes that; adjust if yours is `main`.

## License

MIT — see [LICENSE](LICENSE).
