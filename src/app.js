import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { TOPICS, LEVELS } from "./topics.js";
import { tutor, MAX_ATTEMPTS } from "./tutor.js";
import { LLMError, publicError, providerReachable } from "./llm.js";
import { ChatRequestSchema, QuestionsRequestSchema, EvaluateRequestSchema, SummaryRequestSchema, HintRequestSchema, RecommendRequestSchema, StepsRequestSchema } from "./validate.js";

const here = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const app = express();

app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(here, "public")));
app.use("/reports", express.static(path.join(here, "reports"))); // the quality dashboard: /reports/dashboard.html (npm run dashboard)

// ---- helpers ----
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid request", details: result.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`) });
  }
  req.data = result.data;
  next();
};
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

// ---- routes ----
app.get("/api/health", wrap(async (_req, res) => {
  const ready = config.provider !== "claude" || config.claude.configured;
  const reachable = ready ? await providerReachable() : null; // Phase 6: true / false for Ollama, null for Claude
  res.json({ ok: true, ready, reachable, provider: config.provider, model: config.provider === "claude" ? config.claude.model : config.ollama.model, ...(ready ? {} : { warning: "LLM_PROVIDER is claude but ANTHROPIC_API_KEY is not set" }) });
}));

app.get("/api/topics", (_req, res) => {
  res.json({ topics: TOPICS.map(({ id, name, forms, classLevel, chapter, answerType, prerequisite, kind }) => ({ id, name, forms, classLevel, chapter, answerType, prerequisite, workedExamples: kind === "equation" })), levels: LEVELS, maxAttempts: MAX_ATTEMPTS });
});

app.post("/api/chat", validate(ChatRequestSchema), wrap(async (req, res) => {
  const { messages } = req.data;
  if (messages[messages.length - 1].role !== "user") return res.status(400).json({ error: "Last message must be from the user" });
  res.json(await tutor.chat(req.data));
}));

app.post("/api/questions", validate(QuestionsRequestSchema), wrap(async (req, res) => {
  const { questions, rejected, repaired } = await tutor.generateQuestions(req.data);
  res.json({ questions, rejectedCount: rejected.length, rejected: rejected.map(({ prompt, problem }) => ({ prompt, problem })), repairedCount: repaired.length, repaired });
}));

app.post("/api/evaluate", validate(EvaluateRequestSchema), wrap(async (req, res) => {
  res.json(await tutor.evaluate(req.data));
}));

// Phase 3: the app's own ladder hint (no model call, does not use an attempt).
app.post("/api/hint", validate(HintRequestSchema), (req, res) => {
  res.json(tutor.hint(req.data));
});

// Phase 5: verified worked example for Learn (no model call).
app.post("/api/steps", validate(StepsRequestSchema), (req, res) => {
  res.json(tutor.example(req.data));
});

// Phase 4: the app's recommendation rules for the student dashboard (no model call).
app.post("/api/recommend", validate(RecommendRequestSchema), (req, res) => {
  res.json(tutor.recommend(req.data));
});

app.post("/api/summary", validate(SummaryRequestSchema), wrap(async (req, res) => {
  res.json(await tutor.summarize(req.data));
}));

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// ---- errors ----
app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed" || err?.type === "entity.too.large") {
    return res.status(400).json({ error: "Invalid or too large JSON body" });
  }
  if (err instanceof LLMError) {
    // Never forward provider details (URLs, raw API replies) to the browser; log them here instead.
    console.error(`[llm:${err.kind}] ${err.message}`);
    return res.status(err.status).json(publicError(err));
  }
  if (err?.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  return res.status(500).json({ error: "Something went wrong on the server." });
});

export { app };
