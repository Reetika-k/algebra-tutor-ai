// Verified step generator for linear equations in one variable (docs/ENHANCEMENT_PLAN.md, Phase 5).
// It writes the school-style transformations (expand, clear fractions, collect x, move the constant, divide)
// and checks every line: each one is re-solved and must have the same root as the original equation, and the
// last line must read "x = root". If any check fails, or the form is not supported, it returns null — the app
// never shows a step it has not verified. The model is not involved.

import { solveLinear, extractEquation } from "./validate.js";
import { sideCoeffs, splitTerms } from "./diagnose.js";
import { evaluate } from "./expr.js";
import { getTopic, TOPICS } from "./topics.js";

const EPS = 1e-9;
const near = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

/** Exact-looking number: integers as is, simple fractions as p/q (q ≤ 12), otherwise a 3-decimal value. */
export function fmtNum(v) {
  if (near(v, Math.round(v))) return String(Math.round(v));
  for (let q = 2; q <= 12; q++) {
    const p = v * q;
    if (near(p, Math.round(p))) return `${Math.round(p)}/${q}`;
  }
  return String(Math.round(v * 1000) / 1000);
}

/** The x term for a coefficient: x, -x, 3x, x/3, 2x/3. */
function xTerm(a) {
  if (near(a, 1)) return "x";
  if (near(a, -1)) return "-x";
  const s = fmtNum(a);
  if (!s.includes("/")) return `${s}x`;
  const [p, q] = s.split("/");
  return p === "1" ? `x/${q}` : p === "-1" ? `-x/${q}` : `${p}x/${q}`;
}

/** a·x + b as school text: "3x + 5", "-x - 2", "7", "0". */
export function fmtSide(a, b) {
  const hasX = Math.abs(a) > EPS, hasB = Math.abs(b) > EPS;
  if (!hasX) return fmtNum(hasB ? b : 0);
  const t = xTerm(a);
  if (!hasB) return t;
  return `${t} ${b < 0 ? "-" : "+"} ${fmtNum(Math.abs(b))}`;
}

const line = (aL, bL, aR, bR) => `${fmtSide(aL, bL)} = ${fmtSide(aR, bR)}`;
const lcm = (a, b) => { const g = (x, y) => (y ? g(y, x % y) : x); return (a * b) / g(a, b); };

const WHY = {
  expand: "The number outside a bracket multiplies every term inside it, so each side keeps its value.",
  clear: "Multiplying both sides by the same number keeps them equal, and it removes the fractions.",
  collect: "Doing the same thing to both sides keeps the scale balanced; now the x terms are on one side.",
  constant: "Doing the same thing to both sides keeps the scale balanced; now the x term is on its own.",
  coefficient: "Dividing or multiplying both sides by the same non-zero number keeps them equal and leaves x alone.",
  swap: "An equation reads the same both ways, so the two sides can change places.",
};

/**
 * Steps for a linear equation in x written in school form (e.g. "2x + 4 = 12", "3(x - 4) = 2(x + 1)").
 * Returns { equation, root, steps: [{ line, op, amount, label, why }] } with steps[0] the original equation,
 * or null when the form is unsupported or any line fails verification.
 */
