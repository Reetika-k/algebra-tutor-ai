// Deterministic hint ladder. Level 1 names the idea of the first step; level 2 names the concrete next step
// with the numbers from the question, but never the result of doing it. Level 3 is the existing reveal.
// Used by the Hint button (no model call, so it is instant on the local model) and as the fallback
// when the model's hint leaks the answer or repeats an earlier hint.

import { getTopic } from "./topics.js";
import { extractEquation, linearCoeffs2 } from "./validate.js";
import { sideCoeffs, splitTerms } from "./diagnose.js";

export const MAX_HINT_LEVEL = 2;

const num = (v) => {
  const r = Math.round(v * 1e6) / 1e6;
  return Number.isInteger(r) ? String(r) : String(Math.round(v * 1000) / 1000);
};
const reciprocal = (a) => { const inv = 1 / a; return Math.abs(inv - Math.round(inv)) < 1e-9 && Math.abs(inv) > 1 ? Math.round(inv) : null; };
const xTerm = (a) => (a === 1 ? "x" : a === -1 ? "-x" : `${num(a)}x`);
const moveConstant = (b) => (b > 0 ? `Subtract ${num(b)} from both sides.` : `Add ${num(-b)} to both sides.`);
const moveXTerm = (a) => (a > 0 ? `Subtract ${xTerm(a)} from both sides, so the x terms are together.` : `Add ${xTerm(-a)} to both sides, so the x terms are together.`);
const undoCoefficient = (a) => {
  const k = reciprocal(a);
  if (k !== null) return k > 0 ? `Multiply both sides by ${k}.` : `Multiply both sides by ${k}, which also changes the sign.`;
  return `Divide both sides by ${num(a)}.`;
};

