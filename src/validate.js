import { z } from "zod";
import { TOPIC_IDS, LEVELS, getTopic } from "./topics.js";
import { config } from "./config.js";
import { equationHolds, evaluate, ExprError } from "./expr.js";

// ---------- request schemas ----------

export const ProfileSchema = z.object({
  name: z.string().trim().min(1).max(40),
  level: z.enum(LEVELS),
  topic: z.enum(TOPIC_IDS),
});

// The learner's messages are capped; the tutor's own earlier replies (sent back as history) may be longer.
const MessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(config.limits.maxAssistantChars),
  })
  .refine((m) => m.role !== "user" || m.content.length <= config.limits.maxMessageChars, {
    message: `Too big: expected string to have <=${config.limits.maxMessageChars} characters`,
    path: ["content"],
  });

export const ChatRequestSchema = z.object({
  profile: ProfileSchema,
  mode: z.enum(["learn", "doubt"]),
  messages: z.array(MessageSchema).min(1).max(config.limits.maxHistoryMessages),
});

export const DIFFICULTY_BIASES = ["easier", "normal", "harder"];

export const QuestionsRequestSchema = z.object({
  profile: ProfileSchema,
  count: z.number().int().min(1).max(5).default(1),
  avoid: z.array(z.string().max(300)).max(20).default([]),
  // Phase 4 (additive, optional): difficulty within the level, and 2–5 topics for a mixed revision quiz.
  difficultyBias: z.enum(DIFFICULTY_BIASES).default("normal"),
  topics: z.array(z.enum(TOPIC_IDS)).min(2).max(5)
    .refine((ids) => new Set(ids).size === ids.length, { message: "topics must not repeat" })
    .optional(),
});

export const EvaluateRequestSchema = z.object({
  profile: ProfileSchema,
  mode: z.enum(["practice", "quiz"]),
  questionId: z.string().min(1).max(64),
  studentAnswer: z.string().trim().min(1).max(config.limits.maxAnswerChars),
  attempt: z.number().int().min(1).max(3),
  // Phase 3 (additive, optional): the student's working, and the hints already shown for this question.
  working: z.string().trim().max(config.limits.maxWorkingChars).optional(),
  previousHints: z.array(z.string().max(400)).max(3).optional(),
});

// Phase 5: worked example for Learn, chosen from the topic's own example equations (never student-typed).
export const StepsRequestSchema = z.object({
  profile: ProfileSchema,
  index: z.number().int().min(0).max(9).default(0),
});

export const HintRequestSchema = z.object({
  profile: ProfileSchema,
  questionId: z.string().min(1).max(64),
  level: z.number().int().min(1).max(2),
});

const ByTopicSchema = z.partialRecord(
  z.enum(TOPIC_IDS),
  z.object({ attempted: z.number().int().min(0), correct: z.number().int().min(0) }),
);

// Phase 4: deterministic recommendation for the student dashboard (no model call).
export const RecommendRequestSchema = z.object({
  profile: ProfileSchema,
  stats: z.object({ byTopic: ByTopicSchema }),
});

export const SummaryRequestSchema = z.object({
  profile: ProfileSchema,
  // Phase 4 (optional): this session's counts for "Today's performance"; `stats` holds all saved answers.
  session: z.object({ byTopic: ByTopicSchema }).optional(),
  stats: z.object({
    // partialRecord: a session usually touches only some topics (z.record over an enum would demand every key)
    byTopic: z.partialRecord(
      z.enum(TOPIC_IDS),
      z.object({ attempted: z.number().int().min(0), correct: z.number().int().min(0) }),
    ),
    mistakes: z
      .array(z.object({ question: z.string().max(400), studentAnswer: z.string().max(100), correctAnswer: z.string().max(80) }))
      .max(30)
      .default([]),
  }),
});

// ---------- deterministic answer parsing ----------

const NUMBER = String.raw`-?\d+(?:\.\d+)?`;
const FRACTION = String.raw`${NUMBER}\s*/\s*${NUMBER}`;
const VALUE = `(?:${FRACTION}|${NUMBER})`;

function toNumber(str) {
  const s = str.replace(/\s+/g, "");
  if (s.includes("/")) {
    const [n, d] = s.split("/").map(Number);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
    return n / d;
  }
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}
const clean = (text) => String(text).replace(/[−–]/g, "-").replace(/,(?=\d{3}\b)/g, "").toLowerCase();

