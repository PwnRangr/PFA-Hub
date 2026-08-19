// Storage adapter: uses Firebase (shared, real-time) when configured,
// otherwise falls back to this browser's local storage.
import { app, firebaseConfig } from "./firebase-config.js";

export const firebaseReady = Boolean(firebaseConfig && firebaseConfig.apiKey);

let db = null;
let fs = null; // firestore module functions

// Firebase itself is now initialized once, in firebase-config.js (auth.js
// needs that same initialized `app` too) — this just hands Firestore the
// shared instance instead of calling initializeApp a second time, which
// throws ("Firebase App named '[DEFAULT]' already exists").
async function ensureDb() {
  if (!firebaseReady || db) return db;
  fs = await import("firebase/firestore");
  db = fs.getFirestore(app);
  return db;
}

const localGet = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || "null");
  } catch {
    return null;
  }
};
const localSet = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// ── Chat ──
export function watchChat(cb) {
  if (!firebaseReady) {
    cb(localGet("pfa-chat") || []);
    return () => {};
  }
  let unsub = () => {};
  ensureDb().then(() => {
    const q = fs.query(fs.collection(db, "chat"), fs.orderBy("ts"), fs.limitToLast(200));
    unsub = fs.onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))));
  });
  return () => unsub();
}

export async function sendChat(msg) {
  if (!firebaseReady) {
    const entry = { ...msg, id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    const c = (localGet("pfa-chat") || []).concat(entry).slice(-200);
    localSet("pfa-chat", c);
    return c;
  }
  await ensureDb();
  await fs.addDoc(fs.collection(db, "chat"), msg);
  return null;
}

export async function removeChatMessage(id) {
  if (!firebaseReady) {
    const c = (localGet("pfa-chat") || []).filter((m) => m.id !== id);
    localSet("pfa-chat", c);
    return c;
  }
  await ensureDb();
  await fs.deleteDoc(fs.doc(db, "chat", id));
  return null;
}

// Pins/unpins a chat message. NOTE: this needs a Firestore rules change —
// the chat collection's rule only ever had `allow delete: if isMod();`,
// no `update` at all, so this updateDoc call is rejected until the rules
// gain `allow update: if isMod();` under match /chat/{msg}. See the
// companion firestore.rules file delivered alongside this.
export async function pinChatMessage(id, pinned) {
  if (!firebaseReady) {
    const c = (localGet("pfa-chat") || []).map((m) => (m.id === id ? { ...m, pinned } : m));
    localSet("pfa-chat", c);
    return c;
  }
  await ensureDb();
  await fs.updateDoc(fs.doc(db, "chat", id), { pinned });
  return null;
}

// ── News ──
// NOTE the spread order below: `{ ...d.data(), id: d.id }`, NOT
// `{ id: d.id, ...d.data() }`. Some older documents have a stale `id` field
// stored in their own data (written before postNewsItem stopped including
// one). With the spread last, that stale value overwrote the real Firestore
// document ID, so pin/edit/delete addressed a document that doesn't exist
// and failed silently. Putting `id: d.id` last makes the true document ID
// always win, which repairs those older items without a data migration.
// Same reasoning applies to watchChat and watchApplications.
export function watchNews(cb) {
  if (!firebaseReady) {
    cb(localGet("pfa-news") || []);
    return () => {};
  }
  let unsub = () => {};
  ensureDb().then(() => {
    const q = fs.query(fs.collection(db, "news"), fs.orderBy("ts", "desc"), fs.limit(50));
    unsub = fs.onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))));
  });
  return () => unsub();
}