/** Ladder for a linear equation in one variable shown in the prompt. */
function linearHint(equation, topicId, level) {
  const c = sideCoeffs(equation);
  if (!c) return null;
  const terms = [...splitTerms(c.lhs), ...splitTerms(c.rhs)];
  const dens = terms.map((t) => t.match(/\/\(?(\d+)\)?$/)?.[1]).filter(Boolean).map(Number);
  const bracket = String(equation).match(/(\d+(?:\.\d+)?)\s*\*?\s*\(/);
  if (topicId === "fractions" && dens.length) {
    const g = (a, b) => (b ? g(b, a % b) : a);
    const D = dens.reduce((a, b) => (a * b) / g(a, b));
    return level === 1 ? "Clear the fraction first: what number can you multiply every term by so that the denominator disappears?"
      : `Multiply every term on both sides by ${D}, including the terms without a fraction.`;
  }
  if (topicId === "brackets" && bracket) {
    return level === 1 ? "Start with the bracket: the number outside multiplies every term inside it."
      : `Multiply ${bracket[1]} by each term inside the bracket, then simplify both sides.`;
  }
  // Put x on the left for the description; the step is the same either way.
  let { aL, bL, aR, bR } = c;
  if (Math.abs(aL) < 1e-12) [aL, bL, aR, bR] = [aR, bR, aL, bL];
  if (Math.abs(aR) > 1e-12) return level === 1 ? "x appears on both sides. Get all the x terms on one side of the equals sign first." : moveXTerm(aR);
  if (Math.abs(bL) > 1e-12) return level === 1 ? "Which number is added to or taken away from the x term? Undo that first, on both sides." : moveConstant(bL);
  return level === 1 ? "x is multiplied or divided by a number. Which opposite operation leaves x on its own?" : undoCoefficient(aL);
}

function systemHint(prompt, level) {
  if (level === 1) return "Choose one variable to remove: can you make its coefficients the same size in both equations?";
  const body = String(prompt).replace(/[−–]/g, "-").replace(/^\s*solve\s*:?\s*/i, "").replace(/[.\s]+$/, "");
  const eqs = body.split(/\s+and\s+|\s*;\s*|\s*,\s*(?=[^,]*=)/i).map((s) => s.trim()).filter(Boolean);
  const a = eqs.length === 2 ? linearCoeffs2(eqs[0]) : null;
  const b = eqs.length === 2 ? linearCoeffs2(eqs[1]) : null;
  if (!a || !b) return "Make the coefficients of x (or of y) equal in both equations, then add or subtract the equations.";
  for (const [v, p, q] of [["y", a.q, b.q], ["x", a.p, b.p]]) {
    if (Math.abs(p - q) < 1e-9) return `The ${v} terms match. Subtract the second equation from the first to remove ${v}.`;
    if (Math.abs(p + q) < 1e-9) return `The ${v} terms have opposite signs. Add the two equations to remove ${v}.`;
  }
  return `Multiply the first equation by ${num(Math.abs(b.p))} and the second by ${num(Math.abs(a.p))}, so the x terms match, then subtract.`;
}

function quadraticHint(prompt, level) {
  if (level === 1) return "Try factorising: look for two numbers that multiply to give the constant term (times the x² coefficient) and add to give the x coefficient.";
  const eq = extractEquation(prompt);
  const lhs = eq ? eq.split("=")[0].replace(/x²/g, "x^2") : null;
  try {
    const c = lhs ? linearCoeffs2(`${lhs.replace(/x\^2/g, "y")}=0`) : null; // treat x^2 as y: p·x + q·x² + r
    if (c && Math.abs(c.q) > 1e-12) return `Find two numbers whose product is ${num(c.q * c.r)} and whose sum is ${num(c.p)}, then split the middle term with them.`;
  } catch { /* fall through */ }
  return "Split the middle term using two numbers whose product is a × c and whose sum is b, then factorise.";
}

/**
 * Deterministic hint at the given level (1 or 2) for a stored question. Never states the answer.
 */
export function ladderHint(q, level) {
  const lv = Math.min(Math.max(level, 1), MAX_HINT_LEVEL);
  const topic = getTopic(q.topic);
  switch (topic?.kind) {
    case "equation": {
      const eq = extractEquation(q.prompt);
      return (eq && linearHint(eq, q.topic, lv)) || topic.method;
    }
    case "system":
      return systemHint(q.prompt, lv);
    case "quadratic":
      return quadraticHint(q.prompt, lv);
    case "two-var-value": {
      const given = String(q.prompt).match(/x\s*=\s*(-?\d+(?:\.\d+)?)\s*\.?\s*$/i)?.[1];
      return lv === 1 ? "You are told the value of x. Put it into the equation first, so only y is left."
        : `Replace x with ${given ?? "the given value"} in the equation, then solve the equation you get for y.`;
    }
    case "two-var-any":
      return lv === 1 ? "There are many correct answers. Choose any easy value for x, such as 0 or 1."
        : "Put x = 0 into the equation, solve for y, and write both values.";
    default: // word problems of every class
      return lv === 1 ? (q.hint || "Choose a letter for each unknown, then turn each fact in the story into an expression.")
        : topic?.method || "Form the equation from the story, then solve it step by step.";
  }
}

/**
 * Concrete steps in solving order, for the fallback when a hint would repeat. For linear equations shown in
 * the prompt: clear fractions or brackets, collect x terms, move the constant, undo the coefficient.
 */
export function ladderSteps(q) {
  const topic = getTopic(q.topic);
  const eq = topic?.kind === "equation" ? extractEquation(q.prompt) : null;
  const c = eq ? sideCoeffs(eq) : null;
  if (!c) return [ladderHint(q, MAX_HINT_LEVEL)].filter(Boolean);
  const first = linearHint(eq, q.topic, MAX_HINT_LEVEL);
  if ((q.topic === "fractions" || q.topic === "brackets") && first) return [first, "Then collect the x terms on one side and the numbers on the other, and simplify."];
  let { aL, bL, aR, bR } = c;
  if (Math.abs(aL) < 1e-12) [aL, bL, aR, bR] = [aR, bR, aL, bL];
  const steps = [];
  if (Math.abs(aR) > 1e-12) steps.push(moveXTerm(aR));
  if (Math.abs(bL) > 1e-12) steps.push(moveConstant(bL));
  const a = aL - aR;
  if (Math.abs(a - 1) > 1e-9) steps.push(steps.length ? `Then ${undoCoefficient(a).charAt(0).toLowerCase()}${undoCoefficient(a).slice(1)}` : undoCoefficient(a));
  return steps;
}

/**
 * True when two hints say essentially the same thing: identical after normalising, or one contains
 * at least 80 % of the other's words (a repeat padded with filler is still a repeat).
 */
export function sameHint(a, b) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const wa = new Set(na.split(" ")), wb = new Set(nb.split(" "));
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared / Math.min(wa.size, wb.size) >= 0.8;
}
