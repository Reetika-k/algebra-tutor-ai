/* AlgebraTutor AI – frontend. Plain JS, no framework.
   State lives in the browser for the session; profile + stats are mirrored to localStorage. */

const STORAGE_KEY = "algebratutor.v1";
const $ = (sel) => document.querySelector(sel);

const state = {
  profile: null,
  mode: "learn",
  topics: [],
  maxAttempts: { practice: 3, quiz: 1 },
  chats: { learn: [], doubt: [] },                    // API message history per chat mode
  transcripts: { learn: [], practice: [], quiz: [], doubt: [] }, // rendered items per tab
  practice: { question: null, attempt: 1, done: true, pendingMistake: null },
  quiz: { active: false, questions: [], index: 0, score: 0, awaitingNext: false, pendingMistake: null },
  stats: { byTopic: {}, mistakes: [] },
  recentPrompts: [],
  busy: false,
};

// ---------- persistence ----------
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile: state.profile, stats: state.stats, recentPrompts: state.recentPrompts })); } catch {}
}
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; }
}

// ---------- api ----------
async function api(path, body) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await res.json().catch(() => ({ error: `Server returned ${res.status}` }));
  if (!res.ok) { const e = new Error(data.error || `Request failed (${res.status})`); e.status = res.status; e.details = data.details; throw e; }
  return data;
}

// ---------- rendering ----------
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function rich(text) { return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }

function push(mode, item) { state.transcripts[mode].push(item); if (mode === state.mode) renderChat(); }

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
        <p>${rich(item.feedback)}</p>
        ${item.hint ? `<p class="hint">💡 Hint: ${rich(item.hint)}</p>` : ""}
        ${item.solution ? `<p class="solution">📝 Solution:\n${rich(item.solution)}</p>` : ""}
        ${item.encouragement ? `<p><em>${rich(item.encouragement)}</em></p>` : ""}`;
    } else {
      el.className = `msg ${item.type}`;
      el.innerHTML = rich(item.text);
    }
    const side = item.type === "student" ? "student" : (item.type === "system" || item.type === "error") ? null : "tutor";
    chat.appendChild(side ? withAvatar(el, side) : el);
  }
  if (state.busy) { const t = document.createElement("div"); t.className = "typing"; t.setAttribute("aria-label", "Tutor is thinking"); t.innerHTML = '<span class="avatar" aria-hidden="true">AT</span><span class="dots"><i></i><i></i><i></i></span>'; chat.appendChild(t); }
  chat.scrollTop = chat.scrollHeight;
}

function setBusy(b) {
  state.busy = b;
  $("#message").disabled = b;
  $("#send").disabled = b;
  for (const btn of $("#actions").querySelectorAll("button")) btn.disabled = b;
  renderChat();
}

function setActions(buttons) {
  const box = $("#actions");
  box.innerHTML = "";
  for (const { label, onClick } of buttons) {
    const b = document.createElement("button");
    b.textContent = label;
    b.addEventListener("click", onClick);
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
const ANSWER_HINT = { number: "Type your answer, e.g. x = 6", pair: "Type both values, e.g. x = 3, y = 2", "pair-any": "Type any solution, e.g. x = 2, y = 3", roots: "Type both roots, e.g. x = 2 or x = 3" };
function answerPlaceholder(topicId) { return ANSWER_HINT[topicMeta(topicId).answerType] || ANSWER_HINT.number; }

function renderProgress() {
  $("#learner-name").textContent = state.profile.name;
  $("#learner-level").textContent = state.profile.level;
  $("#topic-switch").value = state.profile.topic;
  const rows = Object.entries(state.stats.byTopic);
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
}

function recordResult(topic, correctFirstTry) {
  const s = (state.stats.byTopic[topic] ||= { attempted: 0, correct: 0 });
  s.attempted += 1;
  if (correctFirstTry) s.correct += 1;
  save();
  renderProgress();
}

function showError(err) {
  const text = err.status === 410 ? "That question expired. Ask for a new one." : err.message + (err.details ? ` (${err.details.join("; ")})` : "");
  push(state.mode, { type: "error", text });
}

// ---------- modes ----------
const MODE_DESC = {
  learn: "The tutor explains the topic step by step and asks you small check questions.",
  practice: "One question at a time, three attempts, a hint after every miss, the solution after the last.",
  quiz: "Five questions, one attempt each. The solution is shown after every answer.",
  doubt: "Ask anything about linear equations in one variable.",
};

function switchMode(mode) {
  state.mode = mode;
  $("#mode-desc").textContent = MODE_DESC[mode] || "";
  for (const b of $("#tabs").querySelectorAll("button")) b.classList.toggle("active", b.dataset.mode === mode);
  const input = $("#message");
  if (mode === "learn" || mode === "doubt") {
    input.placeholder = mode === "learn" ? "Ask a question or reply to the tutor…" : "Type your doubt about linear equations…";
    setActions([]);
    if (mode === "learn" && state.chats.learn.length === 0) startLesson();
    if (mode === "doubt" && state.transcripts.doubt.length === 0) push("doubt", { type: "tutor", text: `Ask me anything about ${topicName(state.profile.topic)} or linear equations in general.` });
  } else if (mode === "practice") {
    input.placeholder = answerPlaceholder(state.profile.topic);
    if (state.transcripts.practice.length === 0) push("practice", { type: "tutor", text: `Practice mode: I'll give you one question at a time on ${topicName(state.profile.topic)}. You get ${state.maxAttempts.practice} attempts with hints. Click "New question" to begin.` });
    setActions(state.practice.done ? [{ label: "New question", onClick: newPracticeQuestion }] : []);
  } else if (mode === "quiz") {
    input.placeholder = answerPlaceholder(state.profile.topic);
    if (state.transcripts.quiz.length === 0) push("quiz", { type: "tutor", text: `Quiz mode: 5 questions on ${topicName(state.profile.topic)}, one attempt each, and I'll show the solution after every answer.` });
    if (!state.quiz.active) setActions([{ label: "Start quiz (5 questions)", onClick: startQuiz }]);
    else if (state.quiz.awaitingNext) setActions([{ label: "Next question", onClick: nextQuizQuestion }]);
    else setActions([]);
  }
  renderChat();
}

