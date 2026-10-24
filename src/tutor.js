// Tutor orchestration: chat, question generation (with self-consistency check),
// answer evaluation (deterministic verdict + LLM feedback, answer gating) and session summary.

import { randomUUID } from "node:crypto";
import { llm as defaultLlm, LLMError } from "./llm.js";
import { getTopic } from "./topics.js";
import { computeVerdictFor, checkQuestion, looksLikeOverride, formatTruth } from "./validate.js";
import { plainMath } from "./format.js";
import { diagnose } from "./diagnose.js";
import { ladderHint, ladderSteps, sameHint, MAX_HINT_LEVEL } from "./hints.js";
import { recommend } from "./recommend.js";
import { stepsForQuestion, exampleEquations, linearSteps } from "./steps.js";
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

// Sentences that claim to know what the student did ("It looks like you…", "You might have…").
const GUESS = /^(?:it\s+(?:looks|seems)\s+(?:like|as\s+if|that)\s+you|you\s+(?:might|may|must|probably)\s+have|you(?:'ve|\s+have)\s+(?:probably\s+)?(?:made|forgotten|forgot|added|subtracted|multiplied|divided|mixed|swapped|moved)|perhaps\s+you|maybe\s+you)/i;
export const ASK_FOR_STEPS = "I can't tell from the answer alone where it went wrong. Write your steps in the working box and I'll point to the line that needs fixing.";
export const COMPARE_STEPS = "I can't tell from the answer alone where it went wrong, so compare your steps with the worked solution below, line by line.";

/**
 * With no evidence (diagnosis unknown and no working), remove sentences that guess the student's mistake and
 * ask for the steps instead. Returns { text, removed }.
 */
export const NEED_ANSWER = "I need your answer in the expected form to check it.";
/** `context`: "ask" (wrong answer, ask for the steps), "compare" (after the reveal), "unclear" (no answer given). */
export function dropGuesses(text, context = "ask") {
  const replacement = context === true || context === "compare" ? COMPARE_STEPS : context === "unclear" ? "" : ASK_FOR_STEPS;
  const sentences = String(text || "").match(/[^.!?]+[.!?]*\s*/g) || [];
  const kept = sentences.filter((s) => !GUESS.test(s.trim()));
  if (kept.length === sentences.length) return { text, removed: 0 };
  const body = kept.join("").trim();
  const joined = [body, replacement].filter(Boolean).join(" ");
  return { text: joined || NEED_ANSWER, removed: sentences.length - kept.length };
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

  /** One topic: up to two rounds of generation, each question checked against the topic. */
  async function generateFor(profile, count, avoid, difficultyBias) {
    const system = buildQuestionSystem(profile);
    const accepted = [];
    const rejected = [];
    const repaired = [];
    const seen = new Set(avoid);
    for (let round = 0; round < 2 && accepted.length < count; round++) {
      const need = count - accepted.length;
      const r = await llm.completeJSON({
        system,
        messages: [{ role: "user", content: questionUserMessage(profile, need, [...seen], difficultyBias) }],
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

    /**
     * Generate `count` questions; discards items whose stated answer does not satisfy their own equation.
     * With `topics` (2–5 ids, mixed revision) the count is spread over the topics in turn; each question is
     * generated and checked against its own topic, and the results are interleaved.
     */
    async generateQuestions({ profile, count, avoid = [], difficultyBias = "normal", topics }) {
      if (!topics?.length) return generateFor(profile, count, avoid, difficultyBias);
      const share = topics.map((_, i) => Math.floor(count / topics.length) + (i < count % topics.length ? 1 : 0));
      const groups = [];
      const rejected = [];
      const repaired = [];
      const failures = [];
      // One model call per topic. With Claude they run concurrently. A local Ollama model serves one request at a
      // time, so concurrent calls only queue, and the queue time counts against each call's 300 s limit (Phase 6
      // full run, S26: timeout); for the local model they run one after another, each with its full budget.
      const one = (topic, i) => (share[i] ? generateFor({ ...profile, topic }, share[i], avoid, difficultyBias) : Promise.resolve(null));
      let settled;
      if (llm.provider === "claude") settled = await Promise.allSettled(topics.map(one));
      else { settled = []; for (let i = 0; i < topics.length; i++) settled.push(await one(topics[i], i).then((value) => ({ status: "fulfilled", value }), (reason) => ({ status: "rejected", reason }))); }
      settled.forEach((res, i) => {
        if (!share[i]) return;
        if (res.status === "fulfilled") {
          groups.push(res.value.questions);
          rejected.push(...res.value.rejected);
          repaired.push(...res.value.repaired);
          return;
        }
        // One topic failing to produce a usable question does not cancel the quiz; a provider failure does.
        const e = res.reason;
        if (e instanceof LLMError && e.kind === "generation") failures.push(`${topics[i]}: ${e.message}`);
        else throw e;
      });
      const questions = [];
      for (let round = 0; groups.some((g) => g[round]); round++) for (const g of groups) if (g[round]) questions.push(g[round]);
      if (!questions.length) throw new LLMError(`Could not generate a usable question for any of the chosen topics. Please try again. (${failures.join("; ")})`, "generation", 502);
      return { questions, rejected, repaired };
    },

    /** Worked example for Learn from the topic's example list; null steps for topics without one. */
    example({ profile, index = 0 }) {
      const list = exampleEquations(profile.topic);
      if (!list.length) return { equation: null, steps: null, index: 0, count: 0 };
      const i = index % list.length;
      return { equation: list[i], steps: linearSteps(list[i], profile.topic).steps, index: i, count: list.length };
    },

    /** Deterministic next step for the student dashboard: no model call. */
    recommend({ profile, stats }) {
      const r = recommend(stats, profile.topic);
      return { ...r, nextLesson: getTopic(r.nextTopicId).name };
    },


    /** Deterministic verdict + LLM-written feedback. The correct value is only released when allowed. */
    async evaluate({ profile, mode, questionId, studentAnswer, attempt, working, previousHints = [] }) {
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
      // Ladder: attempt 1 → the idea, attempt 2 → the concrete step, last attempt → the reveal.
      // Hints already shown (by the Hint button or earlier feedback) push the level up, so nothing is repeated.
      const hintLevel = verdict === "correct" ? null : reveal ? 3 : Math.min(MAX_HINT_LEVEL, Math.max(attempt, previousHints.length + 1));
      const diagnosis = diagnose({ q, truth, verdict, parsed });
      // Working is the student's own text; an override attempt in it is dropped rather than quoted to the model.
      const workingUsed = Boolean(working) && !looksLikeOverride(working);

      const system = buildFeedbackSystem(profile);
      const userMsg = feedbackUserMessage({
        question: q.prompt, correctAnswer: formatTruth(truth), studentText: studentAnswer,
        verdict, attempt, maxAttempts, reveal, mode, found,
        hintLevel, previousHints, diagnosis, working: workingUsed ? working : undefined,
      });
      let r = await llm.completeJSON({ system, messages: [{ role: "user", content: userMsg }], schema: FeedbackSchema, maxTokens: 1200, effort: "medium" });
      let fb = r.data;

      // Gate: never leak the answer before it may be revealed, regardless of what the model wrote.
      let leaked = false;
      let hintReplaced = false;
      let hintFromFallback = false;
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
            hintFromFallback = true;
            // Fall back to the safe hint stored at generation time.
            fb = { feedback: verdict === "unclear" ? "I need your answer in the expected form to check it." : "That is not quite right yet. Have another look at your first step.", hint: q.hint, encouragement: "You can do this. Try again!", solution: "" };
          }
        }
        fb.solution = "";
        // Level 1 names the idea only: a model hint with numbers in it is a concrete step, so use the app's idea hint.
        if (verdict !== "correct" && hintLevel === 1 && !hintFromFallback && /\d/.test(fb.hint || "")) {
          const idea = ladderHint(q, 1);
          if (idea && !previousHints.some((p) => sameHint(p, idea))) { fb.hint = idea; hintReplaced = true; }
        }
        // A hint must be new: if it repeats an earlier hint (or is empty), use the next app step not yet given.
        if (verdict !== "correct" && (!fb.hint || previousHints.some((h) => sameHint(h, fb.hint)))) {
          const options = [ladderHint(q, hintLevel), ...ladderSteps(q), q.hint].filter(Boolean);
          const fresh = options.find((h) => !previousHints.some((p) => sameHint(p, h)) && !revealsTruth(h, truth, found));
          if (fresh) { fb.hint = fresh; hintReplaced = true; }
        }
      }

      // No evidence, no claim: the model may not invent a mistake the app could not identify.
      let guessesRemoved = 0;
      if ((diagnosis?.confidence === "unknown" || verdict === "unclear") && !workingUsed) {
        const g = dropGuesses(fb.feedback, verdict === "unclear" ? "unclear" : reveal ? "compare" : "ask");
        fb.feedback = g.text;
        guessesRemoved = g.removed;
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
        diagnosis,
        hintLevel,
        hintReplaced,
        workingUsed,
        guessesRemoved,
        // Phase 5: verified steps for the balance-scale view, only once the answer is revealed.
        steps: reveal ? stepsForQuestion(q)?.steps ?? null : null,
      };
    },

    /** Hint button: the app's own ladder hint for the question, without a model call and without using an attempt. */
    hint({ questionId, level }) {
      const q = questions.get(questionId);
      if (!q) {
        const err = new Error("This question has expired. Please ask for a new one.");
        err.status = 410;
        throw err;
      }
      const truth = q.truth || { type: "number", value: q.answer };
      const lv = Math.min(Math.max(level, 1), MAX_HINT_LEVEL);
      let text = ladderHint(q, lv);
      if (revealsTruth(text, truth)) text = getTopic(q.topic)?.method || "Work one step at a time and check each step.";
      return { hint: text, hintLevel: lv, maxHintLevel: MAX_HINT_LEVEL };
    },

    /** Strengths / needs-practice are computed here; the model only writes the recommendation. */
    async summarize({ profile, stats, session }) {
      // Today's figures come from this session when the browser sends it; the recommendation uses all saved answers.
      const today = session || stats;
      const strengths = [];
      const needsPractice = [];
      for (const [id, s] of Object.entries(today.byTopic)) {
        if (s.attempted === 0) continue;
        const rate = s.correct / s.attempted;
        if (s.attempted >= 2 && rate >= 0.75) strengths.push(id);
        else if (rate < 0.6) needsPractice.push(id);
      }
      const attempted = Object.values(today.byTopic).reduce((a, s) => a + s.attempted, 0);
      const correct = Object.values(today.byTopic).reduce((a, s) => a + s.correct, 0);

      // The app decides the next step (run 1, S19: the model ignored the "weakest topic" rule).
      // Phase 4: transparent rules in src/recommend.js, with a reason built from the numbers.
      const rec = recommend(stats, profile.topic);
      const nextId = rec.nextTopicId;

      const r = await llm.completeJSON({
        system: buildSummarySystem(),
        messages: [{ role: "user", content: summaryUserMessage(profile, stats, strengths, needsPractice, nextId, rec, session) }],
        schema: SummarySchema, maxTokens: 1500, effort: "low",
      });
      return {
        attempted, correct,
        strengths: strengths.map((id) => getTopic(id).name),
        needsPractice: needsPractice.map((id) => getTopic(id).name),
        nextTopicId: nextId,
        nextLesson: getTopic(nextId).name,
        reason: rec.reason,
        adaptation: rec.adaptation,
        difficultyBias: rec.difficultyBias,
        insufficientData: rec.insufficientData,
        message: plainMath(r.data.message),
        tips: r.data.tips.slice(0, 3).map(plainMath),
        model: r.model,
      };
    },

    _store: questions, // exposed for tests
  };
}

export const tutor = createTutor();