export function linearSteps(equation, topicId = null) {
  const eq = String(equation || "").replace(/[−–]/g, "-").trim();
  const root = solveLinear(eq);
  const c = sideCoeffs(eq);
  if (root === null || !c) return null;
  let { aL, bL, aR, bR } = c;
  const steps = [{ line: eq.replace(/\s*=\s*/, " = "), op: "start", amount: null, label: "The equation", why: "This is where we start. Both sides are equal, like a balanced scale." }];
  const push = (op, amount, label, why) => steps.push({ line: line(aL, bL, aR, bR), op, amount, label, why });

  // Fractions: multiply every term by the LCM of the denominators.
  const dens = [...splitTerms(c.lhs), ...splitTerms(c.rhs)].map((t) => t.match(/\/\(?(\d+)\)?$/)?.[1]).filter(Boolean).map(Number);
  if (dens.length) {
    const D = dens.reduce(lcm);
    // Show every term multiplied out ("3x + 2x = 60") before like terms are collected.
    const termText = (t) => { const b = evaluate(t, 0) * D, a = evaluate(t, 1) * D - b; return { a, b }; };
    const sideText = (side) => {
      const ts = splitTerms(side).map(termText);
      // A term like (2x + 1)/3 becomes 2x + 1: it contributes both an x part and a number part.
      const parts = ts.flatMap(({ a, b }) => [...(Math.abs(a) > EPS ? [{ v: xTerm(Math.abs(a)), neg: a < 0, x: true }] : []), ...(Math.abs(b) > EPS ? [{ v: fmtNum(Math.abs(b)), neg: b < 0, x: false }] : [])]);
      const text = parts.length ? parts.map((t, i) => (i === 0 ? (t.neg ? "-" : "") + t.v : ` ${t.neg ? "-" : "+"} ${t.v}`)).join("") : "0";
      return { text, xs: parts.filter((t) => t.x).length, ks: parts.filter((t) => !t.x).length };
    };
    const L = sideText(c.lhs), R = sideText(c.rhs);
    aL *= D; bL *= D; aR *= D; bR *= D;
    steps.push({ line: `${L.text} = ${R.text}`, op: "multiply", amount: fmtNum(D), label: `Multiply both sides by ${D}`, why: WHY.clear });
    if (L.xs > 1 || L.ks > 1 || R.xs > 1 || R.ks > 1) push("collect", null, "Collect like terms", "Adding the like terms on each side changes how the side is written, not its value.");
  } else if (/\d\s*\*?\s*\(/.test(eq)) {
    push("expand", null, "Expand the brackets", WHY.expand);
  }

  // x only on the right: swap the sides so x is on the left.
  if (Math.abs(aL) < EPS) {
    [aL, bL, aR, bR] = [aR, bR, aL, bL];
    push("swap", null, "Swap the two sides", WHY.swap);
  }
  // x on both sides with more x on the right: take the smaller (left) x term away, then swap the sides,
  // so the x coefficient stays positive, as it would in a school solution.
  if (Math.abs(aR) > EPS && aL > 0 && aR > aL) {
    const amount = xTerm(aL);
    aR -= aL; aL = 0;
    push("subtract", amount, `Subtract ${amount} from both sides`, WHY.collect);
    [aL, bL, aR, bR] = [aR, bR, aL, bL];
    push("swap", null, "Swap the two sides", WHY.swap);
  }
  // x on both sides: take the right-hand x term away from both sides.
  if (Math.abs(aR) > EPS) {
    const amount = xTerm(Math.abs(aR));
    const op = aR > 0 ? "subtract" : "add";
    const label = aR > 0 ? `Subtract ${amount} from both sides` : `Add ${amount} to both sides`;
    aL -= aR; aR = 0;
    if (Math.abs(aL) < EPS) return null; // no unique solution
    push(op, amount, label, WHY.collect);
  }
  // Constant next to the x term: move it across.
  if (Math.abs(bL) > EPS) {
    const amount = fmtNum(Math.abs(bL));
    const op = bL > 0 ? "subtract" : "add";
    const label = bL > 0 ? `Subtract ${amount} from both sides` : `Add ${amount} to both sides`;
    bR -= bL; bL = 0;
    push(op, amount, label, WHY.constant);
  }
  // Coefficient of x: divide (or multiply by the denominator for x/k).
  if (!near(aL, 1)) {
    const inv = 1 / aL;
    let op, amount, label;
    if (near(inv, Math.round(inv)) && Math.abs(Math.round(inv)) > 1) {
      op = "multiply"; amount = fmtNum(Math.round(inv)); label = `Multiply both sides by ${amount}`;
    } else if (near(aL, -1)) {
      op = "multiply"; amount = "-1"; label = "Multiply both sides by -1";
    } else {
      op = "divide"; amount = fmtNum(aL); label = `Divide both sides by ${amount}`;
    }
    bR /= aL; aL = 1;
    push(op, amount, label, WHY.coefficient);
  }

  // Verification: every line has the same root, and the last line states it.
  for (const s of steps) {
    const r = solveLinear(s.line);
    if (r === null || !near(r, root)) return null;
  }
  const last = steps[steps.length - 1].line;
  if (!/^x = /.test(last) || !near(solveLinear(last), root)) return null;
  if (steps.length < 2) return null;
  return { equation: steps[0].line, root, steps, topic: topicId };
}

/** Steps for a stored question, only for topics whose prompt shows the equation (Class 8 equation topics). */
export function stepsForQuestion(q) {
  if (getTopic(q.topic)?.kind !== "equation") return null;
  const eq = extractEquation(q.prompt);
  return eq ? linearSteps(eq, q.topic) : null;
}

/** Worked examples for Learn: the topic's own example equations (never a student-typed one). */
export function exampleEquations(topicId) {
  const t = getTopic(topicId);
  if (t?.kind !== "equation") return [];
  return t.forms.split(/,\s*(?![^()]*\))/).map((s) => s.trim()).filter((s) => s.includes("=") && linearSteps(s, topicId));
}

export const STEP_TOPICS = TOPICS.filter((t) => t.kind === "equation").map((t) => t.id);