async function startLesson() {
  const opener = "Hi! Please teach me this topic from the beginning.";
  state.chats.learn = [{ role: "user", content: opener }];
  push("learn", { type: "system", text: `Starting a lesson on ${topicName(state.profile.topic)} at ${state.profile.level} level` });
  setBusy(true);
  try {
    const r = await api("/api/chat", { profile: state.profile, mode: "learn", messages: state.chats.learn });
    state.chats.learn.push({ role: "assistant", content: r.reply });
    push("learn", { type: "tutor", text: r.reply });
  } catch (e) { state.chats.learn = []; showError(e); }
  finally { setBusy(false); }
}

async function sendChat(text) {
  const mode = state.mode;
  const history = state.chats[mode];
  history.push({ role: "user", content: text });
  push(mode, { type: "student", text });
  setBusy(true);
  try {
    let recent = history.slice(-20);
    while (recent.length && recent[0].role !== "user") recent = recent.slice(1); // API requires a user turn first
    const r = await api("/api/chat", { profile: state.profile, mode, messages: recent });
    history.push({ role: "assistant", content: r.reply });
    push(mode, { type: "tutor", text: r.reply });
  } catch (e) { history.pop(); showError(e); }
  finally { setBusy(false); }
}

// ----- practice -----
async function newPracticeQuestion() {
  setActions([]);
  setBusy(true);
  try {
    const r = await api("/api/questions", { profile: state.profile, count: 1, avoid: state.recentPrompts.slice(-10) });
    const q = r.questions[0];
    state.practice = { question: q, attempt: 1, done: false, pendingMistake: null };
    state.recentPrompts.push(q.prompt); save();
    push("practice", { type: "question", label: `Class ${q.classLevel || topicMeta(q.topic).classLevel || 8} · ${topicName(q.topic)}`, text: q.prompt });
  } catch (e) { showError(e); setActions([{ label: "New question", onClick: newPracticeQuestion }]); }
  finally { setBusy(false); }
}