/**
 * Extract a single numeric answer from free text.
 * Accepts "6", "x = 6", "x=-3", "2.5", "3/2", "the answer is 6", "so x is 6",
 * and multi-line working that ends with "x = 6". Returns null when no single value is clear.
 */
export function parseStudentAnswer(text) {
  const cleaned = clean(text);
  const explicit = [...cleaned.matchAll(new RegExp(String.raw`\b[xy]\s*(?:=|is|equals)\s*(${VALUE})`, "g"))];
  if (explicit.length) return toNumber(explicit[explicit.length - 1][1]);
  const values = [...cleaned.matchAll(new RegExp(VALUE, "g"))].map((m) => m[0]);
  if (values.length === 1) return toNumber(values[0]);
  return null;
}

/** "(3, 2)", "x = 3, y = 2", "y = 2 and x = 3", "3 and 2", "3,2" → { x, y }; null when unclear. */
export function parsePair(text) {
  const cleaned = clean(text);
  const xm = cleaned.match(new RegExp(String.raw`\bx\s*(?:=|is)\s*(${VALUE})`));
  const ym = cleaned.match(new RegExp(String.raw`\by\s*(?:=|is)\s*(${VALUE})`));
  if (xm && ym) return { x: toNumber(xm[1]), y: toNumber(ym[1]) };
  if (xm || ym) return null; // only one variable given
  const values = [...cleaned.matchAll(new RegExp(VALUE, "g"))].map((m) => toNumber(m[0]));
  if (values.length === 2) return { x: values[0], y: values[1] };
  return null;
}

/** "2 and 3", "x = 2, 3", "x = 2 or x = 3", "-1, 4", "3" → sorted distinct numbers; null when nothing numeric. */
export function parseRoots(text) {
  const cleaned = clean(text).replace(/\bx\s*(?:=|is)\s*/g, " ");
  const values = [...cleaned.matchAll(new RegExp(VALUE, "g"))].map((m) => toNumber(m[0])).filter((v) => v !== null);
  if (!values.length || values.length > 2) return null;
  return [...new Set(values)].sort((a, b) => a - b);
}

// 0.5 % relative: a student who types 2.33 for 7/3 is right; 2.3 is not.
export function answersMatch(student, correct, tolerance = 5e-3) {
  if (student === null || student === undefined) return false;
  const scale = Math.max(1, Math.abs(correct));
  return Math.abs(student - correct) / scale < tolerance;
}

/** Verdict for a single-number answer. */
export function computeVerdict(studentText, correctAnswer) {
  const parsed = parseStudentAnswer(studentText);
  if (parsed === null) return { verdict: "unclear", parsed: null };
  return { verdict: answersMatch(parsed, correctAnswer) ? "correct" : "incorrect", parsed };
}

/**
 * Verdict for any answer type. `truth` is what the app stored with the question:
 *   { type: "number", value } · { type: "pair", x, y } · { type: "any-pair", equation } · { type: "roots", roots }
 * Verdicts: correct · incorrect · unclear · partial (one of two roots found).
 */
export function computeVerdictFor(truth, studentText) {
  switch (truth.type) {
    case "number":
      return computeVerdict(studentText, truth.value);
    case "pair": {
      const p = parsePair(studentText);
      if (!p || p.x === null || p.y === null) return { verdict: "unclear", parsed: null };
      return { verdict: answersMatch(p.x, truth.x) && answersMatch(p.y, truth.y) ? "correct" : "incorrect", parsed: p };
    }
    case "any-pair": {
      const p = parsePair(studentText);
      if (!p || p.x === null || p.y === null) return { verdict: "unclear", parsed: null };
      let ok = false;
      try { ok = equationHolds(truth.equation, p.x, 5e-3, p.y); } catch { ok = false; }
      return { verdict: ok ? "correct" : "incorrect", parsed: p };
    }
    case "roots": {
      const r = parseRoots(studentText);
      if (!r) return { verdict: "unclear", parsed: null };
      const hits = r.filter((v) => truth.roots.some((t) => answersMatch(v, t)));
      const allFound = truth.roots.every((t) => r.some((v) => answersMatch(v, t)));
      if (allFound && hits.length === r.length) return { verdict: "correct", parsed: r };
      if (hits.length > 0) return { verdict: "partial", parsed: r, found: hits };
      return { verdict: "incorrect", parsed: r };
    }
    default:
      return { verdict: "unclear", parsed: null };
  }
}

