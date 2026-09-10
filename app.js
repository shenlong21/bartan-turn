import { firebaseConfig, NAMES } from "./config.js";
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const pointerRef = doc(db, "state", "pointer");

const el = {
  todayLabel: document.getElementById("today-label"),
  todayName: document.getElementById("today-name"),
  skipBtn: document.getElementById("skip-btn"),
  skipNote: document.getElementById("skip-note"),
  queueList: document.getElementById("queue-list"),
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

      tx.set(doc(db, "skips", skipDocId(date, person)), {
        date,
        person,
        ts: serverTimestamp(),
      });

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

  el.queueList.innerHTML = "";
  for (let pos = 1; pos < NAMES.length; pos++) {
    const person = NAMES[(index + pos) % NAMES.length];
    const when = pos === 1 ? "tomorrow" : formatShortDate(addDays(todayStr(), pos));
    const li = document.createElement("li");
    li.innerHTML = `<span class="who">${person}</span><span class="when">${when}</span>`;
    el.queueList.appendChild(li);
  }
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
