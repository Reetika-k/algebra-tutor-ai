// Deterministic mistake diagnosis. Given the stored truth and the question, it recomputes the answer each common
// mistake would produce and compares the student's value with those candidates.
// It returns a pattern code, a label, a confidence tier and a general explanation — never a value — so the model
// only phrases a diagnosis the app has evidence for. Rules (docs/ENHANCEMENT_PLAN.md, Phase 3):
//   - a pattern is "likely" only when the student's value matches candidates of exactly one pattern,
//     and that candidate is not itself the true answer;
//   - two patterns matching, or none, gives "unknown" (the tutor asks for the steps);
//   - an arithmetic slip is never more than "possible"; word problems are capped at "possible",
//     because the mistake may be in forming the equation rather than in solving it.

import { evaluate, ExprError } from "./expr.js";
import { extractEquation, solveLinear, answersMatch } from "./validate.js";
import { getTopic } from "./topics.js";

const TEXT = {
  sign_transpose: ["A sign was not changed when a term moved across =", "When a term moves to the other side of the equals sign, its sign changes: plus becomes minus and minus becomes plus."],
  forgot_divide: ["Stopped before undoing the number with x", "After collecting the x terms and the numbers, the last step is to undo the number that multiplies or divides x."],
  multiplied_instead: ["Used the opposite operation on the number with x", "To undo multiplication by a number, divide both sides by it; to undo division, multiply. Doing the same operation again moves further from x."],
  lost_sign: ["Right size, wrong sign", "The size of the answer looks right but its sign does not; check each step where a negative number appears."],
  bracket_partial: ["Bracket not fully expanded", "The number outside a bracket multiplies every term inside it, not only the first one."],
  fraction_partial: ["Not every term was multiplied when clearing the fraction", "To clear a fraction, multiply every term on both sides of the equation by the same number."],
  arithmetic_slip: ["Possible arithmetic slip", "The method may be right and the answer is close, so recheck each addition, subtraction, multiplication and division."],
  swapped: ["x and y swapped", "Both values are right but in each other's places; check which value belongs to x and which to y."],
  sign_of_roots: ["Signs of the roots flipped", "From a factor such as (x - a), the root is x = a, not x = -a: set each factor equal to zero and solve it."],
  one_root_only: ["Only one root given", "A quadratic equation usually has two roots; set each factor equal to zero to find both."],
  unknown: ["Mistake not identified", "The answer does not match a common mistake, so the tutor needs to see the steps to find where it went wrong."],
};

export const PATTERN_CODES = Object.keys(TEXT);

const SLIP_DISTANCE = 2;

function result(code, confidence) {
  const [label, explanation] = TEXT[code];
  return { code, label, confidence, explanation };
}

/** Linear coefficients of each side: lhs = aL·x + bL, rhs = aR·x + bR (null if either side is not linear in x). */
export function sideCoeffs(equation) {
  const parts = String(equation).split("=");
  if (parts.length !== 2) return null;
  const lin = (side) => {
    const v0 = evaluate(side, 0), v1 = evaluate(side, 1), v2 = evaluate(side, 2);
    const a = v1 - v0;
    if (Math.abs(v2 - v1 - a) > 1e-9 * Math.max(1, Math.abs(a))) return null;
    return { a, b: v0 };
  };
  try {
    const L = lin(parts[0]), R = lin(parts[1]);
    if (!L || !R || Math.abs(L.a - R.a) < 1e-12) return null;
    return { aL: L.a, bL: L.b, aR: R.a, bR: R.b, lhs: parts[0].trim(), rhs: parts[1].trim() };
  } catch (e) {
    if (e instanceof ExprError) return null;
    throw e;
  }
}

/** Split one side into top-level additive terms, each keeping its sign: "x/3 + 2 - 4x" → ["x/3", "+2", "-4x"]. */
export function splitTerms(side) {
  const s = String(side).replace(/\s+/g, "");
  const terms = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if ((c === "+" || c === "-") && depth === 0 && i > start && !"*/(".includes(s[i - 1])) {
      terms.push(s.slice(start, i));
      start = i;
    }
  }
  terms.push(s.slice(start));
  return terms.filter(Boolean);
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const denominatorOf = (term) => { const m = term.match(/\/\(?(\d+)\)?$/); return m ? Number(m[1]) : null; };

/** Answers produced by clearing fractions but leaving some terms unmultiplied, or by dropping the denominators. */
function fractionCandidates(lhs, rhs) {
  const sides = [splitTerms(lhs), splitTerms(rhs)];
  const dens = sides.flat().map(denominatorOf).filter(Boolean);
  if (!dens.length) return [];
  const D = dens.reduce((a, b) => (a * b) / gcd(a, b));
  const join = (terms) => terms.join("+").replace(/\+([+-])/g, "$1");
  const out = [];
  const all = sides.flat();
  for (const skip of all.filter((t) => denominatorOf(t) === null)) {
    const mul = (terms) => join(terms.map((t) => (t === skip ? t : `${D}*(${t})`)));
    out.push(solveLinear(`${mul(sides[0])}=${mul(sides[1])}`));
  }
  const drop = (terms) => join(terms.map((t) => t.replace(/\/\(?\d+\)?$/, "")));
  out.push(solveLinear(`${drop(sides[0])}=${drop(sides[1])}`));
  return out.filter((v) => v !== null);
}