// ---------- deterministic solving ----------

const NUM = String.raw`\d+(?:\.\d+)?`;
const normalizeEq = (eq) =>
  String(eq).replace(/\s+/g, "").replace(/÷/g, "/").replace(/×/g, "*").replace(/²/g, "^2").replace(/(\d)([xy])/g, "$1*$2").replace(/(\d)\(/g, "$1*(").replace(/[−–]/g, "-");

/** "Solve: 3x + 5 = 20." → "3x + 5 = 20"; null when the text holds no single equation. */
export function extractEquation(prompt) {
  let s = String(prompt).replace(/[−–]/g, "-").replace(/^\s*solve(\s+for\s+[xy])?\s*:?\s*/i, "").replace(/[.\s]+$/, "").trim();
  if (s.includes(":")) s = s.slice(s.lastIndexOf(":") + 1).trim();
  return s.split("=").length === 2 ? s : null;
}

/** Linear equation in x: f(x) = lhs - rhs is linear, so x = -f(0) / (f(1) - f(0)). */
export function solveLinear(equation) {
  const parts = String(equation).split("=");
  if (parts.length !== 2) return null;
  let f0, f1, f2;
  try { const f = (x) => evaluate(parts[0], x) - evaluate(parts[1], x); f0 = f(0); f1 = f(1); f2 = f(2); }
  catch (e) { if (e instanceof ExprError) return null; throw e; }
  const m = f1 - f0;
  if (Math.abs(f2 - f1 - m) > 1e-9 * Math.max(1, Math.abs(m))) return null; // not linear
  if (Math.abs(m) < 1e-12) return null;
  return Math.round((-f0 / m) * 1e9) / 1e9;
}

/** Coefficients p, q, r of a linear equation in x and y written as p·x + q·y + r = 0 (null if not linear). */
export function linearCoeffs2(equation) {
  const parts = String(equation).split("=");
  if (parts.length !== 2) return null;
  let f;
  try { f = (x, y) => evaluate(parts[0], x, y) - evaluate(parts[1], x, y); f(0, 0); }
  catch (e) { if (e instanceof ExprError) return null; throw e; }
  const r = f(0, 0), p = f(1, 0) - r, q = f(0, 1) - r;
  const check = (x, y) => Math.abs(f(x, y) - (p * x + q * y + r)) <= 1e-9 * Math.max(1, Math.abs(p), Math.abs(q), Math.abs(r));
  if (!check(1, 1) || !check(2, 3) || !check(-1, 2)) return null;
  return { p, q, r };
}

/** Value of y that satisfies the equation at the given x (null if y has no unique value). */
export function solveForY(equation, xValue) {
  const c = linearCoeffs2(equation);
  if (!c || Math.abs(c.q) < 1e-12) return null;
  return Math.round((-(c.p * xValue + c.r) / c.q) * 1e9) / 1e9;
}

/** Unique solution of two linear equations in x and y (Cramer's rule); null if none or infinitely many. */
export function solveSystem(eq1, eq2) {
  const a = linearCoeffs2(eq1), b = linearCoeffs2(eq2);
  if (!a || !b) return null;
  const det = a.p * b.q - a.q * b.p;
  if (Math.abs(det) < 1e-12) return null;
  const x = (-a.r * b.q + a.q * b.r) / det;
  const y = (-a.p * b.r + a.r * b.p) / det;
  return { x: Math.round(x * 1e9) / 1e9, y: Math.round(y * 1e9) / 1e9 };
}

/** Real roots of a quadratic equation in x, sorted ascending (null if not quadratic or no real roots). */
export function solveQuadratic(equation) {
  const parts = String(equation).split("=");
  if (parts.length !== 2) return null;
  let g;
  try { g = (x) => evaluate(parts[0], x) - evaluate(parts[1], x); g(0); }
  catch (e) { if (e instanceof ExprError) return null; throw e; }
  const g0 = g(0), g1 = g(1), g2 = g(2);
  const a = (g2 - 2 * g1 + g0) / 2, b = g1 - g0 - a, c = g0;
  const check = (x) => Math.abs(g(x) - (a * x * x + b * x + c)) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b), Math.abs(c));
  if (!check(3) || !check(-2) || Math.abs(a) < 1e-12) return null;
  const disc = b * b - 4 * a * c;
  if (disc < -1e-9) return null;
  const s = Math.sqrt(Math.max(0, disc));
  const roots = [(-b - s) / (2 * a), (-b + s) / (2 * a)].map((r) => Math.round(r * 1e9) / 1e9).sort((p, q) => p - q);
  return roots;
}

