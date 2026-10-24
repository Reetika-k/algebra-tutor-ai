/* AlgebraTutor AI – saved progress (Phase 4). Plain script, no framework; exposes window.Progress.
   Storage key "algebratutor.v2":
     { version: 2, profile, stats: { byTopic, mistakes }, recentPrompts, history: [{ id, date, attempted, correct, topics, migrated? }] }
   - stats.byTopic holds every saved first-attempt result (what recommendations use);
   - history keeps one row per session, newest last, updated live as answers come in;
   - a v1 record ("algebratutor.v1") is migrated once: its totals become one "earlier" history row, and the v1 key is left untouched.
   Everything is size-capped so the record stays small. Nothing leaves the browser except what the page sends to the API. */
(function (root) {
  "use strict";
  const KEY_V1 = "algebratutor.v1";
  const KEY_V2 = "algebratutor.v2";
  const MAX_HISTORY = 30;
  const MAX_MISTAKES = 30; // the summary endpoint accepts at most 30
  const MAX_PROMPTS = 40;

  const isCount = (n) => Number.isInteger(n) && n >= 0;

  /** Keep only well-formed { attempted, correct } rows, with correct ≤ attempted. */
  function cleanByTopic(byTopic) {
    const out = {};
    for (const [id, s] of Object.entries(byTopic || {})) {
      if (!s || !isCount(s.attempted) || !isCount(s.correct) || s.attempted === 0) continue;
      out[id] = { attempted: s.attempted, correct: Math.min(s.correct, s.attempted) };
    }
    return out;
  }
  function cleanMistakes(list) {
    return (Array.isArray(list) ? list : [])
      .filter((m) => m && typeof m.question === "string")
      .map((m) => ({ question: String(m.question).slice(0, 400), studentAnswer: String(m.studentAnswer ?? "").slice(0, 100), correctAnswer: String(m.correctAnswer ?? "?").slice(0, 80) }))
      .slice(-MAX_MISTAKES);
  }
  function totals(byTopic) {
    return Object.values(byTopic || {}).reduce((a, s) => ({ attempted: a.attempted + s.attempted, correct: a.correct + s.correct }), { attempted: 0, correct: 0 });
  }

  function empty() {
    return { version: 2, profile: null, stats: { byTopic: {}, mistakes: [] }, recentPrompts: [], history: [] };
  }

  /** Normalise and cap a v2 record (also used before every save). */
  function normalise(rec) {
    const s = empty();
    if (!rec || typeof rec !== "object") return s;
    const p = rec.profile;
    s.profile = p && typeof p.name === "string" && typeof p.level === "string" && typeof p.topic === "string" ? { name: p.name.slice(0, 40), level: p.level, topic: p.topic } : null;
    s.stats = { byTopic: cleanByTopic(rec.stats?.byTopic), mistakes: cleanMistakes(rec.stats?.mistakes) };
    s.recentPrompts = (Array.isArray(rec.recentPrompts) ? rec.recentPrompts : []).filter((x) => typeof x === "string").slice(-MAX_PROMPTS);
    s.history = (Array.isArray(rec.history) ? rec.history : [])
      .filter((h) => h && typeof h.id === "string" && isCount(h.attempted) && isCount(h.correct) && h.attempted > 0)
      .map((h) => ({ id: h.id, date: typeof h.date === "string" ? h.date : null, attempted: h.attempted, correct: Math.min(h.correct, h.attempted), topics: cleanByTopic(h.topics), ...(h.migrated ? { migrated: true } : {}) }))
      .slice(-MAX_HISTORY);
    return s;
  }

  /** v1 { profile, stats, recentPrompts } → v2. The v1 totals become one history row marked as migrated. */
  function migrate(v1) {
    const s = normalise({ profile: v1?.profile, stats: v1?.stats, recentPrompts: v1?.recentPrompts, history: [] });
    const t = totals(s.stats.byTopic);
    if (t.attempted > 0) s.history.push({ id: "before-history", date: null, attempted: t.attempted, correct: t.correct, topics: { ...s.stats.byTopic }, migrated: true });
    return s;
  }

  function read(storage, key) {
    try { return JSON.parse(storage.getItem(key) || "null"); } catch { return null; }
  }

  /** Load v2, or migrate v1 once, or start empty. Returns { record, migrated }. */
  function load(storage) {
    const v2 = read(storage, KEY_V2);
    if (v2 && v2.version === 2) return { record: normalise(v2), migrated: false };
    const v1 = read(storage, KEY_V1);
    if (v1) return { record: migrate(v1), migrated: true };
    return { record: empty(), migrated: false };
  }

  function save(storage, record) {
    try { storage.setItem(KEY_V2, JSON.stringify(normalise(record))); return true; } catch { return false; }
  }

  function clear(storage) {
    try { storage.removeItem(KEY_V2); storage.removeItem(KEY_V1); } catch { /* storage unavailable */ }
  }

  /** Add one first-attempt result to the saved totals and to this session's history row. Mutates and returns record. */
  function record(rec, session, topic, correctFirstTry) {
    const s = (rec.stats.byTopic[topic] ||= { attempted: 0, correct: 0 });
    s.attempted += 1;
    if (correctFirstTry) s.correct += 1;
    let row = rec.history.find((h) => h.id === session.id);
    if (!row) { row = { id: session.id, date: session.startedAt, attempted: 0, correct: 0, topics: {} }; rec.history.push(row); }
    row.attempted += 1;
    if (correctFirstTry) row.correct += 1;
    const rt = (row.topics[topic] ||= { attempted: 0, correct: 0 });
    rt.attempted += 1;
    if (correctFirstTry) rt.correct += 1;
    rec.history = rec.history.slice(-MAX_HISTORY);
    return rec;
  }

  root.Progress = { KEY_V1, KEY_V2, MAX_HISTORY, MAX_MISTAKES, MAX_PROMPTS, empty, normalise, migrate, load, save, clear, record, totals };
})(typeof window !== "undefined" ? window : globalThis);
