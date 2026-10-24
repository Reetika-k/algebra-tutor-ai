/* AlgebraTutor AI – frontend. Plain JS, no framework.
   State lives in the browser. Saved progress (profile, all first-attempt results, session history) goes to
   localStorage through progress.js ("algebratutor.v2"); this session's counts are kept separately in memory. */

const $ = (sel) => document.querySelector(sel);
const newSession = () => ({ id: "s" + Date.now().toString(36), startedAt: new Date().toISOString(), byTopic: {}, mistakes: [] });

const state = {
  profile: null,
  mode: "learn",
  topics: [],
  maxAttempts: { practice: 3, quiz: 1 },
  chats: { learn: [], doubt: [] },                    // API message history per chat mode
  transcripts: { learn: [], practice: [], quiz: [], doubt: [] }, // rendered items per tab
  practice: { question: null, attempt: 1, done: true, pendingMistake: null, hints: [], hintLevel: 0 }, // hints: texts already shown for this question
  quiz: { active: false, questions: [], index: 0, score: 0, awaitingNext: false, pendingMistake: null },
  stats: { byTopic: {}, mistakes: [] }, // all saved first-attempt results (recommendations use these)
  history: [],                           // one row per session, saved
  session: newSession(),                 // this session only (the progress panel and "Today's performance")
  bias: null,                            // { topic, value: "easier" | "harder" } from a recommendation
  recentPrompts: [],
  busy: false,
  pending: null, // what the app is waiting for while busy: "question" | "quiz" | "check" | "reply" | "lesson"
};

// ---------- persistence (progress.js) ----------
function save() {
  const rec = Progress.normalise({ version: 2, profile: state.profile, stats: state.stats, recentPrompts: state.recentPrompts, history: state.history });
  state.stats = rec.stats; state.history = rec.history; state.recentPrompts = rec.recentPrompts; // keep the caps in memory too
  Progress.save(localStorage, rec);
}
function loadSaved() {
  try { return Progress.load(localStorage).record; } catch { return Progress.empty(); }
}
function addMistake(m) {
  state.stats.mistakes.push(m);
  state.session.mistakes.push(m);
}

// ---------- api ----------
// Phase 6: every request has a timeout (longer than the server's own 300 s model limit for generation, so the
// server answers first), and GET reads are retried once. Errors carry a kind so the page can react to them.
const TIMEOUT_MS = { "/api/questions": 330_000, "/api/evaluate": 200_000, "/api/chat": 200_000, "/api/summary": 200_000 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(path, body, { retries = body ? 0 : 1 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    // A mixed revision quiz makes one model call per topic; on a local model these run one after another.
    const limit = body?.topics ? 330_000 * Math.min(body.topics.length, 5) : TIMEOUT_MS[path] || 20_000;
    const timer = setTimeout(() => ctrl.abort(), limit);
    let res;
    try {
      res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal } : { signal: ctrl.signal });
    } catch {
      clearTimeout(timer);
      if (attempt < retries) { await sleep(1000); continue; }
      const timedOut = ctrl.signal.aborted;
      const e = new Error(timedOut ? "The tutor is taking too long to answer. Please try again." : "Can't reach the tutor server. Check that it is running, then try again.");
      e.status = 0; e.kind = timedOut ? "timeout" : "network";
      throw e;
    }
    clearTimeout(timer);
    const data = await res.json().catch(() => ({ error: `The server returned an unexpected reply (${res.status}).` }));
    if (!res.ok) {
      if (attempt < retries && res.status >= 500) { await sleep(1000); continue; }
      const e = new Error(data.error || `Request failed (${res.status})`); e.status = res.status; e.kind = data.kind; e.details = data.details;
      throw e;
    }
    return data;
  }
}

// ---------- rendering ----------
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function rich(text) { return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }
const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const HINT_STEP = { 1: "the idea", 2: "next step" };
const SLOW_NOTE = "This is taking longer than usual. The tutor's model can need a minute or two; please keep this page open.";
/** Diagnosis from the app's deterministic analyser: shown only when there is evidence (likely / possible). */
function diagnosisLine(d) {
  if (!d || d.confidence === "unknown") return "";
  return `<div class="diag ${d.confidence}">${icon("target")}<span><b>${d.confidence === "likely" ? "Likely mistake" : "Possible mistake"}:</b> ${escapeHtml(d.label)}</span></div>`;
}
const PENDING_LABEL = { example: "Preparing a worked example", hint: "Finding a hint", check: "Checking your answer", reply: "Thinking", lesson: "Preparing your lesson", summary: "Preparing your summary" };

let itemSeq = 0;
function push(mode, item) { item.uid ??= ++itemSeq; state.transcripts[mode].push(item); if (mode === state.mode) renderChat(); }

