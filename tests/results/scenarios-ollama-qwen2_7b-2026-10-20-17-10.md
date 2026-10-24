# Scenario test run

- Provider: **ollama** · model: **qwen2:7b** · prompt version: **2.1** · app version: **0.3.0**
- Date: 2026-10-20T17:10:44.900Z
- Result: **2 pass / 0 fail / 0 review** of 2
- Total time: 165 s

| # | Category | User action | Expected result | Actual result (summary) | Status |
|---|---|---|---|---|---|
| S23 | Mistake diagnosis (deterministic) + no leak | two-step/beginner: generate 1; answer with the value a known mistake produces (sign kept when moving the constant, or the first unambiguous pattern) | Diagnosis names that pattern as likely; feedback and hint do not state the answer; nothing revealed | Solve: 4x + 3 = 19 [x = 4] answered x = 5.5 (sign_transpose) diagnosis={"code":"sign_transpose","label":"A sign was not changed when a term  … | PASS |
| S24 | Hint ladder: two different hints | two-step/beginner: generate 1; two wrong answers far from any pattern, sending the first hint back as previousHints | Hint level 1 then 2; second hint is not a repeat of the first; nothing revealed | Solve: 4x + 3 = 19 hint 1 (level 1): Which number is added to or taken away from the x term? Undo that first, on both sides. hint 2 (level 2 … | PASS |

## Details

### S23 — Mistake diagnosis (deterministic) + no leak (PASS, 81.4 s)

**Action:** two-step/beginner: generate 1; answer with the value a known mistake produces (sign kept when moving the constant, or the first unambiguous pattern)

**Expected:** Diagnosis names that pattern as likely; feedback and hint do not state the answer; nothing revealed


```
Solve: 4x + 3 = 19 [x = 4] answered x = 5.5 (sign_transpose)
diagnosis={"code":"sign_transpose","label":"A sign was not changed when a term moved across =","confidence":"likely","explanation":"When a term moves to the other side of the equals sign, its sign changes: plus becomes minus and minus becomes plus."} leak=false
feedback: It looks like you might have forgotten to change the sign when moving the constant to the other side of the equation. When you move a term across the equals sign, its sign should change. Let's correct this step by step. First, you need to subtract 3 from both sides of the equation to isolate the term with the variable. Try this again, focusing on that step.
hint: Which number is added to or taken away from the x term? Undo that first, on both sides.
```

### S24 — Hint ladder: two different hints (PASS, 84.0 s)

**Action:** two-step/beginner: generate 1; two wrong answers far from any pattern, sending the first hint back as previousHints

**Expected:** Hint level 1 then 2; second hint is not a repeat of the first; nothing revealed


```
Solve: 4x + 3 = 19
hint 1 (level 1): Which number is added to or taken away from the x term? Undo that first, on both sides.
hint 2 (level 2): Subtract 3 from both sides of the equation: 4x + 3 - 3 = 19 - 3. This will help you isolate the x term.
```