/** Answers produced by multiplying only the first term inside a bracket, one bracket at a time and all at once. */
function bracketCandidates(equation) {
  const re = /(\d+(?:\.\d+)?)\s*\*?\s*\(([^()]+)\)/g;
  const partial = (k, inner) => {
    const [first, ...rest] = splitTerms(inner);
    return `(${k}*${first}${rest.join("")})`;
  };
  const matches = [...String(equation).matchAll(re)];
  if (!matches.length) return [];
  const out = [];
  for (const m of matches) {
    const eq = equation.slice(0, m.index) + partial(m[1], m[2]) + equation.slice(m.index + m[0].length);
    out.push(solveLinear(eq));
  }
  if (matches.length > 1) out.push(solveLinear(String(equation).replace(re, (_, k, inner) => partial(k, inner))));
  return out.filter((v) => v !== null);
}

/** Candidate answers per pattern for a linear equation in one variable. */
export function linearCandidates(equation, topicId) {
  const c = sideCoeffs(equation);
  if (!c) return [];
  const { aL, bL, aR, bR } = c;
  const a = aL - aR;
  const k = bR - bL;
  const truth = k / a;
  const out = [];
  const add = (code, v) => { if (Number.isFinite(v)) out.push({ code, value: Math.round(v * 1e9) / 1e9 }); };
  if (Math.abs(bL) > 1e-12) add("sign_transpose", (bR + bL) / a);                                   // constant moved, sign kept
  if (Math.abs(aR) > 1e-12 && Math.abs(aL + aR) > 1e-12) add("sign_transpose", k / (aL + aR));       // x term moved, sign kept
  if (Math.abs(Math.abs(a) - 1) > 1e-9) { add("forgot_divide", k); add("multiplied_instead", k * a); }
  if (Math.abs(truth) > 1e-12) add("lost_sign", -truth);
  if (topicId === "brackets") for (const v of bracketCandidates(equation)) add("bracket_partial", v);
  if (topicId === "fractions") for (const v of fractionCandidates(c.lhs, c.rhs)) add("fraction_partial", v);
  return out;
}

/** The equation a number answer is checked against: the prompt for equation topics, the machine equation for word problems. */
function linearEquationFor(q, topic) {
  if (topic?.kind === "equation") return extractEquation(q.prompt);
  if (topic?.kind === "word") return q.equation || null;
  return null;
}

/**
 * Diagnose a wrong answer. Returns null when there is nothing to diagnose (correct or unreadable answers),
 * otherwise { code, label, confidence: "likely" | "possible" | "unknown", explanation }.
 */
export function diagnose({ q, truth, verdict, parsed }) {
  if (verdict !== "incorrect" && verdict !== "partial") return null;
  const topic = getTopic(q.topic);

  if (truth.type === "number" && typeof parsed === "number") {
    const eq = linearEquationFor(q, topic);
    const candidates = eq ? linearCandidates(eq, q.topic).filter((cand) => !answersMatch(cand.value, truth.value)) : [];
    const codes = [...new Set(candidates.filter((cand) => answersMatch(parsed, cand.value)).map((cand) => cand.code))];
    const cap = topic?.kind === "word" ? "possible" : "likely";
    if (codes.length === 1) return result(codes[0], cap);
    if (codes.length > 1) return result("unknown", "unknown");
    if (Math.abs(parsed - truth.value) <= SLIP_DISTANCE) return result("arithmetic_slip", "possible");
    return result("unknown", "unknown");
  }

  if (truth.type === "pair" && parsed && typeof parsed.x === "number") {
    const distinct = !answersMatch(truth.x, truth.y);
    if (distinct && answersMatch(parsed.x, truth.y) && answersMatch(parsed.y, truth.x)) return result("swapped", "likely");
    return result("unknown", "unknown");
  }

  if (truth.type === "roots" && Array.isArray(parsed)) {
    const isRoot = (v) => truth.roots.some((r) => answersMatch(v, r));
    const isFlipped = (v) => truth.roots.some((r) => Math.abs(r) > 1e-12 && answersMatch(v, -r));
    if (parsed.some((v) => !isRoot(v) && isFlipped(v)) && parsed.every((v) => isRoot(v) || isFlipped(v))) return result("sign_of_roots", "likely");
    if (verdict === "partial" && parsed.length === 1) return result("one_root_only", "likely");
    return result("unknown", "unknown");
  }

  return result("unknown", "unknown");
}
