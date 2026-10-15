// Tutor orchestration: chat, question generation (with self-consistency check),
// answer evaluation (deterministic verdict + LLM feedback, answer gating) and session summary.

import { randomUUID } from "node:crypto";
import { llm as defaultLlm, LLMError } from "./llm.js";
import { getTopic, TOPIC_IDS } from "./topics.js";
import { computeVerdictFor, checkQuestion, looksLikeOverride, formatTruth } from "./validate.js";
import { plainMath } from "./format.js";
import {
  buildChatSystem,
  buildQuestionSystem, questionUserMessage, QuestionSetSchema,
  buildFeedbackSystem, feedbackUserMessage, FeedbackSchema,
  buildSummarySystem, summaryUserMessage, SummarySchema,
} from "./prompts.js";

export const MAX_ATTEMPTS = { practice: 3, quiz: 1 };
export const GUARD_REPLY = "I'm your algebra tutor, so I'll stay with equations from your syllabus. Would you like an explanation, a practice question, or help with a specific equation?";
const QUESTION_TTL_MS = 3 * 60 * 60 * 1000;

/** Does the text state the answer as "x = N", "x is N" or "answer is N"? Used to catch leaks. */
export function revealsAnswer(text, answer, variable = "x") {
  if (!text) return false;
  const n = String(answer).replace(/[.+*?^${}()|[\]\\-]/g, "\\$&");
  const alt = Number.isInteger(answer) ? `${n}(?:\\.0+)?` : n;
  const re = new RegExp(String.raw`(?:\b${variable}\s*(?:=|is|equals)\s*|answer\s+is\s+|solution\s+is\s+)(?:${variable}\s*=\s*)?-?\(?\s*${alt}\b`, "i");
  return re.test(text.replace(/[−–]/g, "-"));
}

/** Leak check for any truth type; `exclude` lists values the student already found (allowed to be confirmed). */
export function revealsTruth(text, truth, exclude = []) {
  const notFound = (v) => !exclude.some((e) => Math.abs(e - v) < 1e-6);
  switch (truth.type) {
    case "number": return revealsAnswer(text, truth.value);
    case "pair": return revealsAnswer(text, truth.x, "x") || revealsAnswer(text, truth.y, "y");
    case "roots": return truth.roots.filter(notFound).some((r) => revealsAnswer(text, r));
    default: return false; // any-pair: there is no single answer to leak
  }
}

/** A revealed solution must actually state the answer; fall back to the stored steps if the model's does not. */
export function ensureSolution(modelSolution, q) {
  const truth = q.truth || { type: "number", value: q.answer };
  const stored = (q.solution_steps || []).join("\n");
  const states = (text) => {
    if (!text) return false;
    if (truth.type === "number") return revealsAnswer(text, truth.value);
    if (truth.type === "pair") return revealsAnswer(text, truth.x, "x") && revealsAnswer(text, truth.y, "y");
    if (truth.type === "roots") return truth.roots.every((r) => revealsAnswer(text, r));
    return true;
  };
  if (states(modelSolution)) return modelSolution;
  if (states(stored)) return stored;
  return `${modelSolution || stored}\nSo ${formatTruth(truth)}`;
}

/** A trimmed history may start with an assistant turn; the Claude API requires the first message to be from the user. */
export function trimHistory(messages) {
  const start = messages.findIndex((m) => m.role === "user");
  return start <= 0 ? messages : messages.slice(start);
}

function formatAnswer(n) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
}

