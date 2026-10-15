// Post-deployment smoke test against a live URL:  BASE_URL=https://your-app.onrender.com node tests/smoke-remote.mjs
const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const profile = { name: "Asha", level: "beginner", topic: "one-step" };
const post = async (p, b) => { const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
let failed = 0;
const check = (name, ok, detail) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`); if (!ok) failed++; };

const h = await (await fetch(base + "/api/health")).json().catch(() => ({}));
check("health", h.ok === true, `provider=${h.provider} model=${h.model}`);
const t = await (await fetch(base + "/api/topics")).json().catch(() => ({}));
check("topics", t.topics?.length === 7);
const page = await (await fetch(base + "/")).text().catch(() => "");
check("frontend served", page.includes("AlgebraTutor AI"));
const bad = await post("/api/chat", { profile: { ...profile, level: "expert" }, mode: "learn", messages: [{ role: "user", content: "hi" }] });
check("validation rejects bad input", bad.status === 400);
const chat = await post("/api/chat", { profile, mode: "learn", messages: [{ role: "user", content: "What is a linear equation?" }] });
check("chat responds", chat.status === 200 && chat.reply?.length > 20, chat.error || `${chat.reply?.slice(0, 80)}…`);
const q = await post("/api/questions", { profile, count: 1 });
check("question generated", q.status === 200 && q.questions?.length === 1, q.error || q.questions?.[0]?.prompt);
if (q.questions?.[0]) {
  const e = await post("/api/evaluate", { profile, mode: "practice", questionId: q.questions[0].id, studentAnswer: "x = 1000000", attempt: 1 });
  check("evaluation works and withholds the answer", e.status === 200 && e.verdict === "incorrect" && e.correctAnswer === null, e.error || e.feedback?.slice(0, 80));
}
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