export async function postNewsItem(item) {
  if (!firebaseReady) {
    const entry = { ...item, id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    const n = [entry].concat(localGet("pfa-news") || []).slice(0, 50);
    localSet("pfa-news", n);
    return n;
  }
  await ensureDb();
  await fs.addDoc(fs.collection(db, "news"), item);
  return null;
}

export async function removeNewsItem(id) {
  if (!firebaseReady) {
    const n = (localGet("pfa-news") || []).filter((x) => x.id !== id);
    localSet("pfa-news", n);
    return n;
  }
  await ensureDb();
  await fs.deleteDoc(fs.doc(db, "news", id));
  return null;
}

export async function pinNewsItem(id, pinned) {
  if (!firebaseReady) {
    const n = (localGet("pfa-news") || []).map((x) => (x.id === id ? { ...x, pinned } : x));
    localSet("pfa-news", n);
    return n;
  }
  await ensureDb();
  await fs.updateDoc(fs.doc(db, "news", id), { pinned });
  return null;
}

// Edits an existing news item's tag/title/body in place. Firestore rules
// already cover this — news's `allow write: if isMod();` grants create,
// update, AND delete together, unlike chat (see pinChatMessage below,
// which needed a real rules change since chat only ever had `delete`).
export async function editNewsItem(id, updates) {
  if (!firebaseReady) {
    const n = (localGet("pfa-news") || []).map((x) => (x.id === id ? { ...x, ...updates } : x));
    localSet("pfa-news", n);
    return n;
  }
  await ensureDb();
  await fs.updateDoc(fs.doc(db, "news", id), updates);
  return null;
}

// ── Applications (Apply-to-Team) ──
export function watchApplications(cb) {
  if (!firebaseReady) {
    cb(localGet("pfa-applications") || []);
    return () => {};
  }
  let unsub = () => {};
  ensureDb().then(() => {
    const q = fs.query(fs.collection(db, "applications"), fs.orderBy("ts"));
    unsub = fs.onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))));
  });
  return () => unsub();
}

export async function submitApplication(app) {
  if (!firebaseReady) {
    const entry = { ...app, id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    const a = (localGet("pfa-applications") || []).concat(entry);
    localSet("pfa-applications", a);
    return a;
  }
  await ensureDb();
  await fs.addDoc(fs.collection(db, "applications"), app);
  return null;
}

export async function removeApplication(id) {
  if (!firebaseReady) {
    const a = (localGet("pfa-applications") || []).filter((x) => x.id !== id);
    localSet("pfa-applications", a);
    return a;
  }
  await ensureDb();
  await fs.deleteDoc(fs.doc(db, "applications", id));
  return null;
}

// Marks a specific application as the team's hire. Doesn't touch Sleeper —
// this is the Alliance's own record of the decision; the roster still has
// to be reassigned by hand in Sleeper afterward. The `applications`
// collection's Firestore rule already grants isAdmin() update (same rule
// the ranked applicant list on Standings already relies on), so this needs
// no rules change.
export async function hireApplicant(id) {
  const updates = { hired: true, hiredAt: Date.now() };
  if (!firebaseReady) {
    const a = (localGet("pfa-applications") || []).map((x) => (x.id === id ? { ...x, ...updates } : x));
    localSet("pfa-applications", a);
    return a;
  }
  await ensureDb();
  await fs.updateDoc(fs.doc(db, "applications", id), updates);
  return null;
}

// Reverses a mistaken hire — clears the flag, application goes back to
// being just a ranked, un-hired entry.
export async function unhireApplicant(id) {
  const updates = { hired: false, hiredAt: null };
  if (!firebaseReady) {
    const a = (localGet("pfa-applications") || []).map((x) => (x.id === id ? { ...x, ...updates } : x));
    localSet("pfa-applications", a);
    return a;
  }
  await ensureDb();
  await fs.updateDoc(fs.doc(db, "applications", id), updates);
  return null;
}

// ── Hire Timers (per open team, admin-set auto-hire deadline) ──
// Doc ID is deterministic from tierKey+team so a team only ever has ONE
// active timer doc — setting a new one overwrites rather than piling up
// stale ones. Status moves pending -> processing -> fired; "processing" is
// a short-lived claim state (see claimHireTimer) that exists purely to stop
// two admin tabs open at once from both auto-hiring the same team.
function hireTimerKey(tierKey, team) {
  return `${tierKey}__${team}`;
}

export function watchHireTimers(cb) {
  if (!firebaseReady) {
    cb(Object.values(localGet("pfa-hire-timers") || {}));
    return () => {};
  }
  let unsub = () => {};
  ensureDb().then(() => {
    unsub = fs.onSnapshot(fs.collection(db, "hireTimers"), (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))));
  });
  return () => unsub();
}