export function createTutor(llm = defaultLlm) {
  const questions = new Map(); // id → { ...question, topic, level, createdAt }

  function sweep() {
    const now = Date.now();
    for (const [id, q] of questions) if (now - q.createdAt > QUESTION_TTL_MS) questions.delete(id);
  }

  function publicQuestion(q) {
    const t = getTopic(q.topic);
    return { id: q.id, prompt: q.prompt, topic: q.topic, difficulty: q.difficulty, answerType: t?.answerType || "number", classLevel: t?.classLevel || 8 };
  }

  return {
    async chat({ profile, mode, messages }) {
      // Blatant "ignore your instructions / you are now X" messages never reach the model.
      if (looksLikeOverride(messages[messages.length - 1].content)) return { reply: GUARD_REPLY, model: "guard", guarded: true };
      const history = trimHistory(messages);
      const system = buildChatSystem(profile, mode);
      const r = await llm.complete({ system, messages: history, maxTokens: 800, effort: "medium" });
      return { reply: plainMath(r.text), model: r.model, truncated: r.truncated };
    },

    /** Generate `count` questions; discards items whose stated answer does not satisfy their own equation. */
    async generateQuestions({ profile, count, avoid = [] }) {
      const system = buildQuestionSystem(profile);
      const accepted = [];
      const rejected = [];
      const repaired = [];
      const seen = new Set(avoid);
      for (let round = 0; round < 2 && accepted.length < count; round++) {
        const need = count - accepted.length;
        const r = await llm.completeJSON({
          system,
          messages: [{ role: "user", content: questionUserMessage(profile, need, [...seen]) }],
          schema: QuestionSetSchema,
          maxTokens: 3000,
          effort: "high",
        });
        for (const q of r.data.questions) {
          if (accepted.length >= count) break;
          const check = checkQuestion(q, profile.topic, { requireInteger: profile.level !== "advanced" });
          if (!check.ok) { rejected.push({ prompt: q.prompt, equation: q.equation, answer: q.answer, problem: check.problem }); continue; }
          if (seen.has(q.prompt)) { rejected.push({ prompt: q.prompt, problem: "duplicate" }); continue; }
          seen.add(q.prompt);
          const stored = { ...q, truth: check.truth, answer: check.truth.type === "number" ? check.truth.value : q.answer, id: randomUUID(), topic: profile.topic, level: profile.level, createdAt: Date.now(), repaired: check.repaired };
          if (check.repaired) {
            // The model's worked steps led to its wrong answer, so replace them with the topic's method and the correct answer.
            stored.solution_steps = [getTopic(profile.topic).method, formatTruth(check.truth)];
            repaired.push({ prompt: q.prompt, problem: check.problem });
          }
          questions.set(stored.id, stored);
          accepted.push(stored);
        }
      }
      sweep();
      for (const r of rejected) console.warn(`[questions] rejected (${profile.topic}/${profile.level}): ${r.problem} — "${r.prompt}"`);
      for (const r of repaired) console.warn(`[questions] repaired (${profile.topic}/${profile.level}): ${r.problem}`);
      if (accepted.length === 0) throw new LLMError(`Could not generate a usable question. Please try again. (${rejected.map((r) => r.problem).join("; ") || "model returned no questions"})`, "generation", 502);
      return { questions: accepted.map(publicQuestion), rejected, repaired };
    },

    /** Deterministic verdict + LLM-written feedback. The correct value is only released when allowed. */
    async evaluate({ profile, mode, questionId, studentAnswer, attempt }) {
      const q = questions.get(questionId);
      if (!q) {
        const err = new Error("This question has expired. Please ask for a new one.");
        err.status = 410;
        throw err;
      }
      const maxAttempts = MAX_ATTEMPTS[mode];
      const truth = q.truth || { type: "number", value: q.answer };
      const { verdict, parsed, found = [] } = computeVerdictFor(truth, studentAnswer);
      const reveal = verdict === "correct" || (verdict !== "unclear" && attempt >= maxAttempts) || (mode === "quiz");

      const system = buildFeedbackSystem(profile);
      const userMsg = feedbackUserMessage({
        question: q.prompt, correctAnswer: formatTruth(truth), studentText: studentAnswer,
        verdict, attempt, maxAttempts, reveal, mode, found,
      });
      let r = await llm.completeJSON({ system, messages: [{ role: "user", content: userMsg }], schema: FeedbackSchema, maxTokens: 1200, effort: "medium" });
      let fb = r.data;

      // Gate: never leak the answer before it may be revealed, regardless of what the model wrote.
      let leaked = false;
      if (!reveal) {
        const leakyField = ["feedback", "hint"].find((f) => revealsTruth(fb[f], truth, found));
        if (leakyField) {
          leaked = true;
          r = await llm.completeJSON({
            system,
            messages: [
              { role: "user", content: userMsg },
              { role: "assistant", content: JSON.stringify(fb) },
              { role: "user", content: "Your previous reply revealed the answer, which is not allowed yet. Rewrite the feedback and hint WITHOUT stating the answer. Keep the solution field empty." },
            ],
            schema: FeedbackSchema, maxTokens: 1200, effort: "medium",
          });
          fb = r.data;
          if (["feedback", "hint"].some((f) => revealsTruth(fb[f], truth, found))) {
            // Fall back to the safe hint stored at generation time.
            fb = { feedback: verdict === "unclear" ? "I need your answer in the expected form to check it." : "That is not quite right yet. Have another look at your first step.", hint: q.hint, encouragement: "You can do this. Try again!", solution: "" };
          }
        }
        fb.solution = "";
      }

      for (const f of ["feedback", "hint", "encouragement", "solution"]) fb[f] = plainMath(fb[f]);

      return {
        verdict,
        correct: verdict === "correct",
        parsedAnswer: parsed,
        feedback: fb.feedback,
        hint: fb.hint,
        encouragement: fb.encouragement,
        solution: reveal ? ensureSolution(fb.solution, q) : "",
        correctAnswer: reveal ? formatTruth(truth) : null,
        answerType: getTopic(q.topic)?.answerType || "number",
        revealed: reveal,
        attemptsLeft: verdict === "incorrect" || verdict === "partial" ? Math.max(0, maxAttempts - attempt) : maxAttempts - attempt + 1,
        topic: q.topic,
        model: r.model,
        leakCaught: leaked,
      };
    },

    /** Strengths / needs-practice are computed here; the model only writes the recommendation. */
    async summarize({ profile, stats }) {
      const strengths = [];
      const needsPractice = [];
      for (const [id, s] of Object.entries(stats.byTopic)) {
        if (s.attempted === 0) continue;
        const rate = s.correct / s.attempted;
        if (s.attempted >= 2 && rate >= 0.75) strengths.push(id);
        else if (rate < 0.6) needsPractice.push(id);
      }
      const attempted = Object.values(stats.byTopic).reduce((a, s) => a + s.attempted, 0);
      const correct = Object.values(stats.byTopic).reduce((a, s) => a + s.correct, 0);

      // The app decides the next topic (run 1, S19: the model ignored the "weakest topic" rule).
      // Weakest needs-practice topic first; otherwise the topic after the last one attempted, in syllabus order.
      let nextId;
      if (needsPractice.length) {
        nextId = needsPractice.sort((a, b) => stats.byTopic[a].correct / stats.byTopic[a].attempted - stats.byTopic[b].correct / stats.byTopic[b].attempted)[0];
      } else {
        const attemptedIds = TOPIC_IDS.filter((id) => stats.byTopic[id]?.attempted > 0);
        const last = attemptedIds.length ? attemptedIds[attemptedIds.length - 1] : profile.topic;
        nextId = TOPIC_IDS[Math.min(TOPIC_IDS.indexOf(last) + 1, TOPIC_IDS.length - 1)];
      }

      const r = await llm.completeJSON({
        system: buildSummarySystem(),
        messages: [{ role: "user", content: summaryUserMessage(profile, stats, strengths, needsPractice, nextId) }],
        schema: SummarySchema, maxTokens: 1500, effort: "low",
      });
      return {
        attempted, correct,
        strengths: strengths.map((id) => getTopic(id).name),
        needsPractice: needsPractice.map((id) => getTopic(id).name),
        nextTopicId: nextId,
        nextLesson: getTopic(nextId).name,
        message: plainMath(r.data.message),
        tips: r.data.tips.slice(0, 3).map(plainMath),
        model: r.model,
      };
    },

    _store: questions, // exposed for tests
  };
}

export const tutor = createTutor();
