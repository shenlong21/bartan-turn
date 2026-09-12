import { firebaseConfig, NAMES, BRANDING } from "./config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore,
  doc,
  runTransaction,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const MAX_CATCHUP_DAYS = 90; // safety cap so a long-dormant app doesn't blow up a transaction

// Branding is independent of Firebase — apply it first so the page looks
// right even if the config below is broken or still unset.
document.title = BRANDING.title;
document.getElementById("brand-main").textContent = BRANDING.headerMain;
document.getElementById("brand-accent").textContent = BRANDING.headerAccent;
document.getElementById("tagline").textContent = BRANDING.tagline;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const pointerRef = doc(db, "state", "pointer");

const el = {
  todayLabel: document.getElementById("today-label"),
  todayName: document.getElementById("today-name"),
  skipBtn: document.getElementById("skip-btn"),
  skipNote: document.getElementById("skip-note"),
  queueList: document.getElementById("queue-list"),
  avatarInitial: document.getElementById("avatar-initial"),
  historyToggle: document.getElementById("history-toggle"),
  historyList: document.getElementById("history-list"),
  statusLine: document.getElementById("status-text"),
};

function todayStr() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local timezone
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
}

function daysBetween(a, b) {
  const da = new Date(a + "T00:00:00");
  const db_ = new Date(b + "T00:00:00");
  return Math.round((db_ - da) / 86400000);
}

function skipDocId(date, person) {
  return `${date}_${person}`;
}

// Reads/writes the shared pointer doc, advancing it day-by-day up to today
// and skipping over anyone who has a logged skip for that date.
async function ensureCaughtUp() {
  const today = todayStr();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(pointerRef);

    if (!snap.exists()) {
      tx.set(pointerRef, { index: 0, date: today });
      return;
    }

    let { index, date } = snap.data();
    if (date === today) return;

    let gap = daysBetween(date, today);
    if (gap > MAX_CATCHUP_DAYS) {
      // Long-dormant app: fast-forward without re-checking ancient skip history.
      index = (((index + gap) % NAMES.length) + NAMES.length) % NAMES.length;
      date = today;
      tx.set(pointerRef, { index, date });
      return;
    }

    while (date !== today) {
      const nextDate = addDays(date, 1);
      // Advance through skipped people for nextDate, landing on whoever is actually up.
      for (let i = 0; i < NAMES.length; i++) {
        index = (index + 1) % NAMES.length;
        const person = NAMES[index];
        const skipSnap = await tx.get(doc(db, "skips", skipDocId(nextDate, person)));
        if (!skipSnap.exists()) break; // this person is up for nextDate, not skipped
      }
      date = nextDate;
    }

    tx.set(pointerRef, { index, date });
  });
}

async function skipCurrentTurn() {
  el.skipBtn.disabled = true;
  try {
    await ensureCaughtUp();
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(pointerRef);
      const { index, date } = snap.data();
      const person = NAMES[index];

      // Firestore rules only allow *creating* skip docs, not updating them
      // (deliberately, so history can't be edited after the fact). Once
      // everyone's been skipped once today, the doc for whoever the pointer
      // lands on next already exists — writing to it again would be an
      // "update" and get rejected. Only create it if it's genuinely new;
      // still always advance the pointer either way.
      const skipRef = doc(db, "skips", skipDocId(date, person));
      const skipSnap = await tx.get(skipRef);
      if (!skipSnap.exists()) {
        tx.set(skipRef, { date, person, ts: serverTimestamp() });
      }

      const newIndex = (index + 1) % NAMES.length;
      tx.set(pointerRef, { index: newIndex, date });
    });
    el.skipNote.textContent = "logged — moved to the next person.";
  } catch (err) {
    console.error(err);
    el.skipNote.textContent = "couldn't skip, try again.";
  } finally {
    el.skipBtn.disabled = false;
  }
}

function renderPointer(data) {
  if (!data) return;
  const { index } = data;
  el.todayLabel.textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  el.todayName.textContent = NAMES[index];
  setAvatar(NAMES[index]);

  el.queueList.innerHTML = "";
  for (let pos = 1; pos < NAMES.length; pos++) {
    const person = NAMES[(index + pos) % NAMES.length];
    const when = pos === 1 ? "tomorrow" : formatShortDate(addDays(todayStr(), pos));
    const li = document.createElement("li");
    li.innerHTML = `<span class="who">${person}</span><span class="when">${when}</span>`;
    el.queueList.appendChild(li);
  }
}

// Shows a real 3D model at avatars/<name>.glb if one exists (avatar-3d.js
// handles the actual loading/rendering), falling back to the person's
// initial letter otherwise (no models are provided for most flatmates yet).
function setAvatar(name) {
  el.avatarInitial.textContent = name[0];
  // avatar-3d.js loads three.js from a CDN before it can define this, so it
  // may not exist yet — stash the name and let it pick up on startup.
  window.__todayAvatarName = name;
  if (window.setTodayAvatar) window.setTodayAvatar(name);
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" }).toLowerCase();
}

function renderHistory(docs) {
  el.historyList.innerHTML = "";
  if (docs.length === 0) {
    el.historyList.innerHTML = `<li>no skips logged yet.</li>`;
    return;
  }
  docs.forEach((d) => {
    const li = document.createElement("li");
    li.textContent = `${d.date} — ${d.person} skipped`;
    el.historyList.appendChild(li);
  });
}

async function main() {
  el.statusLine.textContent = "syncing…";
  try {
    await ensureCaughtUp();
  } catch (err) {
    console.error(err);
    el.statusLine.textContent = "connection error — check config.js / Firestore rules.";
    return;
  }

  onSnapshot(pointerRef, (snap) => {
    renderPointer(snap.data());
    el.statusLine.textContent = "live";
  });

  const skipsQuery = query(collection(db, "skips"), orderBy("date", "desc"), limit(10));
  onSnapshot(skipsQuery, (snap) => {
    renderHistory(snap.docs.map((d) => d.data()));
  });

  el.skipBtn.addEventListener("click", skipCurrentTurn);
  el.historyToggle.addEventListener("click", () => {
    const hidden = el.historyList.hasAttribute("hidden");
    if (hidden) el.historyList.removeAttribute("hidden");
    else el.historyList.setAttribute("hidden", "");
    el.historyToggle.textContent = hidden ? "skip history ▴" : "skip history ▾";
  });
}

main();
