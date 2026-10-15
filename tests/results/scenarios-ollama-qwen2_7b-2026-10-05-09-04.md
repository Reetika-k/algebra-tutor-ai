# Scenario test run

- Provider: **ollama** · model: **qwen2:7b** · prompt version: **2.0** · app version: **0.3.0**
- Date: 2026-10-05T09:04:13.204Z
- Result: **0 pass / 3 fail / 0 review** of 3
- Total time: 2880 s

| # | Category | User action | Expected result | Actual result (summary) | Status |
|---|---|---|---|---|---|
| S20 | Class 10 quadratic (roots, partial credit) | quad-solve/intermediate: generate 1; answer with one root, then both | Usable question; one root → partial without revealing the other; both roots → correct | no question: {"status":503,"error":"Cannot reach Ollama at http://localhost:11434: The operation was aborted due to timeout","kind":"provide … | FAIL |
| S21 | Class 10 pair of equations (pair answer) | system-solve/beginner: generate 1; swapped pair, then correct pair | Whole-number solution; swapped values → incorrect, nothing revealed; correct pair → correct | no question: {"status":503,"error":"Cannot reach Ollama at http://localhost:11434: The operation was aborted due to timeout","kind":"provide … | FAIL |
| S22 | Class 9 any-solution and find-y | two-var-any/beginner: generate 1 and answer with a valid pair; two-var-value/beginner: generate 1 and answer correctly | Any satisfying pair is accepted; find-y graded against the exact value | no any-solution question: {"status":503,"error":"Cannot reach Ollama at http://localhost:11434: The operation was aborted due to timeout","k … | FAIL |

## Details

### S20 — Class 10 quadratic (roots, partial credit) (FAIL, 908.7 s)

**Action:** quad-solve/intermediate: generate 1; answer with one root, then both

**Expected:** Usable question; one root → partial without revealing the other; both roots → correct


```
no question: {"status":503,"error":"Cannot reach Ollama at http://localhost:11434: The operation was aborted due to timeout","kind":"provider"}
```

### S21 — Class 10 pair of equations (pair answer) (FAIL, 1048.3 s)

**Action:** system-solve/beginner: generate 1; swapped pair, then correct pair

**Expected:** Whole-number solution; swapped values → incorrect, nothing revealed; correct pair → correct


```
no question: {"status":503,"error":"Cannot reach Ollama at http://localhost:11434: The operation was aborted due to timeout","kind":"provider"}
```

### S22 — Class 9 any-solution and find-y (FAIL, 922.9 s)

**Action:** two-var-any/beginner: generate 1 and answer with a valid pair; two-var-value/beginner: generate 1 and answer correctly

**Expected:** Any satisfying pair is accepted; find-y graded against the exact value


```
no any-solution question: {"status":503,"error":"Cannot reach Ollama at http://localhost:11434: The operation was aborted due to timeout","kind":"provider"}
```