async function answerPractice(text) {
  const p = state.practice;
  push("practice", { type: "student", text });
  setBusy(true);
  try {
    const r = await api("/api/evaluate", { profile: state.profile, mode: "practice", questionId: p.question.id, studentAnswer: text, attempt: p.attempt });
    push("practice", { type: "feedback", ...r });
    if ((r.verdict === "incorrect" || r.verdict === "partial") && !p.pendingMistake) p.pendingMistake = { question: p.question.prompt, studentAnswer: text, correctAnswer: "?" };
    if (r.correct || r.revealed) {
      p.done = true;
      const firstTry = r.correct && p.attempt === 1;
      if (p.pendingMistake) { p.pendingMistake.correctAnswer = r.correctAnswer ?? "?"; state.stats.mistakes.push(p.pendingMistake); }
      recordResult(p.question.topic, firstTry);
      setActions([{ label: "Next question", onClick: newPracticeQuestion }]);
    } else if (r.verdict === "incorrect" || r.verdict === "partial") {
      p.attempt += 1;
    }
  } catch (e) {
    showError(e);
    if (e.status === 410) { p.done = true; setActions([{ label: "New question", onClick: newPracticeQuestion }]); }
  }
  finally { setBusy(false); }
}

// ----- quiz -----
async function startQuiz() {
  setActions([]);
  setBusy(true);
  try {
    const r = await api("/api/questions", { profile: state.profile, count: 5, avoid: state.recentPrompts.slice(-10) });
    state.quiz = { active: true, questions: r.questions, index: 0, score: 0, awaitingNext: false, pendingMistake: null };
    for (const q of r.questions) state.recentPrompts.push(q.prompt);
    save();
    if (r.questions.length < 5) push("quiz", { type: "system", text: `I could only prepare ${r.questions.length} questions this time.` });
    showQuizQuestion();
  } catch (e) { showError(e); setActions([{ label: "Start quiz (5 questions)", onClick: startQuiz }]); }
  finally { setBusy(false); }
}

function showQuizQuestion() {
  const q = state.quiz.questions[state.quiz.index];
  push("quiz", { type: "question", label: `Question ${state.quiz.index + 1} of ${state.quiz.questions.length}`, text: q.prompt });
  setActions([]);
}

async function answerQuiz(text) {
  const qz = state.quiz;
  const q = qz.questions[qz.index];
  push("quiz", { type: "student", text });
  setBusy(true);
  try {
    const r = await api("/api/evaluate", { profile: state.profile, mode: "quiz", questionId: q.id, studentAnswer: text, attempt: 1 });
    push("quiz", { type: "feedback", ...r, attemptsLeft: null });
    if (r.correct) qz.score += 1;
    else state.stats.mistakes.push({ question: q.prompt, studentAnswer: text, correctAnswer: r.correctAnswer ?? "?" });
    recordResult(q.topic, r.correct);
    qz.awaitingNext = true;
    if (qz.index + 1 < qz.questions.length) setActions([{ label: "Next question", onClick: nextQuizQuestion }]);
    else finishQuiz();
  } catch (e) { showError(e); }
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
  setActions([{ label: "Start another quiz", onClick: startQuiz }]);
}