export async function setHireTimer(tierKey, team, deadlineMs) {
  const key = hireTimerKey(tierKey, team);
  const data = { tierKey, team, deadline: deadlineMs, status: "pending" };
  if (!firebaseReady) {
    const all = localGet("pfa-hire-timers") || {};
    all[key] = { ...data, id: key };
    localSet("pfa-hire-timers", all);
    return Object.values(all);
  }
  await ensureDb();
  await fs.setDoc(fs.doc(db, "hireTimers", key), data);
  return null;
}

export async function cancelHireTimer(tierKey, team) {
  const key = hireTimerKey(tierKey, team);
  if (!firebaseReady) {
    const all = localGet("pfa-hire-timers") || {};
    delete all[key];
    localSet("pfa-hire-timers", all);
    return Object.values(all);
  }
  await ensureDb();
  await fs.deleteDoc(fs.doc(db, "hireTimers", key));
  return null;
}

// Atomically flips a pending, past-due timer to "processing" so only ONE
// connected admin tab wins the race to actually perform the auto-hire +
// news post — every other admin tab polling at the same moment gets `null`
// back and does nothing. Returns the timer's own data (so the caller
// doesn't need a second read) when this client wins, otherwise null.
export async function claimHireTimer(tierKey, team) {
  const key = hireTimerKey(tierKey, team);
  if (!firebaseReady) {
    const all = localGet("pfa-hire-timers") || {};
    const t = all[key];
    if (!t || t.status !== "pending" || t.deadline > Date.now()) return null;
    all[key] = { ...t, status: "processing" };
    localSet("pfa-hire-timers", all);
    return all[key];
  }
  await ensureDb();
  const ref = fs.doc(db, "hireTimers", key);
  try {
    return await fs.runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return null;
      const data = snap.data();
      if (data.status !== "pending" || data.deadline > Date.now()) return null;
      tx.update(ref, { status: "processing" });
      return { ...data, id: key };
    });
  } catch (e) {
    console.error("claimHireTimer failed", e);
    return null;
  }
}

export async function markHireTimerDone(tierKey, team, status) {
  const key = hireTimerKey(tierKey, team);
  if (!firebaseReady) {
    const all = localGet("pfa-hire-timers") || {};
    if (all[key]) all[key] = { ...all[key], status };
    localSet("pfa-hire-timers", all);
    return;
  }
  await ensureDb();
  await fs.updateDoc(fs.doc(db, "hireTimers", key), { status });
}

// ── Promotion Window (global, commissioner-controlled on/off switch) ──
export function watchPromotionWindow(cb) {
  if (!firebaseReady) {
    cb(Boolean(localGet("pfa-promotion-window")));
    return () => {};
  }
  let unsub = () => {};
  ensureDb().then(() => {
    unsub = fs.onSnapshot(fs.doc(db, "settings", "promotionWindow"), (snap) => {
      cb(snap.exists() ? Boolean(snap.data().open) : false);
    });
  });
  return () => unsub();
}

export async function setPromotionWindow(isOpen) {
  if (!firebaseReady) {
    localSet("pfa-promotion-window", isOpen);
    return isOpen;
  }
  await ensureDb();
  await fs.setDoc(fs.doc(db, "settings", "promotionWindow"), { open: isOpen });
  return null;
}

// ── Weekly Results (Weekly Awards tab's cache) ──
// One doc per {tierKey, year, week}, doc ID built directly from those three
// so a lookup is a single getDoc, never a query. Written once per league-week,
// ever — App.jsx checks here before ever hitting Sleeper.
function weeklyResultKey(tierKey, year, week) {
  return `${tierKey}_${year}_${week}`;
}

export async function getWeeklyResult(tierKey, year, week) {
  const key = weeklyResultKey(tierKey, year, week);
  if (!firebaseReady) {
    return (localGet("pfa-weekly-results") || {})[key] || null;
  }
  await ensureDb();
  const snap = await fs.getDoc(fs.doc(db, "weeklyResults", key));
  return snap.exists() ? snap.data() : null;
}

