// Phase 6 reliability tests over real HTTP, no model needed. The app runs in a child process whose model
// address points at a closed port, so every model call fails the way a stopped Ollama does.
// Checks: errors reach the browser as plain public messages (no URLs or provider text), the health check reports
// the model as unreachable, the app-only features keep working, and expired questions return 410.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { publicError, PUBLIC_ERRORS, LLMError } from "../src/llm.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const PORT = 3000 + Math.floor(Math.random() * 2000) + 4000;
const base = `http://127.0.0.1:${PORT}`;
const DEAD = "http://127.0.0.1:9"; // discard port: nothing listens there
let child;
let serverLog = "";

before(async () => {
  child = spawn(process.execPath, ["server.js"], { cwd: root, env: { ...process.env, PORT: String(PORT), LLM_PROVIDER: "ollama", OLLAMA_URL: DEAD, ANTHROPIC_API_KEY: "" }, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (d) => (serverLog += d));
  child.stderr.on("data", (d) => (serverLog += d));
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(base + "/api/topics")).ok) return; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not start:\n" + serverLog);
});
after(() => child?.kill());

const profile = { name: "Asha", level: "beginner", topic: "two-step" };
const post = async (path, body) => {
  const res = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};
const leaks = (text) => /127\.0\.0\.1|localhost|ollama|11434|ECONNREFUSED|fetch failed|stack|at\s+\w+\s+\(/i.test(text);

test("publicError maps every kind to a fixed message and unknown kinds to the provider message", () => {
  for (const kind of Object.keys(PUBLIC_ERRORS)) assert.equal(publicError(new LLMError("secret detail http://x", kind)).error, PUBLIC_ERRORS[kind]);
  assert.deepEqual(publicError(new LLMError("x", "weird")), { error: PUBLIC_ERRORS.provider, kind: "provider" });
});

test("model down: chat, questions and summary fail with a public message, never the model address", async () => {
  const calls = [
    post("/api/chat", { profile, mode: "learn", messages: [{ role: "user", content: "Teach me" }] }),
    post("/api/questions", { profile, count: 1 }),
    post("/api/summary", { profile, stats: { byTopic: {}, mistakes: [] } }),
  ];
  for (const r of await Promise.all(calls)) {
    assert.equal(r.status, 503);
    assert.equal(r.body.kind, "provider");
    assert.equal(r.body.error, PUBLIC_ERRORS.provider);
    assert.ok(!leaks(JSON.stringify(r.body)), JSON.stringify(r.body));
  }
  assert.match(serverLog, /\[llm:provider\] Cannot reach Ollama/, "the detail is kept in the server log");
});

test("health reports the model as unreachable without exposing its address", async () => {
  const h = await (await fetch(base + "/api/health")).json();
  assert.equal(h.ready, true);
  assert.equal(h.reachable, false);
  assert.ok(!leaks(JSON.stringify(h).replace(/"provider":"ollama"/, "")), JSON.stringify(h));
});

test("model down: app-only features still work (recommendations, worked examples)", async () => {
  const rec = await post("/api/recommend", { profile, stats: { byTopic: { "two-step": { attempted: 4, correct: 1 } } } });
  assert.equal(rec.status, 200);
  assert.equal(rec.body.adaptation, "ease");
  const ex = await post("/api/steps", { profile, index: 0 });
  assert.equal(ex.status, 200);
  assert.equal(ex.body.steps.at(-1).line, "x = 5");
});

test("expired or unknown questions return 410 for both answers and hints", async () => {
  const ev = await post("/api/evaluate", { profile, mode: "practice", questionId: "gone", studentAnswer: "x = 1", attempt: 1 });
  const hint = await post("/api/hint", { profile, questionId: "gone", level: 1 });
  assert.deepEqual([ev.status, hint.status], [410, 410]);
  assert.ok(!leaks(ev.body.error));
});

test("bad JSON and unknown routes get short, safe errors", async () => {
  const bad = await fetch(base + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: "{oops" });
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { error: "Invalid or too large JSON body" });
  const nf = await fetch(base + "/api/nope");
  assert.equal(nf.status, 404);
  assert.ok(!leaks(await nf.text()));
});