// ----- summary -----
async function endSession() {
  const btn = $("#end-session");
  btn.disabled = true; btn.textContent = "Preparing your summary…";
  try {
    const r = await api("/api/summary", { profile: state.profile, stats: state.stats });
    const box = $("#summary");
    box.classList.remove("hidden");
    box.innerHTML = `<h4>Today's performance</h4>
      <div>Questions attempted: <strong>${r.attempted}</strong> · Correct: <strong>${r.correct}</strong></div>
      <div>Needs improvement: ${r.needsPractice.length ? r.needsPractice.map(escapeHtml).join(", ") : "nothing specific yet"}</div>
      <div>Recommended next lesson: <strong>${escapeHtml(r.nextLesson)}</strong></div>
      <p>${rich(r.message)}</p>
      ${r.tips.length ? `<ul>${r.tips.map((t) => `<li>${rich(t)}</li>`).join("")}</ul>` : ""}
      <button id="go-next" class="btn btn-secondary">Study ${escapeHtml(r.nextLesson)} now</button>`;
    $("#go-next").addEventListener("click", () => changeTopic(r.nextTopicId));
  } catch (e) { showError(e); }
  finally { btn.disabled = false; btn.textContent = "End session & get recommendation"; }
}

function changeTopic(topicId) {
  if (topicId === state.profile.topic) return;
  state.profile.topic = topicId;
  state.chats = { learn: [], doubt: [] };
  state.transcripts = { learn: [], practice: [], quiz: [], doubt: [] };
  state.practice = { question: null, attempt: 1, done: true, pendingMistake: null };
  state.quiz = { active: false, questions: [], index: 0, score: 0, awaitingNext: false, pendingMistake: null };
  save();
  renderProgress();
  switchMode("learn");
}

// ---------- wiring ----------
async function init() {
  try {
    const h = await api("/api/health");
    $("#provider-badge").textContent = h.ready === false ? `${h.provider} · not configured (set ANTHROPIC_API_KEY)` : `${h.provider === "claude" ? "Claude" : "Local model"} · ${h.model}`;
    $("#provider-badge").classList.toggle("warn", h.ready === false);
  } catch { $("#provider-badge").textContent = "server offline"; $("#provider-badge").classList.add("warn"); }

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
      return `${head}<label class="topic-card"><input type="radio" name="topic" value="${x.id}"${i === 0 ? " checked" : ""}><span class="topic-name">${escapeHtml(x.name)}</span><span class="topic-form">${escapeHtml(topicExample(x.forms))}</span></label>`;
    }).join("");
    for (const b of $("#class-tabs").querySelectorAll("button")) b.setAttribute("aria-selected", String(Number(b.dataset.class) === cl));
  };
  $("#class-tabs").innerHTML = classes.map((cl) => `<button type="button" role="tab" data-class="${cl}" aria-selected="false">Class ${cl}</button>`).join("");
  $("#class-tabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-class]"); if (b) renderTopicGrid(Number(b.dataset.class)); });
  renderTopicGrid(classes[0]);
  $("#rail-toggle").addEventListener("click", () => { const open = document.querySelector(".rail").classList.toggle("open"); $("#rail-toggle").setAttribute("aria-expanded", String(open)); });

  $("#setup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    state.profile = { name: String(f.get("name")).trim(), level: f.get("level"), topic: f.get("topic") };
    save();
    startApp();
  });
  $("#tabs").addEventListener("click", (e) => { const m = e.target.closest("button[data-mode]")?.dataset.mode; if (m && !state.busy) switchMode(m); });
  $("#composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#message");
    const text = input.value.trim();
    if (!text || state.busy) return;
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
  $("#end-session").addEventListener("click", endSession);
  $("#reset").addEventListener("click", () => { localStorage.removeItem(STORAGE_KEY); location.reload(); });

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

  const saved = load();
  if (saved?.profile) {
    state.profile = saved.profile;
    state.stats = saved.stats || state.stats;
    state.recentPrompts = saved.recentPrompts || [];
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
  renderProgress();
  switchMode(mode);
}

init().catch((e) => { document.body.insertAdjacentHTML("afterbegin", `<div class="msg error" style="margin:16px">Could not load the app: ${escapeHtml(e.message)}</div>`); });