// ---------- balance scale (Phase 5): verified steps from the server, drawn as a level scale ----------
const OP_BADGE = { subtract: (a) => `− ${a}`, add: (a) => `+ ${a}`, divide: (a) => `÷ ${a}`, multiply: (a) => `× ${a}`, expand: () => "expand", collect: () => "collect", swap: () => "swap sides" };
function scaleSvg(step) {
  const [left, right] = step.line.split(" = ");
  const size = (t) => Math.max(14, Math.min(24, Math.floor(330 / Math.max(6, t.length))));
  const badge = OP_BADGE[step.op]?.(step.amount) || "";
  const both = badge && step.op !== "swap" && step.op !== "expand" && step.op !== "collect";
  const pill = (x, text) => `<g class="sc-badge"><rect x="${x - 54}" y="2" width="108" height="34" rx="17"/><text x="${x}" y="26" text-anchor="middle">${escapeHtml(text)}</text></g>`;
  return `<svg class="scale" viewBox="0 0 560 210" role="img" aria-label="${escapeHtml(`Balance scale, level: left side ${left}, right side ${right}.${badge ? ` Done to both sides: ${step.label}.` : ""}`)}">
    ${both ? pill(140, badge) + pill(420, badge) : badge ? pill(280, badge) : ""}
    <line class="sc-post" x1="280" y1="62" x2="280" y2="178"/>
    <polygon class="sc-base" points="280,166 246,202 314,202"/>
    <line class="sc-beam" x1="60" y1="62" x2="500" y2="62"/>
    <circle class="sc-pivot" cx="280" cy="62" r="7"/>
    <line class="sc-string" x1="140" y1="62" x2="140" y2="96"/><line class="sc-string" x1="420" y1="62" x2="420" y2="96"/>
    <rect class="sc-pan" x="26" y="96" width="228" height="62" rx="16"/><rect class="sc-pan" x="306" y="96" width="228" height="62" rx="16"/>
    <text class="sc-expr" x="140" y="${135 + size(left) / 3}" text-anchor="middle" font-size="${size(left)}">${escapeHtml(left)}</text>
    <text class="sc-expr" x="420" y="${135 + size(right) / 3}" text-anchor="middle" font-size="${size(right)}">${escapeHtml(right)}</text>
  </svg>`;
}
function stepsBody(item) {
  const steps = item.steps;
  const i = Math.min(item.view?.i ?? 0, steps.length - 1);
  const s = steps[i];
  return `${scaleSvg(s)}
    <p class="sc-caption"><b>${escapeHtml(s.label)}.</b> ${escapeHtml(s.why)}</p>
    <ol class="step-list">${steps.map((st, k) => `<li><button type="button" data-step-i="${k}" class="${k === i ? "active" : ""}" aria-current="${k === i}"><span class="st-line">${escapeHtml(st.line)}</span>${k ? `<span class="st-op">${escapeHtml(st.label)}</span>` : ""}</button></li>`).join("")}</ol>
    <div class="step-nav"><button type="button" class="btn-ghost" data-step-move="-1"${i === 0 ? " disabled" : ""}>Back</button><span>Step ${i + 1} of ${steps.length}</span><button type="button" class="btn btn-primary" data-step-move="1"${i === steps.length - 1 ? " disabled" : ""}>Next step</button></div>`;
}
/** Collapsible step viewer; `open` items start expanded. Every line was checked by the server to keep the same root. */
function stepsView(item, title) {
  item.view ??= { i: 0, open: false };
  return `<details class="steps" data-uid="${item.uid}"${item.view.open ? " open" : ""}><summary>${icon("layers")}<span>${title}</span><span class="verified">${icon("check")}Every line checked</span></summary><div class="steps-body">${stepsBody(item)}</div></details>`;
}
function findItem(uid) { return state.transcripts[state.mode].find((x) => x.uid === uid); }

function withAvatar(el, side) {
  const row = document.createElement("div");
  row.className = "row from-" + side; // "from-" avoids colliding with the .tutor column class
  if (side === "tutor") { const a = document.createElement("span"); a.className = "avatar"; a.setAttribute("aria-hidden", "true"); a.textContent = "AT"; row.appendChild(a); }
  row.appendChild(el);
  return row;
}

function renderChat() {
  const chat = $("#chat");
  chat.innerHTML = "";
  for (const item of state.transcripts[state.mode]) {
    const el = document.createElement("div");
    if (item.type === "question") {
      el.className = "msg question";
      el.innerHTML = `<div class="qlabel">${escapeHtml(item.label)}</div><div class="qtext">${escapeHtml(item.text)}</div>`;
    } else if (item.type === "feedback") {
      el.className = `feedback ${item.verdict}`;
      const v = { correct: "Correct", incorrect: "Not yet", partial: "Partly right", unclear: "I need an answer" }[item.verdict];
      el.innerHTML = `<div class="verdict">${v}${item.attemptsLeft != null && (item.verdict === "incorrect" || item.verdict === "partial") && !item.revealed ? ` · ${item.attemptsLeft} attempt${item.attemptsLeft === 1 ? "" : "s"} left` : ""}</div>
        ${diagnosisLine(item.diagnosis)}
        <p>${rich(item.feedback)}</p>
        ${item.hint ? `<div class="note hint">${icon("hint")}<div class="note-body"><b>Hint:</b> ${rich(item.hint)}${HINT_STEP[item.hintLevel] ? ` <span class="hint-step">${HINT_STEP[item.hintLevel]}</span>` : ""}</div></div>` : ""}
        ${item.solution ? `<div class="note solution">${icon("solution")}<div class="note-body"><b>Solution:</b>\n${rich(item.solution)}</div></div>` : ""}
        ${item.steps?.length ? stepsView(item, "See it step by step on a balance scale") : ""}
        ${item.encouragement ? `<p><em>${rich(item.encouragement)}</em></p>` : ""}`;
    } else if (item.type === "steps") {
      el.className = "msg stepscard";
      item.view ??= { i: 0, open: true };
      el.innerHTML = `<div class="qlabel">Worked example ${item.index + 1} of ${item.count} · ${escapeHtml(topicName(item.topic))}</div><div class="qtext">Solve: ${escapeHtml(item.equation)}</div>${stepsView(item, "Steps on a balance scale")}`;
    } else if (item.type === "hint") {
      el.className = "msg hintcard";
      el.innerHTML = `<div class="hint-head">${icon("hint")}<span>Hint ${item.level} of ${item.max}</span><span class="hint-step">${HINT_STEP[item.level] || ""}</span></div><div>${rich(item.text)}</div>`;
    } else {
      el.className = `msg ${item.type}`;
      el.innerHTML = rich(item.text) + (item.working ? `<div class="working-quote"><span>Your working</span>${escapeHtml(item.working)}</div>` : "");
    }
    const side = item.type === "student" ? "student" : (item.type === "system" || item.type === "error") ? null : "tutor";
    chat.appendChild(side ? withAvatar(el, side) : el);
  }
  if (state.busy && (state.pending === "question" || state.pending === "quiz")) {
    // Skeleton of the question card while the model writes the question(s); deliberately not a .msg.question.
    const s = document.createElement("div");
    s.className = "skeleton";
    s.setAttribute("role", "status");
    s.innerHTML = `<span class="sk sk-label"></span><span class="sk sk-line"></span><span class="sk sk-short"></span><span class="sk-note">${state.pending === "quiz" ? "Preparing your quiz questions…" : "Preparing a new question…"}${state.slow ? ` <span class="slow-note">${SLOW_NOTE}</span>` : ""}</span>`;
    chat.appendChild(s);
  } else if (state.busy) {
    const label = PENDING_LABEL[state.pending] || "Thinking";
    const t = document.createElement("div");
    t.className = "typing";
    t.setAttribute("role", "status");
    t.innerHTML = `<span class="avatar" aria-hidden="true">AT</span><span class="dots">${label}<span aria-hidden="true"><i></i><i></i><i></i></span></span>${state.slow ? `<span class="slow-note">${SLOW_NOTE}</span>` : ""}`;
    chat.appendChild(t);
  }
  chat.scrollTop = chat.scrollHeight;
}

