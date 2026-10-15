# Scenario test run

- Provider: **ollama** · model: **qwen2:7b** · prompt version: **2.0** · app version: **0.3.0**
- Date: 2026-10-06T01:24:27.222Z
- Result: **3 pass / 0 fail / 0 review** of 3
- Total time: 288 s

| # | Category | User action | Expected result | Actual result (summary) | Status |
|---|---|---|---|---|---|
| S20 | Class 10 quadratic (roots, partial credit) | quad-solve/intermediate: generate 1; answer with one root, then both | Usable question; one root → partial without revealing the other; both roots → correct | Solve: x² - 3x - 10 = 0 [roots -2, 5] one root → partial, leak=false: You've found one of the roots correctly, which is x = -2. Remember, a  … | PASS |
| S21 | Class 10 pair of equations (pair answer) | system-solve/beginner: generate 1; swapped pair, then correct pair | Whole-number solution; swapped values → incorrect, nothing revealed; correct pair → correct | Solve: 2x + 3y = 12 and x - y = 1 [x = 3, y = 2, repaired] swapped → incorrect; correct → correct | PASS |
| S22 | Class 9 any-solution and find-y | two-var-any/beginner: generate 1 and answer with a valid pair; two-var-value/beginner: generate 1 and answer correctly | Any satisfying pair is accepted; find-y graded against the exact value | Write any one solution of 2x + 3y = 12. → (1, 3.3333333333333335) correct If 4x + 2y = 16, find y when x = 2. → correct | PASS |

## Details

### S20 — Class 10 quadratic (roots, partial credit) (PASS, 76.4 s)

**Action:** quad-solve/intermediate: generate 1; answer with one root, then both

**Expected:** Usable question; one root → partial without revealing the other; both roots → correct


```
Solve: x² - 3x - 10 = 0 [roots -2, 5]
one root → partial, leak=false: You've found one of the roots correctly, which is x = -2. Remember, a quadratic equation like this one has two roots. You've missed the second root. Think about how you can find the other solution by splitting the middle term or using the quadratic formula. Try to find the value of x that makes the equation true when substituted for x.
both → correct
```

### S21 — Class 10 pair of equations (pair answer) (PASS, 85.7 s)

**Action:** system-solve/beginner: generate 1; swapped pair, then correct pair

**Expected:** Whole-number solution; swapped values → incorrect, nothing revealed; correct pair → correct


```
Solve: 2x + 3y = 12 and x - y = 1 [x = 3, y = 2, repaired]
swapped → incorrect; correct → correct
```

### S22 — Class 9 any-solution and find-y (PASS, 126.4 s)

**Action:** two-var-any/beginner: generate 1 and answer with a valid pair; two-var-value/beginner: generate 1 and answer correctly

**Expected:** Any satisfying pair is accepted; find-y graded against the exact value


```
Write any one solution of 2x + 3y = 12. → (1, 3.3333333333333335) correct
If 4x + 2y = 16, find y when x = 2. → correct
```