// ---------- topic adherence (structural) ----------

/** Shape check for the Class 8 single-variable topics; other kinds are checked while solving. */
export function topicShapeProblem(topicId, q) {
  const t = getTopic(topicId);
  if (!t) return null;
  const promptHasEq = /=/.test(q.prompt);
  if (t.kind === "word") {
    if (promptHasEq) return "word problem prompt must be a story, not a bare equation";
    if (q.prompt.trim().split(/\s+/).length < 6) return "word problem prompt is too short to be a story";
    return null;
  }
  if (t.kind !== "equation") return null;
  if (!promptHasEq) return "prompt is not an equation (looks like a word problem)";
  const eq = normalizeEq(extractEquation(q.prompt) || q.equation);
  const [l, r] = eq.split("=");
  const hasX = (side) => /x/.test(side);
  const isNum = (side) => new RegExp(`^-?${NUM}$`).test(side);
  const xSide = hasX(l) && !hasX(r) ? l : !hasX(l) && hasX(r) ? r : null;
  const numSide = xSide === l ? r : l;
  switch (topicId) {
    case "one-step": {
      if (!xSide || !isNum(numSide)) return "one-step: one side must be just a number";
      const forms = [`^x[+-]${NUM}$`, `^${NUM}\\+x$`, `^-?${NUM}\\*x$`, `^x/${NUM}$`];
      return forms.some((p) => new RegExp(p).test(xSide)) ? null : `one-step: "${xSide}" is not a single-operation form`;
    }
    case "two-step": {
      if (!xSide || !isNum(numSide)) return "two-step: one side must be just a number";
      const term = `(?:-?${NUM}\\*x|x/${NUM}|-?${NUM}\\*x/${NUM})`;
      const forms = [`^${term}[+-]${NUM}$`, `^-?${NUM}[+-]${term}$`];
      return forms.some((p) => new RegExp(p).test(xSide)) ? null : `two-step: "${xSide}" is not of the form a*x ± b`;
    }
    case "both-sides":
      return hasX(l) && hasX(r) ? null : "both-sides: x must appear on both sides";
    case "brackets":
      return /\([^()]*x[^()]*\)/.test(eq) ? null : "brackets: needs a bracket containing x";
    case "fractions":
      return /\//.test(eq) ? null : "fractions: needs a fraction";
    default:
      return null;
  }
}

// ---------- full question check ----------

const isInt = (v) => Number.isInteger(v);
const fmt = (v) => Math.round(v * 10000) / 10000;
const bad = (problem) => ({ ok: false, problem });
const good = (truth, repaired = false, problem) => ({ ok: true, truth, repaired, ...(problem ? { problem } : {}) });

/**
 * Checks a generated question and returns the truth the app will grade against.
 * Equation-style prompts are the ground truth: they are solved deterministically and a wrong model answer is
 * corrected ("repaired"). Word problems must be consistent with the model's own equation(s); no repair,
 * because the translation into an equation may itself be the mistake.
 * Returns { ok:false, problem } or { ok:true, truth, repaired, problem? }.
 */