export async function setWeeklyResult(tierKey, year, week, data) {
  const key = weeklyResultKey(tierKey, year, week);
  if (!firebaseReady) {
    const all = localGet("pfa-weekly-results") || {};
    all[key] = data;
    localSet("pfa-weekly-results", all);
    return data;
  }
  await ensureDb();
  await fs.setDoc(fs.doc(db, "weeklyResults", key), data);
  return null;
}

// ── 300 Club (live, auto-detected) ──
// Doc ID is deterministic from the find itself (tier/year/week/roster), so
// the SAME score getting detected twice — once via the Weekly Awards lazy
// fetch, once via the existing current-week fetch in loadLeague — just
// overwrites the same doc rather than duplicating an entry.
function club300Key(tierKey, year, week, rosterId) {
  return `${tierKey}_${year}_${week}_${rosterId}`;
}

export async function addClub300Entry(tierKey, year, week, rosterId, entry) {
  const key = club300Key(tierKey, year, week, rosterId);
  if (!firebaseReady) {
    const all = localGet("pfa-club300-live") || {};
    all[key] = entry;
    localSet("pfa-club300-live", all);
    return Object.values(all); // local fallback only; Firebase updates via watchClub300Live's snapshot
  }
  await ensureDb();
  await fs.setDoc(fs.doc(db, "club300Live", key), entry);
  return null;
}

export function watchClub300Live(cb) {
  if (!firebaseReady) {
    cb(Object.values(localGet("pfa-club300-live") || {}));
    return () => {};
  }
  let unsub = () => {};
  ensureDb().then(() => {
    unsub = fs.onSnapshot(fs.collection(db, "club300Live"), (snap) => cb(snap.docs.map((d) => d.data())));
  });
  return () => unsub();
}

// ── Streak Bonuses (X Points, live/auto-computed) ──
// Same shape as club300Live above: one doc per qualifying WEEK, not one doc
// per roster-season. A roster on an 8-game win streak earns a bonus on
// weeks 4 through 8 (5 separate paying weeks under the tiered table), so
// each of those weeks is its own doc — deterministic key means re-running
// the sweep (e.g. after a new week's games go final) just overwrites that
// week's doc instead of duplicating it. Season totals are a SUM over every
// doc matching a given {tierKey, year, rosterId}, computed by whoever reads
// this collection (see watchStreakBonusesLive) rather than stored anywhere
// separately, so there's never a stale cached total to fall out of sync.
function streakBonusKey(tierKey, year, week, rosterId) {
  return `${tierKey}_${year}_${week}_${rosterId}`;
}

export async function addStreakBonusEntry(tierKey, year, week, rosterId, entry) {
  const key = streakBonusKey(tierKey, year, week, rosterId);
  if (!firebaseReady) {
    const all = localGet("pfa-streak-bonuses-live") || {};
    all[key] = entry;
    localSet("pfa-streak-bonuses-live", all);
    return Object.values(all); // local fallback only; Firebase updates via watchStreakBonusesLive's snapshot
  }
  await ensureDb();
  await fs.setDoc(fs.doc(db, "streakBonusesLive", key), entry);
  return null;
}

export function watchStreakBonusesLive(cb) {
  if (!firebaseReady) {
    cb(Object.values(localGet("pfa-streak-bonuses-live") || {}));
    return () => {};
  }
  let unsub = () => {};
  ensureDb().then(() => {
    unsub = fs.onSnapshot(fs.collection(db, "streakBonusesLive"), (snap) => cb(snap.docs.map((d) => d.data())));
  });
  return () => unsub();
}

// ── Manual Coach Penalties/Bonuses ──
// Unlike streakBonusesLive above (deterministic key, one doc per paying
// week), these are entered one at a time by an admin for real-life-conduct
// reasons the site has no way to detect automatically — no natural "one
// per X" key, so same addDoc/auto-ID shape as chat above, not a setDoc key.
// entry shape: { tierKey, year, rosterId, coach, team, points, description,
// addedBy, addedAt }. `points` carries its own sign (negative = penalty,
// positive = bonus) — the UI presents them as two separate actions, but
// they're the same collection underneath.
export function watchManualPenalties(cb) {
  if (!firebaseReady) {
    cb(localGet("pfa-manual-penalties") || []);
    return () => {};
  }
  let unsub = () => {};
  ensureDb().then(() => {
    unsub = fs.onSnapshot(fs.collection(db, "manualPenalties"), (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))));
  });
  return () => unsub();
}