function setBusy(b, pending = "reply") {
  state.busy = b;
  state.pending = b ? pending : null;
  clearTimeout(state.slowTimer);
  state.slow = false;
  // After 20 s, say why: the local model can need a minute or two, especially for a quiz.
  if (b) state.slowTimer = setTimeout(() => { state.slow = true; renderChat(); }, 20_000);
  if (b) hideError();
  $("#message").disabled = b;
  $("#working").disabled = b;
  $("#send").disabled = b;
  for (const btn of $("#actions").querySelectorAll("button")) btn.disabled = b;
  renderChat();
}

// ---------- inline messages ----------
function hideError() { $("#error-banner").classList.add("hidden"); }
function setNote(text) {
  const note = $("#composer-note");
  note.textContent = text || "";
  note.classList.toggle("hidden", !text);
  $("#message").setAttribute("aria-invalid", String(Boolean(text)));
}
function updateComposer() {
  const answering = state.mode === "practice" || state.mode === "quiz";
  $("#send-label").textContent = answering ? "Check answer" : "Send";
  $("#send-icon").setAttribute("href", answering ? "#i-check" : "#i-send");
}

function setActions(buttons) {
  const box = $("#actions");
  box.innerHTML = "";
  for (const { label, onClick, ic } of buttons) {
    const b = document.createElement("button");
    b.type = "button";
    if (ic) { b.innerHTML = icon(ic); b.append(label); } else b.textContent = label;
    b.addEventListener("click", (e) => { if (!state.busy) onClick(e); }); // no duplicate submissions
    box.appendChild(b);
  }
}

/** First example from the topic's forms string: a quoted sentence for word problems, else the first comma-separated form. */
function topicExample(forms) {
  const s = String(forms || "");
  const quoted = s.match(/^\s*"([^"]+)"/);
  return quoted ? quoted[1].trim() : s.split(",")[0].trim();
}

function topicName(id) { return state.topics.find((t) => t.id === id)?.name || id; }
function topicMeta(id) { return state.topics.find((t) => t.id === id) || {}; }
const ANSWER_HINT = { number: "Your answer, e.g. x = 6", pair: "Both values, e.g. x = 3, y = 2", "pair-any": "Any solution, e.g. x = 2, y = 3", roots: "Both roots, e.g. x = 2 or x = 3" };
function answerPlaceholder(topicId) { return ANSWER_HINT[topicMeta(topicId).answerType] || ANSWER_HINT.number; }

function renderProgress() {
  $("#learner-name").textContent = state.profile.name;
  $("#learner-initial").textContent = (state.profile.name.trim()[0] || "?").toUpperCase();
  $("#learner-level").textContent = state.profile.level;
  $("#topic-switch").value = state.profile.topic;
  renderBias();
  const rows = Object.entries(state.session.byTopic);
  const attempted = rows.reduce((a, [, s]) => a + s.attempted, 0);
  const correct = rows.reduce((a, [, s]) => a + s.correct, 0);
  $("#stat-attempted").textContent = attempted;
  $("#stat-correct").textContent = correct;
  $("#mini-attempted").textContent = attempted;
  $("#mini-correct").textContent = correct;
  const pct = attempted ? Math.round((correct / attempted) * 100) : 0;
  $("#acc-ring").style.strokeDashoffset = String(100 - pct);
  $("#acc-text").textContent = attempted ? pct + "%" : "–";
  $("#topic-stats").innerHTML = rows.map(([id, s]) => `<div class="trow"><span>${escapeHtml(topicName(id))}</span><span>${s.correct} / ${s.attempted}</span><div class="bar"><span style="width:${s.attempted ? Math.round((s.correct / s.attempted) * 100) : 0}%"></span></div></div>`).join("");
  const strong = rows.filter(([, s]) => s.attempted >= 2 && s.correct / s.attempted >= 0.75).map(([id]) => id);
  const weak = rows.filter(([, s]) => s.attempted > 0 && s.correct / s.attempted < 0.6).map(([id]) => id);
  $("#strong").innerHTML = strong.length ? strong.map((id) => `<li>${escapeHtml(topicName(id))}</li>`).join("") : '<li class="muted">none yet</li>';
  $("#weak").innerHTML = weak.length ? weak.map((id) => `<li>${escapeHtml(topicName(id))}</li>`).join("") : '<li class="muted">none yet</li>';
  if ($("#progress-dialog").open) renderDashboard();
}

