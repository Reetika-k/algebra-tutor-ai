// Tiny, safe arithmetic evaluator (no eval()). Supports numbers, the variables x and y, + - * / ^ ( ),
// unary minus, unicode operators (× ÷ − ² ³) and implicit multiplication (2x, 3(x+1), xy, 2x²).
// Used to verify generated questions by substituting answers back, and to solve them deterministically.

export class ExprError extends Error {}

function tokenize(src) {
  const s = String(src)
    .replace(/×/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-")
    .replace(/²/g, "^2").replace(/³/g, "^3")
    .replace(/\s+/g, "");
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const num = Number(s.slice(i, j));
      if (!Number.isFinite(num)) throw new ExprError(`Bad number near "${s.slice(i, j)}"`);
      tokens.push({ t: "num", v: num });
      i = j;
    } else if (c === "x" || c === "X") { tokens.push({ t: "x" }); i++; }
    else if (c === "y" || c === "Y") { tokens.push({ t: "y" }); i++; }
    else if ("+-*/()^".includes(c)) { tokens.push({ t: c }); i++; }
    else throw new ExprError(`Unexpected character "${c}"`);
  }
  return tokens;
}

// expr := term (('+'|'-') term)* ; term := unary (('*'|'/'|implicit) unary)* ;
// unary := ('-'|'+') unary | power ; power := atom ('^' unary)? ; atom := num | x | y | '(' expr ')'
function parse(tokens, x, y) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function atom() {
    const tok = next();
    if (!tok) throw new ExprError("Unexpected end of expression");
    if (tok.t === "num") return tok.v;
    if (tok.t === "x") return x;
    if (tok.t === "y") return y;
    if (tok.t === "(") {
      const v = expr();
      const close = next();
      if (!close || close.t !== ")") throw new ExprError("Missing closing bracket");
      return v;
    }
    throw new ExprError(`Unexpected token "${tok.t}"`);
  }
  function power() {
    const base = atom();
    if (peek()?.t === "^") { next(); const e = unary(); return Math.pow(base, e); }
    return base;
  }
  function unary() {
    if (peek()?.t === "-") { next(); return -unary(); }
    if (peek()?.t === "+") { next(); return unary(); }
    return power();
  }
  function term() {
    let v = unary();
    for (;;) {
      const p = peek();
      if (!p) break;
      if (p.t === "*") { next(); v *= unary(); }
      else if (p.t === "/") { next(); const d = unary(); if (d === 0) throw new ExprError("Division by zero"); v /= d; }
      else if (p.t === "x" || p.t === "y" || p.t === "(" || p.t === "num") { v *= unary(); } // implicit multiplication
      else break;
    }
    return v;
  }
  function expr() {
    let v = term();
    for (;;) {
      const p = peek();
      if (p?.t === "+") { next(); v += term(); }
      else if (p?.t === "-") { next(); v -= term(); }
      else break;
    }
    return v;
  }
  const v = expr();
  if (pos !== tokens.length) throw new ExprError("Unexpected trailing input");
  return v;
}

/** Evaluate an arithmetic expression in x (and y). Throws ExprError on bad input. */
export function evaluate(expression, x = 0, y = 0) {
  return parse(tokenize(expression), x, y);
}

/** Does substituting the value(s) make the equation "lhs = rhs" true? */
export function equationHolds(equation, x, tolerance = 1e-6, y = 0) {
  const parts = String(equation).split("=");
  if (parts.length !== 2) throw new ExprError("Equation must contain exactly one '='");
  const l = evaluate(parts[0], x, y);
  const r = evaluate(parts[1], x, y);
  const scale = Math.max(1, Math.abs(l), Math.abs(r));
  return Math.abs(l - r) / scale < tolerance;
}