export async function addManualPenalty(entry) {
  if (!firebaseReady) {
    const withId = { ...entry, id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    const all = (localGet("pfa-manual-penalties") || []).concat(withId);
    localSet("pfa-manual-penalties", all);
    return all;
  }
  await ensureDb();
  await fs.addDoc(fs.collection(db, "manualPenalties"), entry);
  return null;
}

export async function removeManualPenalty(id) {
  if (!firebaseReady) {
    const all = (localGet("pfa-manual-penalties") || []).filter((p) => p.id !== id);
    localSet("pfa-manual-penalties", all);
    return all;
  }
  await ensureDb();
  await fs.deleteDoc(fs.doc(db, "manualPenalties", id));
  return null;
}

// ── Season CP — final locked record ──
// The permanent, official Season CP snapshot for a completed tier/year,
// written once by the Admin "Lock Final Season CP" action (App.jsx) instead
// of ever being recomputed live like the current season's running total is.
// Deterministic key (same pattern as streakBonusesLive above) — safe to
// re-run the lock for a tier/year already written, e.g. after League
// Strength's historical formula lands and needs to fill in a value that was
// previously null; it just overwrites, never duplicates.
//
// entry shape: { coach, team, tierKey, year, rosterId, place, winPoints,
// pointsComponent, faabComponent, xPointsTotal, penaltiesBonusesTotal,
// placeCP, leagueStrengthCP, ptsMaxRatio, total, pending }. `leagueStrengthCP`
// is null until the historical League Strength formula is built (on hold as
// of 2026-08-19); `pending` is an array of component names still missing
// from `total` (e.g. ["leagueStrength"], or ["leagueStrength","faab"] for a
// year with no confirmed FAAB starting budget) — so a partial record says so
// plainly instead of presenting an incomplete total as final.
function seasonCPFinalKey(tierKey, year, rosterId) {
  return `${tierKey}_${year}_${rosterId}`;
}

export async function writeSeasonCPFinalEntry(tierKey, year, rosterId, entry) {
  const key = seasonCPFinalKey(tierKey, year, rosterId);
  if (!firebaseReady) {
    const all = localGet("pfa-season-cp-final") || {};
    all[key] = entry;
    localSet("pfa-season-cp-final", all);
    return Object.values(all);
  }
  await ensureDb();
  await fs.setDoc(fs.doc(db, "seasonCPFinal", key), entry);
  return null;
}

export function watchSeasonCPFinal(cb) {
  if (!firebaseReady) {
    cb(Object.values(localGet("pfa-season-cp-final") || {}));
    return () => {};
  }
  let unsub = () => {};
  ensureDb().then(() => {
    unsub = fs.onSnapshot(fs.collection(db, "seasonCPFinal"), (snap) => cb(snap.docs.map((d) => d.data())));
  });
  return () => unsub();
}

// ── 4000 Club (live, auto-detected) ──
// Same shape as club300Live above, but the "score" being checked is a
// roster's SEASON total (Sleeper's own running fpts/fpts_decimal — the
// exact number Standings' PF column already shows), not a single week's
// matchup score. Doc ID is deterministic from tier/year/roster (no week —
// there's only ever one season total per roster per year), so re-running
// the sweep is always safe to repeat, never duplicates an entry.
function club4000Key(tierKey, year, rosterId) {
  return `${tierKey}_${year}_${rosterId}`;
}

export async function addClub4000Entry(tierKey, year, rosterId, entry) {
  const key = club4000Key(tierKey, year, rosterId);
  if (!firebaseReady) {
    const all = localGet("pfa-club4000-live") || {};
    all[key] = entry;
    localSet("pfa-club4000-live", all);
    return Object.values(all); // local fallback only; Firebase updates via watchClub4000Live's snapshot
  }
  await ensureDb();
  await fs.setDoc(fs.doc(db, "club4000Live", key), entry);
  return null;
}

export function watchClub4000Live(cb) {
  if (!firebaseReady) {
    cb(Object.values(localGet("pfa-club4000-live") || {}));
    return () => {};
  }
  let unsub = () => {};
  ensureDb().then(() => {
    unsub = fs.onSnapshot(fs.collection(db, "club4000Live"), (snap) => cb(snap.docs.map((d) => d.data())));
  });
  return () => unsub();
}

// Guards the 13-league sweep (see detect4000/its calling effect in App.jsx)
// so it only actually hits Sleeper once per season, the first time anyone
// loads the site after week 17 -- without this, EVERY page load for the
// rest of the off-season would re-fetch all 13 leagues just to find
// nothing new. Same write-once/read-thereafter shape as tournamentSeeds
// below, just a bare marker instead of seed data.
export async function getClub4000ProcessedYear(year) {
  const key = `pfa-club4000-processed-${year}`;
  if (!firebaseReady) {
    return Boolean(localGet(key));
  }
  await ensureDb();
  const snap = await fs.getDoc(fs.doc(db, "club4000Processed", String(year)));
  return snap.exists();
}

export async function markClub4000ProcessedYear(year) {
  const key = `pfa-club4000-processed-${year}`;
  if (!firebaseReady) {
    localSet(key, true);
    return;
  }
  await ensureDb();
  const ref = fs.doc(db, "club4000Processed", String(year));
  const existing = await fs.getDoc(ref);
  if (existing.exists()) return;
  await fs.setDoc(ref, { processedAt: fs.serverTimestamp() });
}

// ── Tournament (frozen seed snapshot, written once per season) ──
// One doc per season — tournamentSeeds/{year}. Written ONCE, at the
// Week7->Week8 rollover, then only ever read from for the rest of that
// season's event — a real single-elimination bracket can't reseed itself
// mid-tournament the way R3_LIVE/BR_LIVE harmlessly do every render. The
// Firestore rules also enforce write-once at the security layer (create
// allowed only if the doc doesn't already exist; update/delete always
// denied) — the existence check below just avoids an unnecessary
// round-trip and gives the caller a clean "already existed" signal, it
// isn't the only thing preventing an overwrite.
export async function getTournamentSeeds(year) {
  const key = `pfa-tournament-seeds-${year}`;
  if (!firebaseReady) {
    return localGet(key);
  }
  await ensureDb();
  const snap = await fs.getDoc(fs.doc(db, "tournamentSeeds", String(year)));
  return snap.exists() ? snap.data().seeds : null;
}

export async function setTournamentSeeds(year, seeds) {
  const key = `pfa-tournament-seeds-${year}`;
  if (!firebaseReady) {
    if (localGet(key)) return; // already set locally — never overwrite
    localSet(key, seeds);
    return;
  }
  await ensureDb();
  const ref = fs.doc(db, "tournamentSeeds", String(year));
  const existing = await fs.getDoc(ref);
  if (existing.exists()) return;
  await fs.setDoc(ref, { seeds, frozenAt: fs.serverTimestamp() });
}

// ── UFL Pro Bowl (frozen seed snapshot, written once per season) ──
// Same write-once/read-thereafter shape as tournamentSeeds above, just its
// own collection since it's a separate companion event with its own
// 8-team field (top 4 USFL + top 4 XFL) and its own freeze point
// (Week9->Week10 rollover, one week later than the main Tournament's).
export async function getUflProBowlSeeds(year) {
  const key = `pfa-ufl-pro-bowl-seeds-${year}`;
  if (!firebaseReady) {
    return localGet(key);
  }
  await ensureDb();
  const snap = await fs.getDoc(fs.doc(db, "uflProBowlSeeds", String(year)));
  return snap.exists() ? snap.data().seeds : null;
}

export async function setUflProBowlSeeds(year, seeds) {
  const key = `pfa-ufl-pro-bowl-seeds-${year}`;
  if (!firebaseReady) {
    if (localGet(key)) return; // already set locally — never overwrite
    localSet(key, seeds);
    return;
  }
  await ensureDb();
  const ref = fs.doc(db, "uflProBowlSeeds", String(year));
  const existing = await fs.getDoc(ref);
  if (existing.exists()) return;
  await fs.setDoc(ref, { seeds, frozenAt: fs.serverTimestamp() });
}