export function checkQuestion(q, topicId = null, { requireInteger = false } = {}) {
  const t = topicId ? getTopic(topicId) : null;
  const kind = t?.kind || "word";
  if (!q.equation || !q.equation.includes("=")) return bad("missing equation");
  const shape = topicId ? topicShapeProblem(topicId, q) : null;
  if (shape) return bad(shape);
  const eqText = extractEquation(q.prompt);

  switch (kind) {
    case "equation": {
      // The prompt is the ground truth, so a missing model answer is repaired like a wrong one
      // (found in the Phase 6 full run: "Solve: 4x - 5 = 11" was rejected only because the answer field was empty).
      if (!eqText) return bad("prompt does not contain a solvable equation");
      const root = solveLinear(eqText);
      if (root === null) return bad(`prompt equation "${eqText}" is not a linear equation with one solution`);
      if (requireInteger && !isInt(root)) return bad(`solution of "${eqText}" is ${fmt(root)}, not a whole number (required at this level)`);
      if (!Number.isFinite(q.answer)) return good({ type: "number", value: root }, true, `model gave no answer for "${eqText}"; solved as ${fmt(root)}`);
      if (answersMatch(q.answer, root, 1e-3)) return good({ type: "number", value: q.answer });
      return good({ type: "number", value: root }, true, `model answer ${q.answer} is wrong for "${eqText}"; corrected to ${fmt(root)}`);
    }
    case "two-var-value": {
      if (!Number.isFinite(q.answer)) return bad("answer is not a finite number");
      const m = String(q.prompt).replace(/[−–]/g, "-").match(/^\s*(?:if|given)\s+(.+?),\s*find\s+y\s+when\s+x\s*=\s*(-?\d+(?:\.\d+)?)\s*\.?\s*$/i);
      if (!m) return bad('prompt must read "If <equation>, find y when x = <number>."');
      const y = solveForY(m[1], Number(m[2]));
      if (y === null) return bad(`"${m[1]}" is not a linear equation in x and y with a unique y`);
      if (requireInteger && !isInt(y)) return bad(`y = ${fmt(y)} is not a whole number (required at this level)`);
      if (answersMatch(q.answer, y, 1e-3)) return good({ type: "number", value: q.answer });
      return good({ type: "number", value: y }, true, `model answer ${q.answer} is wrong; y = ${fmt(y)}`);
    }
    case "two-var-any": {
      const m = String(q.prompt).replace(/[−–]/g, "-").match(/solution\s+of\s+(.+?)\s*\.?\s*$/i);
      if (!m) return bad('prompt must read "Write any one solution of <equation>."');
      const c = linearCoeffs2(m[1]);
      if (!c || Math.abs(c.p) < 1e-12 || Math.abs(c.q) < 1e-12) return bad(`"${m[1]}" is not a linear equation in both x and y`);
      return good({ type: "any-pair", equation: m[1] });
    }
    case "two-var-word": {
      if (!Number.isFinite(q.answer) || !Number.isFinite(q.given_x)) return bad("word problem needs given_x and a numeric answer");
      const y = solveForY(q.equation, q.given_x);
      if (y === null || !answersMatch(q.answer, y, 1e-3)) return bad(`answer ${q.answer} does not follow from ${q.equation} with x = ${q.given_x}`);
      return good({ type: "number", value: q.answer });
    }
    case "system": {
      if (!eqText && !/\band\b/i.test(q.prompt)) return bad('prompt must read "Solve: <equation 1> and <equation 2>"');
      const body = String(q.prompt).replace(/[−–]/g, "-").replace(/^\s*solve\s*:?\s*/i, "").replace(/[.\s]+$/, "");
      const eqs = body.split(/\s+and\s+|\s*;\s*|\s*,\s*(?=[^,]*=)/i).map((s) => s.trim()).filter(Boolean);
      if (eqs.length !== 2) return bad("prompt must contain exactly two equations joined by 'and'");
      const sol = solveSystem(eqs[0], eqs[1]);
      if (!sol) return bad(`the pair "${eqs[0]}" and "${eqs[1]}" has no unique solution`);
      if (requireInteger && !(isInt(sol.x) && isInt(sol.y))) return bad(`solution x = ${fmt(sol.x)}, y = ${fmt(sol.y)} is not whole numbers (required at this level)`);
      if (Number.isFinite(q.answer_x) && Number.isFinite(q.answer_y) && answersMatch(q.answer_x, sol.x, 1e-3) && answersMatch(q.answer_y, sol.y, 1e-3)) return good({ type: "pair", x: q.answer_x, y: q.answer_y });
      return good({ type: "pair", x: sol.x, y: sol.y }, true, `model answer (${q.answer_x}, ${q.answer_y}) is wrong; solution is x = ${fmt(sol.x)}, y = ${fmt(sol.y)}`);
    }
    case "system-word": {
      if (!q.equation2 || !Number.isFinite(q.answer_x) || !Number.isFinite(q.answer_y)) return bad("word problem needs equation2, answer_x and answer_y");
      const sol = solveSystem(q.equation, q.equation2);
      if (!sol || !answersMatch(q.answer_x, sol.x, 1e-3) || !answersMatch(q.answer_y, sol.y, 1e-3)) return bad(`answers (${q.answer_x}, ${q.answer_y}) do not solve ${q.equation} and ${q.equation2}`);
      return good({ type: "pair", x: q.answer_x, y: q.answer_y });
    }
    case "quadratic": {
      if (!eqText) return bad('prompt must read "Solve: <quadratic> = 0"');
      const roots = solveQuadratic(eqText);
      if (!roots) return bad(`"${eqText}" is not a quadratic equation with real roots`);
      if (Math.abs(roots[0] - roots[1]) < 1e-9) return bad("quadratic must have two distinct roots");
      if (requireInteger && !roots.every(isInt)) return bad(`roots ${roots.map(fmt).join(", ")} are not whole numbers (required at this level)`);
      const given = Array.isArray(q.roots) ? [...q.roots].filter(Number.isFinite).sort((a, b) => a - b) : [];
      if (given.length === 2 && answersMatch(given[0], roots[0], 1e-3) && answersMatch(given[1], roots[1], 1e-3)) return good({ type: "roots", roots: given });
      return good({ type: "roots", roots }, true, `model roots [${given.join(", ")}] are wrong for "${eqText}"; roots are ${roots.map(fmt).join(" and ")}`);
    }
    case "quadratic-word": {
      if (!Number.isFinite(q.answer)) return bad("answer is not a finite number");
      const roots = solveQuadratic(q.equation);
      if (!roots) return bad(`${q.equation} is not a quadratic equation with real roots`);
      if (!roots.some((r) => answersMatch(q.answer, r, 1e-3))) return bad(`answer ${q.answer} is not a root of ${q.equation}`);
      return good({ type: "number", value: q.answer });
    }
    default: { // "word": the model's equation must hold at its answer
      if (!Number.isFinite(q.answer)) return bad("answer is not a finite number");
      try {
        if (!equationHolds(q.equation, q.answer, 1e-3)) return bad(`answer ${q.answer} does not satisfy ${q.equation}`);
      } catch (e) {
        if (e instanceof ExprError) return bad(`equation not parseable: ${e.message}`);
        throw e;
      }
      return good({ type: "number", value: q.answer });
    }
  }
}

