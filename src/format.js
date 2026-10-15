// Output normalisation. Prompt rules ask for plain-text maths, but models (especially small ones)
// still emit LaTeX. Rather than trust the prompt, convert the common notations to plain text.

const wrap = (t) => { t = t.trim(); return /^[\w.]+$/.test(t) ? t : `(${t})`; };

export function plainMath(text) {
  if (!text) return text;
  let s = String(text);
  s = s.replace(/\\\[|\\\]|\\\(|\\\)/g, "");                       // \[ \] \( \)
  s = s.replace(/\$\$([^$]+)\$\$/g, "$1").replace(/\$([^$\n]+)\$/g, "$1"); // $$…$$ and $…$
  for (let i = 0; i < 5 && /\\[dt]?frac\{/.test(s); i++) {
    s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a, b) => `${wrap(a)}/${wrap(b)}`);
  }
  s = s.replace(/\\times/g, "×").replace(/\\cdot/g, "×").replace(/\\div/g, "÷").replace(/\\pm/g, "±");
  s = s.replace(/\\(?:left|right)/g, "");
  s = s.replace(/\\(?:text|mathrm|textbf|mathbf)\{([^}]*)\}/g, "$1");
  s = s.replace(/\\(?:,|;|!|quad|qquad)/g, " ");
  s = s.replace(/\\\\/g, "\n");
  s = s.replace(/\^\{([^}]*)\}/g, "^$1");
  s = s.replace(/\\(?:begin|end)\{[^}]*\}/g, "");
  s = s.replace(/\{([^{}]*)\}/g, "$1");
  return s.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

export const hasLatex = (t) => /\\[\[\]()]|\\[dt]?frac|\$/.test(String(t ?? ""));