// ---------- student dashboard (learner-facing, built only from data saved in this browser) ----------
const STATUS_LABEL = { mastered: ["strong", "Mastered"], developing: ["", "Developing"], struggling: ["weak", "Struggling"], insufficient: ["muted-tag", "Not enough data"] };
const ADAPTATION_LABEL = { prerequisite: "Review a prerequisite", ease: "Easier questions", stretch: "Harder questions", next: "Move on", hold: "Keep going", start: "Not enough data yet" };
const pctOf = (s) => (s.attempted ? Math.round((s.correct / s.attempted) * 100) : 0);
function formatDate(iso) {
  if (!iso) return "Before history was kept";
  const d = new Date(iso);
  return isNaN(d) ? "–" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function renderDashboard() {
  $("#dash-title").textContent = `Your progress, ${state.profile.name}`;
  const body = $("#dash-body");
  const saved = Object.entries(state.stats.byTopic).filter(([, s]) => s.attempted > 0);
  if (!saved.length) {
    body.innerHTML = `<div class="panel empty">${icon("chart")}<strong>No answers recorded yet</strong><span>Answer a practice question or take a quiz and your results appear here, topic by topic.</span></div>`;
    return;
  }
  body.innerHTML = `<div class="panel"><div class="sk sk-line"></div><div class="sk sk-short" style="margin-top:10px"></div><p class="muted">Working out your next step…</p></div>`;
  let rec = null;
  try { rec = await api("/api/recommend", { profile: state.profile, stats: { byTopic: state.stats.byTopic } }); } catch { rec = null; }
  if (!$("#progress-dialog").open) return;
  const today = Progress.totals(state.session.byTopic);
  const all = Progress.totals(state.stats.byTopic);
  const group = (title, tiles) => `<section class="tile-group"><h3>${title}</h3><div class="tiles">${tiles.map(([n, l]) => `<div class="tile"><span class="num">${n}</span><span class="lbl">${l}</span></div>`).join("")}</div></section>`;
  const table = saved
    .sort(([a], [b]) => state.topics.findIndex((t) => t.id === a) - state.topics.findIndex((t) => t.id === b))
    .map(([id, s]) => {
      const pct = pctOf(s);
      const st = rec?.perTopic?.[id]?.status;
      const [cls, label] = STATUS_LABEL[st] || ["", "–"];
      const extra = st === "insufficient" ? ` (${s.attempted} of 3)` : "";
      return `<tr data-topic="${id}"><td>${escapeHtml(topicName(id))}</td><td class="num">Class ${topicMeta(id).classLevel ?? "–"}</td><td class="num">${s.correct} / ${s.attempted}</td><td><div class="minibar" title="${pct}%"><span style="width:${pct}%"></span></div></td><td><span class="status-tag ${cls}">${label}${extra}</span></td></tr>`;
    }).join("");
  const sessions = state.history.slice(-5).reverse();
  const mistakes = state.stats.mistakes.slice(-5).reverse();
  body.innerHTML = `
    <div class="tile-groups">
      ${group("This session", [[today.attempted, "Questions attempted"], [today.correct, "Correct first try"]])}
      ${group("All saved answers", [[all.attempted, "Questions attempted"], [pctOf(all) + "%", "First-try accuracy"], [saved.length, saved.length === 1 ? "Topic practised" : "Topics practised"]])}
    </div>
    ${rec ? `<section class="panel next-step" id="next-step">
      <h3>Your next step</h3>
      <div class="next-head"><strong>${escapeHtml(rec.nextLesson)}</strong><span class="adapt-tag ${rec.adaptation}">${ADAPTATION_LABEL[rec.adaptation] || ""}</span></div>
      <p class="next-reason">${escapeHtml(rec.reason)}</p>
      <button id="dash-apply" class="btn btn-primary" type="button">${applyLabel(rec)}</button>
    </section>` : '<section class="panel"><p class="muted">The next step could not be worked out right now. Your saved results are below.</p></section>'}
    <section class="panel"><h3>By topic</h3><div class="table-wrap"><table>
      <thead><tr><th>Topic</th><th>Class</th><th>Correct first try</th><th>Accuracy</th><th>Status</th></tr></thead>
      <tbody>${table}</tbody></table></div>
      <p class="fineprint table-note">Status needs at least 3 answers. Mastered means 4 or more answers with at least 80% right first time; struggling means under 50%.</p></section>
    <section class="panel"><h3>Recent sessions</h3>${sessions.length
      ? `<ul class="sessions">${sessions.map((h) => `<li><span class="s-date">${escapeHtml(formatDate(h.date))}${h.id === state.session.id ? ' <span class="now-tag">now</span>' : ""}</span><span class="s-score">${h.correct} / ${h.attempted} right first time</span><span class="s-topics">${Object.keys(h.topics).map((id) => escapeHtml(topicName(id))).join(", ")}</span></li>`).join("")}</ul>`
      : '<p class="muted">No sessions saved yet.</p>'}</section>
    <section class="panel"><h3>Recent mistakes</h3>${mistakes.length
      ? `<ul class="mistakes">${mistakes.map((m) => `<li><div class="mq">${escapeHtml(m.question)}</div><div class="ma">You answered <b>${escapeHtml(m.studentAnswer)}</b>${m.correctAnswer && m.correctAnswer !== "?" ? ` · correct answer <b>${escapeHtml(m.correctAnswer)}</b>` : ""}</div></li>`).join("")}</ul>`
      : '<p class="muted">No mistakes recorded. Every answer so far was right.</p>'}</section>`;
  if (rec) $("#dash-apply").addEventListener("click", () => { $("#progress-dialog").close(); applyRecommendation(rec); });
}

function openDashboard() {
  const d = $("#progress-dialog");
  if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
  renderDashboard();
}

// ---------- recommendations → practice ----------
function applyLabel(rec) {
  const name = rec.nextLesson || topicName(rec.nextTopicId);
  if (rec.difficultyBias === "easier") return `Practise ${name} with easier questions`;
  if (rec.difficultyBias === "harder") return `Practise ${name} with harder questions`;
  return rec.nextTopicId === state.profile.topic ? `Practise ${name} now` : `Study ${name} now`;
}

/** Follow a recommendation: switch topic if needed and set the difficulty for that topic's questions. */
function applyRecommendation(rec) {
  state.bias = rec.difficultyBias && rec.difficultyBias !== "normal" ? { topic: rec.nextTopicId, value: rec.difficultyBias } : null;
  if (rec.nextTopicId !== state.profile.topic) changeTopic(rec.nextTopicId);
  else { renderBias(); switchMode("practice"); }
}

const biasFor = (topic) => (state.bias && state.bias.topic === topic ? state.bias.value : "normal");
function renderBias() {
  const chip = $("#bias-chip");
  const v = state.profile ? biasFor(state.profile.topic) : "normal";
  chip.classList.toggle("hidden", v === "normal");
  $("#bias-text").textContent = v === "easier" ? "Easier questions" : v === "harder" ? "Harder questions" : "";
}

function recordResult(topic, correctFirstTry) {
  const s = (state.session.byTopic[topic] ||= { attempted: 0, correct: 0 });
  s.attempted += 1;
  if (correctFirstTry) s.correct += 1;
  const rec = { stats: state.stats, history: state.history };
  Progress.record(rec, state.session, topic, correctFirstTry); // saved totals + this session's history row
  state.history = rec.history;
  save();
  renderProgress();
}

/** Error banner; `retry` adds a Try again button. Provider and network failures also raise the top banner. */
function showError(err, retry = null) {
  const text = err.status === 410 ? "That question expired. Ask for a new one."
    : err.status === 400 && err.details ? `Something in that request was not accepted (${err.details.join("; ")}).`
    : err.message;
  $("#error-text").textContent = text;
  state.retry = err.status === 410 ? null : retry;
  $("#error-retry").classList.toggle("hidden", !state.retry);
  $("#error-banner").classList.remove("hidden");
  if (err.kind === "network") setProviderBanner("Can't reach the tutor server. Check that it is running, then reload or press Check again.");
  else if (err.kind === "auth" || err.kind === "provider") setProviderBanner(err.message);
}

/** Top banner for an unavailable model or server; "Check again" re-runs the health check. */
function setProviderBanner(text) {
  $("#provider-text").textContent = text || "";
  $("#provider-banner").classList.toggle("hidden", !text);
}
async function checkHealth() {
  try {
    const h = await api("/api/health");
    $("#provider-badge").textContent = h.ready === false ? `${h.provider} · not configured (set ANTHROPIC_API_KEY)` : `${h.provider === "claude" ? "Claude" : "Local model"} · ${h.model}`;
    $("#provider-badge").classList.toggle("warn", h.ready === false || h.reachable === false);
    if (h.ready === false) setProviderBanner("The tutor's AI service is not set up on this server yet. Hints, worked examples and your saved progress still work; lessons, new questions and feedback need it.");
    else if (h.reachable === false) setProviderBanner("The local AI model is not running. Start Ollama, then press Check again. Hints, worked examples and your saved progress still work.");
    else setProviderBanner("");
  } catch {
    $("#provider-badge").textContent = "server offline";
    $("#provider-badge").classList.add("warn");
    setProviderBanner("Can't reach the tutor server. Check that it is running, then reload or press Check again.");
  }
}

// ---------- modes ----------
const MODE_DESC = {
  learn: "The tutor explains the topic step by step and asks you small check questions.",
  practice: "One question at a time and three attempts. Hints build step by step, and the solution comes after the last attempt.",
  quiz: "Five questions, one attempt each. The solution is shown after every answer.",
  doubt: "Ask anything about your topic or about equations in Classes 8 to 10.",
};

function switchMode(mode) {
  state.mode = mode;
  $("#mode-desc").textContent = MODE_DESC[mode] || "";
  for (const b of $("#tabs").querySelectorAll("button")) {
    b.classList.toggle("active", b.dataset.mode === mode);
    b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
  }
  hideError();
  setNote("");
  updateComposer();
  $("#working-box").classList.toggle("hidden", !(mode === "practice" || mode === "quiz"));
  const input = $("#message");
  if (mode === "learn" || mode === "doubt") {
    input.placeholder = mode === "learn" ? "Ask a question or reply to the tutor…" : "Type your doubt about equations…";
    if (mode === "learn") learnActions(); else setActions([]);
    if (mode === "learn" && state.chats.learn.length === 0) startLesson();
    if (mode === "doubt" && state.transcripts.doubt.length === 0) push("doubt", { type: "tutor", text: `Ask me anything about ${topicName(state.profile.topic)} or about equations in general.` });
  } else if (mode === "practice") {
    input.placeholder = answerPlaceholder(state.profile.topic);
    if (state.transcripts.practice.length === 0) push("practice", { type: "tutor", text: `Practice mode: I'll give you one question at a time on ${topicName(state.profile.topic)}. You get ${state.maxAttempts.practice} attempts with hints. Click "New question" to begin.` });
    practiceActions();
  } else if (mode === "quiz") {
    input.placeholder = answerPlaceholder(state.profile.topic);
    if (state.transcripts.quiz.length === 0) push("quiz", { type: "tutor", text: `Quiz mode: 5 questions on ${topicName(state.profile.topic)}, one attempt each, and I'll show the solution after every answer. Choose "Mixed revision" to mix 2 to 5 topics instead.` });
    if (!state.quiz.active) { if ($("#mix-picker").classList.contains("hidden")) quizStartActions(); }
    else if (state.quiz.awaitingNext) setActions([{ label: "Next question", onClick: nextQuizQuestion }]);
    else setActions([]);
  }
  renderChat();
}

// Worked examples (Phase 5): the topic's own example equations, solved by the app with every line checked.
function learnActions() {
  if (!topicMeta(state.profile.topic).workedExamples) return setActions([]);
  setActions([{ label: state.exampleIndex ? "Another worked example" : "Show a worked example", onClick: showWorkedExample, ic: "layers" }]);
}
async function showWorkedExample() {
  setBusy(true, "example");
  try {
    const r = await api("/api/steps", { profile: state.profile, index: state.exampleIndex || 0 });
    if (r.steps) {
      push("learn", { type: "steps", topic: state.profile.topic, equation: r.equation, steps: r.steps, index: r.index, count: r.count });
      state.exampleIndex = r.index + 1;
    }
  } catch (e) { showError(e, showWorkedExample); }
  finally { setBusy(false); learnActions(); }
}

async function startLesson() {
  const opener = "Hi! Please teach me this topic from the beginning.";
  state.chats.learn = [{ role: "user", content: opener }];
  push("learn", { type: "system", text: `Starting a lesson on ${topicName(state.profile.topic)} at ${state.profile.level} level` });
  setBusy(true, "lesson");
  try {
    const r = await api("/api/chat", { profile: state.profile, mode: "learn", messages: state.chats.learn });
    state.chats.learn.push({ role: "assistant", content: r.reply });
    push("learn", { type: "tutor", text: r.reply });
  } catch (e) { state.chats.learn = []; state.transcripts.learn.pop(); showError(e, startLesson); renderChat(); }
  finally { setBusy(false); }
}

async function sendChat(text, again = false) {
  const mode = state.mode;
  const history = state.chats[mode];
  history.push({ role: "user", content: text });
  if (!again) push(mode, { type: "student", text }); // a retry re-sends without repeating the bubble
  setBusy(true, "reply");
  try {
    let recent = history.slice(-20);
    while (recent.length && recent[0].role !== "user") recent = recent.slice(1); // API requires a user turn first
    const r = await api("/api/chat", { profile: state.profile, mode, messages: recent });
    history.push({ role: "assistant", content: r.reply });
    push(mode, { type: "tutor", text: r.reply });
  } catch (e) { history.pop(); showError(e, () => sendChat(text, true)); }
  finally { setBusy(false); }
}

// ----- practice -----
const MAX_HINTS = 2; // level 3 is the reveal after the last attempt
function practiceActions() {
  const p = state.practice;
  if (p.done) return setActions([{ label: "New question", onClick: newPracticeQuestion }]);
  setActions(p.hintLevel < MAX_HINTS ? [{ label: p.hintLevel === 0 ? "Get a hint" : "Another hint", onClick: requestHint, ic: "hint" }] : []);
}

/** Hint button: the app's own hint for the next ladder level. No model call and no attempt used. */
async function requestHint() {
  const p = state.practice;
  if (p.done || !p.question || p.hintLevel >= MAX_HINTS) return;
  setBusy(true, "hint");
  try {
    const r = await api("/api/hint", { profile: state.profile, questionId: p.question.id, level: p.hintLevel + 1 });
    p.hintLevel = r.hintLevel;
    p.hints.push(r.hint);
    push("practice", { type: "hint", text: r.hint, level: r.hintLevel, max: r.maxHintLevel });
  } catch (e) {
    showError(e, requestHint);
    if (e.status === 410) p.done = true;
  } finally { setBusy(false); practiceActions(); }
}

/** Optional working typed by the student; sent with the answer, then cleared. */
function takeWorking() {
  const box = $("#working");
  const text = box.value.trim().slice(0, 600);
  box.value = "";
  $("#working-box").open = false;
  return text || undefined;
}

async function newPracticeQuestion() {
  setActions([]);
  setBusy(true, "question");
  try {
    const r = await api("/api/questions", { profile: state.profile, count: 1, avoid: state.recentPrompts.slice(-10), difficultyBias: biasFor(state.profile.topic) });
    const q = r.questions[0];
    state.practice = { question: q, attempt: 1, done: false, pendingMistake: null, hints: [], hintLevel: 0 };
    state.recentPrompts.push(q.prompt); save();
    push("practice", { type: "question", label: `Class ${q.classLevel || topicMeta(q.topic).classLevel || 8} · ${topicName(q.topic)}`, text: q.prompt });
  } catch (e) { showError(e, newPracticeQuestion); }
  finally { setBusy(false); practiceActions(); }
}

async function answerPractice(text, again = null) {
  const p = state.practice;
  const working = again ? again.working : takeWorking();
  if (!again) push("practice", { type: "student", text, working }); // a retry re-checks the same answer
  setBusy(true, "check");
  try {
    const r = await api("/api/evaluate", { profile: state.profile, mode: "practice", questionId: p.question.id, studentAnswer: text, attempt: p.attempt, working, previousHints: p.hints.slice(-3) });
    push("practice", { type: "feedback", ...r });
    if (r.hint && !r.revealed) { p.hints.push(r.hint); if (r.hintLevel && r.hintLevel <= MAX_HINTS) p.hintLevel = Math.max(p.hintLevel, r.hintLevel); }
    if ((r.verdict === "incorrect" || r.verdict === "partial") && !p.pendingMistake) p.pendingMistake = { question: p.question.prompt, studentAnswer: text, correctAnswer: "?" };
    if (r.correct || r.revealed) {
      p.done = true;
      const firstTry = r.correct && p.attempt === 1;
      if (p.pendingMistake) { p.pendingMistake.correctAnswer = r.correctAnswer ?? "?"; addMistake(p.pendingMistake); }
      recordResult(p.question.topic, firstTry);
    } else if (r.verdict === "incorrect" || r.verdict === "partial") {
      p.attempt += 1;
    }
  } catch (e) {
    showError(e, () => answerPractice(text, { working }));
    if (e.status === 410) p.done = true;
  }
  finally {
    setBusy(false);
    if (p.done && state.transcripts.practice.at(-1)?.type === "feedback") setActions([{ label: "Next question", onClick: newPracticeQuestion }]);
    else practiceActions();
  }
}

// ----- quiz -----
function quizStartActions(again = false) {
  setActions([
    { label: again ? "Start another quiz" : "Start quiz (5 questions)", onClick: () => startQuiz() },
    { label: "Mixed revision", onClick: openMixPicker, ic: "layers" },
  ]);
}

/** topics: 2–5 ids for a mixed revision quiz; omitted for a quiz on the current topic. */
async function startQuiz(topics) {
  closeMixPicker();
  setActions([]);
  setBusy(true, "quiz");
  try {
    const body = { profile: state.profile, count: 5, avoid: state.recentPrompts.slice(-10) };
    if (topics) body.topics = topics; else body.difficultyBias = biasFor(state.profile.topic);
    const r = await api("/api/questions", body);
    state.quiz = { active: true, questions: r.questions, index: 0, score: 0, awaitingNext: false, pendingMistake: null, mixed: Boolean(topics) };
    for (const q of r.questions) state.recentPrompts.push(q.prompt);
    save();
    if (topics) push("quiz", { type: "system", text: `Mixed revision: ${topics.map(topicName).join(", ")}` });
    if (r.questions.length < 5) push("quiz", { type: "system", text: `I could only prepare ${r.questions.length} questions this time.` });
    showQuizQuestion();
  } catch (e) { showError(e, () => startQuiz(topics)); quizStartActions(); }
  finally { setBusy(false); }
}

function showQuizQuestion() {
  const q = state.quiz.questions[state.quiz.index];
  const label = `Question ${state.quiz.index + 1} of ${state.quiz.questions.length}` + (state.quiz.mixed ? ` · ${topicName(q.topic)}` : "");
  push("quiz", { type: "question", label, text: q.prompt });
  $("#message").placeholder = answerPlaceholder(q.topic);
  setActions([]);
}

// Mixed revision picker: 2–5 topics, pre-ticked with the current topic and saved topics that are not yet secure.
function openMixPicker() {
  const box = $("#mix-picker");
  const weak = Object.entries(state.stats.byTopic).filter(([, s]) => s.attempted && s.correct / s.attempted < 0.8).map(([id]) => id);
  const pre = [state.profile.topic, ...weak.filter((id) => id !== state.profile.topic)].slice(0, 5);
  const classes = [...new Set(state.topics.map((t) => t.classLevel))];
  $("#mix-list").innerHTML = classes.map((cl) => `<fieldset><legend>Class ${cl}</legend>${state.topics.filter((t) => t.classLevel === cl).map((t) =>
    `<label class="mix-item"><input type="checkbox" value="${t.id}"${pre.includes(t.id) ? " checked" : ""}><span>${escapeHtml(t.name)}</span></label>`).join("")}</fieldset>`).join("");
  $("#mix-note").textContent = "";
  box.classList.remove("hidden");
  setActions([]);
  updateMixCount();
  box.querySelector("input")?.focus();
}
function closeMixPicker() { $("#mix-picker").classList.add("hidden"); }
function mixChosen() { return [...$("#mix-list").querySelectorAll("input:checked")].map((i) => i.value); }
function updateMixCount() {
  const n = mixChosen().length;
  $("#mix-count").textContent = `${n} selected`;
  $("#mix-note").textContent = n > 5 ? "Pick at most 5 topics." : "";
}

async function answerQuiz(text, again = null) {
  const qz = state.quiz;
  const q = qz.questions[qz.index];
  const working = again ? again.working : takeWorking();
  if (!again) push("quiz", { type: "student", text, working });
  setBusy(true, "check");
  try {
    const r = await api("/api/evaluate", { profile: state.profile, mode: "quiz", questionId: q.id, studentAnswer: text, attempt: 1, working });
    push("quiz", { type: "feedback", ...r, attemptsLeft: null });
    if (r.correct) qz.score += 1;
    else addMistake({ question: q.prompt, studentAnswer: text, correctAnswer: r.correctAnswer ?? "?" });
    recordResult(q.topic, r.correct);
    qz.awaitingNext = true;
    if (qz.index + 1 < qz.questions.length) setActions([{ label: "Next question", onClick: nextQuizQuestion }]);
    else finishQuiz();
  } catch (e) {
    showError(e, () => answerQuiz(text, { working }));
    if (e.status === 410) {
      // Expired question (server restarted or 3 hours passed): skip it without scoring, and carry on.
      push("quiz", { type: "system", text: "That question expired, so it was skipped and not counted." });
      qz.awaitingNext = true;
      if (qz.index + 1 < qz.questions.length) setActions([{ label: "Next question", onClick: nextQuizQuestion }]);
      else finishQuiz();
    }
  }
  finally { setBusy(false); }
}

function nextQuizQuestion() {
  state.quiz.index += 1;
  state.quiz.awaitingNext = false;
  showQuizQuestion();
}

function finishQuiz() {
  const { score, questions } = state.quiz;
  state.quiz.active = false;
  push("quiz", { type: "tutor", text: `Quiz finished! You scored **${score} out of ${questions.length}**.` + (score === questions.length ? " Excellent work!" : " Check the Progress panel to see where to practise more, or end the session for a recommendation.") });
  quizStartActions(true);
}

// ----- summary -----
async function endSession() {
  const btn = $("#end-session");
  btn.disabled = true; btn.textContent = "Preparing your summary…";
  hideError();
  try {
    // Recommendation from all saved answers; "Today's performance" and the tips from this session.
    const r = await api("/api/summary", { profile: state.profile, stats: { byTopic: state.stats.byTopic, mistakes: state.session.mistakes.slice(-Progress.MAX_MISTAKES) }, session: { byTopic: state.session.byTopic } });
    const box = $("#summary");
    box.classList.remove("hidden");
    box.innerHTML = `<h4>Today's performance</h4>
      <div>Questions attempted: <strong>${r.attempted}</strong> · Correct: <strong>${r.correct}</strong></div>
      <div>Needs improvement: ${r.needsPractice.length ? r.needsPractice.map(escapeHtml).join(", ") : "nothing specific yet"}</div>
      <div>Recommended next lesson: <strong>${escapeHtml(r.nextLesson)}</strong>${r.adaptation ? ` <span class="adapt-tag ${r.adaptation}">${ADAPTATION_LABEL[r.adaptation] || ""}</span>` : ""}</div>
      ${r.reason ? `<div class="why"><b>Why:</b> ${escapeHtml(r.reason)}</div>` : ""}
      <p>${rich(r.message)}</p>
      ${r.tips.length ? `<ul>${r.tips.map((t) => `<li>${rich(t)}</li>`).join("")}</ul>` : ""}
      <button id="go-next" class="btn btn-secondary">${escapeHtml(applyLabel(r))}</button>`;
    $("#go-next").addEventListener("click", () => applyRecommendation(r));
  } catch (e) { showError(e, endSession); }
  finally { btn.disabled = false; btn.textContent = "End session & get recommendation"; }
}

function changeTopic(topicId) {
  if (topicId === state.profile.topic) return;
  if (state.bias && state.bias.topic !== topicId) state.bias = null;
  state.exampleIndex = 0;
  state.profile.topic = topicId;
  state.chats = { learn: [], doubt: [] };
  state.transcripts = { learn: [], practice: [], quiz: [], doubt: [] };
  state.practice = { question: null, attempt: 1, done: true, pendingMistake: null, hints: [], hintLevel: 0 };
  state.quiz = { active: false, questions: [], index: 0, score: 0, awaitingNext: false, pendingMistake: null };
  save();
  renderProgress();
  switchMode("learn");
}

// ---------- wiring ----------
async function init() {
  await checkHealth();

  const t = await api("/api/topics");
  state.topics = t.topics;
  state.maxAttempts = t.maxAttempts;
  const classes = [...new Set(t.topics.map((x) => x.classLevel))];
  $("#topic-switch").innerHTML = classes.map((cl) => `<optgroup label="Class ${cl}">${t.topics.filter((x) => x.classLevel === cl).map((x) => `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("")}</optgroup>`).join("");
  const renderTopicGrid = (cl) => {
    const list = t.topics.filter((x) => x.classLevel === cl);
    let lastChapter = null;
    $("#topic-grid").innerHTML = list.map((x, i) => {
      const head = x.chapter !== lastChapter ? `<div class="topic-chapter">${escapeHtml(x.chapter)}</div>` : "";
      lastChapter = x.chapter;
      const example = topicExample(x.forms);
      return `${head}<label class="topic-card" title="${escapeHtml(x.name)}: ${escapeHtml(example)}"><input type="radio" name="topic" value="${x.id}"${i === 0 ? " checked" : ""}><span class="topic-name">${escapeHtml(x.name)}</span>${i === 0 ? '<span class="topic-start">Start here</span>' : ""}${example.length <= 20 ? `<span class="topic-form">${escapeHtml(example)}</span>` : ""}</label>`;
    }).join("");
    $("#topic-note").textContent = `Not sure? Keep "${list[0]?.name}". It is where Class ${cl} begins.`;
    for (const b of $("#class-tabs").querySelectorAll("button")) b.setAttribute("aria-selected", String(Number(b.dataset.class) === cl));
  };
  $("#class-tabs").innerHTML = classes.map((cl) => `<button type="button" role="tab" data-class="${cl}" aria-selected="false">Class ${cl}</button>`).join("");
  $("#class-tabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-class]"); if (b) renderTopicGrid(Number(b.dataset.class)); });
  renderTopicGrid(classes[0]);
  $("#rail-toggle").addEventListener("click", () => { const open = document.querySelector(".rail").classList.toggle("open"); $("#rail-toggle").setAttribute("aria-expanded", String(open)); });

  $("#setup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = String(f.get("name") || "").trim();
    if (!name) { $("#name").setAttribute("aria-invalid", "true"); $("#name-error").classList.remove("hidden"); $("#name").focus(); return; }
    state.profile = { name, level: f.get("level"), topic: f.get("topic") };
    save();
    startApp();
  });
  $("#tabs").addEventListener("click", (e) => { const m = e.target.closest("button[data-mode]")?.dataset.mode; if (m && !state.busy) switchMode(m); });
  $("#composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#message");
    const text = input.value.trim();
    if (state.busy) return;
    if (!text) { setNote(state.mode === "practice" || state.mode === "quiz" ? "Type your answer first, for example x = 6." : "Type a message first."); input.focus(); return; }
    setNote("");
    input.value = "";
    if (state.mode === "learn" || state.mode === "doubt") return sendChat(text);
    if (state.mode === "practice") {
      if (state.practice.done) return push("practice", { type: "system", text: 'Click "New question" first.' });
      return answerPractice(text);
    }
    if (state.mode === "quiz") {
      if (!state.quiz.active || state.quiz.awaitingNext) return push("quiz", { type: "system", text: state.quiz.active ? 'Click "Next question" to continue.' : 'Click "Start quiz" first.' });
      return answerQuiz(text);
    }
  });
  $("#topic-switch").addEventListener("change", (e) => changeTopic(e.target.value));
  $("#name").addEventListener("input", () => { $("#name").removeAttribute("aria-invalid"); $("#name-error").classList.add("hidden"); });
  $("#message").addEventListener("input", () => { if (!$("#composer-note").classList.contains("hidden")) setNote(""); });
  $("#error-close").addEventListener("click", hideError);
  $("#error-retry").addEventListener("click", () => { const fn = state.retry; hideError(); if (fn && !state.busy) fn(); });
  $("#provider-check").addEventListener("click", checkHealth);
  // Step viewers: choose a line, or move with Back / Next; only that viewer is redrawn, so the chat does not jump.
  $("#chat").addEventListener("click", (e) => {
    const b = e.target.closest("[data-step-i], [data-step-move]");
    const det = b?.closest("details.steps");
    const item = det && findItem(Number(det.dataset.uid));
    if (!item) return;
    const n = item.steps.length;
    item.view.i = b.dataset.stepI !== undefined ? Number(b.dataset.stepI) : Math.max(0, Math.min(n - 1, item.view.i + Number(b.dataset.stepMove)));
    det.querySelector(".steps-body").innerHTML = stepsBody(item);
    const again = b.dataset.stepMove !== undefined ? det.querySelector(`[data-step-move="${b.dataset.stepMove}"]:not([disabled])`) : det.querySelector(`[data-step-i="${item.view.i}"]`);
    (again || det.querySelector(".step-nav .btn-ghost:not([disabled]), .step-nav .btn:not([disabled])"))?.focus();
  });
  $("#chat").addEventListener("toggle", (e) => {
    if (!e.target.matches?.("details.steps")) return;
    const item = findItem(Number(e.target.dataset.uid));
    if (item) item.view.open = e.target.open;
  }, true);
  $("#open-progress").addEventListener("click", openDashboard);
  $("#dash-close").addEventListener("click", () => $("#progress-dialog").close());
  $("#progress-dialog").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }); // click on the backdrop
  $("#end-session").addEventListener("click", endSession);
  $("#reset").addEventListener("click", () => { Progress.clear(localStorage); location.reload(); });
  $("#bias-chip").addEventListener("click", () => { state.bias = null; renderBias(); });
  $("#mix-list").addEventListener("change", updateMixCount);
  $("#mix-cancel").addEventListener("click", () => { closeMixPicker(); if (!state.quiz.active) quizStartActions(); });
  $("#mix-start").addEventListener("click", () => {
    const chosen = mixChosen();
    if (chosen.length < 2 || chosen.length > 5) { $("#mix-note").textContent = "Pick 2 to 5 topics."; return; }
    startQuiz(chosen);
  });

  // Saved progress (v2, or v1 migrated once) is loaded for every entry path, so a shareable link never wipes it.
  const saved = loadSaved();
  state.stats = saved.stats;
  state.history = saved.history;
  state.recentPrompts = saved.recentPrompts;

  // Shareable links: ?name=Asha&level=beginner&topic=two-step[&mode=practice] start the tutor directly.
  const params = new URLSearchParams(location.search);
  const qName = (params.get("name") || "").trim().slice(0, 40);
  const qLevel = params.get("level"), qTopic = params.get("topic"), qMode = params.get("mode");
  if (qName && t.levels.includes(qLevel) && t.topics.some((x) => x.id === qTopic)) {
    state.profile = { name: qName, level: qLevel, topic: qTopic };
    save();
    startApp(["learn", "practice", "quiz", "doubt"].includes(qMode) ? qMode : "learn");
    return;
  }

  if (saved.profile && state.topics.some((x) => x.id === saved.profile.topic)) {
    state.profile = saved.profile;
    $("#name").value = saved.profile.name;
    const savedClass = state.topics.find((x) => x.id === saved.profile.topic)?.classLevel;
    if (savedClass) $("#class-tabs").querySelector(`button[data-class="${savedClass}"]`)?.click();
    const tp = document.querySelector(`input[name=topic][value="${saved.profile.topic}"]`);
    if (tp) tp.checked = true;
    const lvl = document.querySelector(`input[name=level][value="${saved.profile.level}"]`);
    if (lvl) lvl.checked = true;
    startApp();
  }
}

function startApp(mode = "learn") {
  $("#setup").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#open-progress").classList.remove("hidden");
  renderProgress();
  switchMode(mode);
}

init().catch((e) => { document.querySelector(".topbar").insertAdjacentHTML("afterend", `<div class="banner" role="alert" style="max-width:1100px;margin:16px auto">${icon("alert")}<span>Could not load the app: ${escapeHtml(e.message)}. Check that the server is running, then reload.</span></div>`); });