/** Reason string if the generated question is unusable (after repair), otherwise null. */
export function questionProblem(q, topicId = null, opts) {
  const r = checkQuestion(q, topicId, opts);
  return r.ok ? null : r.problem;
}

/** Human-readable form of a truth value, e.g. "x = 5", "x = 3, y = 2", "x = 2 or x = 3". */
export function formatTruth(truth) {
  const f = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000));
  switch (truth.type) {
    case "number": return `x = ${f(truth.value)}`;
    case "pair": return `x = ${f(truth.x)}, y = ${f(truth.y)}`;
    case "roots": return truth.roots.map((r) => `x = ${f(r)}`).join(" or ");
    case "any-pair": return `any pair (x, y) satisfying ${truth.equation}`;
    default: return "";
  }
}

// ---------- instruction-override guard (defence in depth for prompt injection) ----------

const OVERRIDE_PATTERNS = [
  /\b(ignore|disregard|forget)\b[^.?!]{0,40}\b(previous|prior|above|earlier|all|your)\b[^.?!]{0,20}\b(instructions?|rules?|prompts?|guidelines?)\b/,
  /\byou are now\b/,
  /\bfrom now on,? (you are|you're|act|behave)\b/,
  /\b(pretend|imagine) (to be|you are|you're) (a|an|the)\b(?! (maths?|math|algebra) (tutor|teacher))/,
  /\b(role-?play|act) as (a|an|the|my) (?!(maths?|math|algebra) (tutor|teacher))/,
  /\bsystem (override|prompt|message)\b/,
  /\b(reveal|show|print|repeat) (me )?(your|the) (system )?(prompt|instructions|rules)\b/,
  /\bwhat (are|were) your (instructions|rules)\b/,
  /\b(jailbreak|dan mode|developer mode|unfiltered mode)\b/,
];

/** True for messages that blatantly try to override the tutor's role or rules. */
export function looksLikeOverride(text) {
  const t = String(text).toLowerCase().replace(/\s+/g, " ");
  return OVERRIDE_PATTERNS.some((re) => re.test(t));
}
