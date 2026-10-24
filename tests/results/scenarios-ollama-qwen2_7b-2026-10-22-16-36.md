# Scenario test run

- Provider: **ollama** · model: **qwen2:7b** · prompt version: **2.2** · app version: **0.3.0**
- Date: 2026-10-22T16:36:32.845Z
- Result: **1 pass / 0 fail / 0 review** of 1
- Total time: 233 s

| # | Category | User action | Expected result | Actual result (summary) | Status |
|---|---|---|---|---|---|
| S26 | Mixed revision quiz generation | generate 4 questions over one-step + fractions + system-solve (beginner) | Questions from every topic that produced a usable one, each passing its own topic's check and graded against it | 4 questions over 3 topics (rejected 0) one-step: Solve: x + 7 = 12 → correct fractions: Solve: x/2 + 1 = 3 → correct system-solve: Solve: 2x … | PASS |

## Details

### S26 — Mixed revision quiz generation (PASS, 232.9 s)

**Action:** generate 4 questions over one-step + fractions + system-solve (beginner)

**Expected:** Questions from every topic that produced a usable one, each passing its own topic's check and graded against it


```
4 questions over 3 topics (rejected 0)
one-step: Solve: x + 7 = 12 → correct
fractions: Solve: x/2 + 1 = 3 → correct
system-solve: Solve: 2x + 3y = 12 and x - y = 1 → correct
one-step: Solve: x - 4 = 9 → correct
```
