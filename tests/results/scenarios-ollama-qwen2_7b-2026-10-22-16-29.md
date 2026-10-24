# Scenario test run

- Provider: **ollama** · model: **qwen2:7b** · prompt version: **2.2** · app version: **0.3.0**
- Date: 2026-10-22T16:29:27.139Z
- Result: **2 pass / 1 fail / 0 review** of 3
- Total time: 484 s

| # | Category | User action | Expected result | Actual result (summary) | Status |
|---|---|---|---|---|---|
| S25 | Summary with reason and adaptation | stats: two-step 1/4 and one-step 1/3 saved; session two-step 1/2 | Next = One-step (weak prerequisite), adaptation 'prerequisite', reason quotes 1 of 4; today's counts 2/1; message names the plan without contradicting it | next=one-step adaptation=prerequisite today=2/1 reason: You got 1 of 4 right first time on Two-step equations, and One-step equations, which … | PASS |
| S26 | Mixed revision quiz generation | generate 4 questions over one-step + fractions + system-solve (beginner) | Questions from every topic that produced a usable one, each passing its own topic's check and graded against it | threw: fetch failed | FAIL |
| S19 | Session summary | stats: one-step 4/4, fractions 3/1, mistakes listed | Needs-practice = fractions; next lesson = fractions; message + tips present | { "status": 200, "attempted": 7, "correct": 5, "strengths": [ "One-step equations" ], "needsPractice": [ "Equations with fractions" ], "next … | PASS |

## Details

### S25 — Summary with reason and adaptation (PASS, 74.4 s)

**Action:** stats: two-step 1/4 and one-step 1/3 saved; session two-step 1/2

**Expected:** Next = One-step (weak prerequisite), adaptation 'prerequisite', reason quotes 1 of 4; today's counts 2/1; message names the plan without contradicting it


```
next=one-step adaptation=prerequisite today=2/1
reason: You got 1 of 4 right first time on Two-step equations, and One-step equations, which it builds on, is not secure yet (1 of 3), so review One-step equations first.
message: Asha, today's session focused on two-step equations. You managed to solve 2 out of 4 correctly. It's clear that you're still getting the hang of these, particularly when dealing with equations that require two steps to solve. Your strong areas are yet to be identified, but your performance on two-step equations suggests that you might benefit from a review of one-step equations first. The app recommends this because you've only managed to correctly solve one out of three one-step equations, which is a prerequisite for mastering two-step equations. Your mistake in solving '2x + 5 = 17' was writing 'x = 11' instead of 'x = 6'. Remember, when solving for 'x', you need to isolate 'x' on one side of the equation. Practice isolating 'x' in one-step equations before moving on to two-step equations. This will help solidify your understanding and improve your skills.
tips: ["Start with one-step equations. Focus on isolating 'x' by performing the same operation on both sides of the equation.","Practice regularly. The more you practice, the better you'll get at solving equations.","Check your work. Always double-check your solutions by substituting 'x' back into the original equation to ensure it holds true."]
```

### S26 — Mixed revision quiz generation (FAIL, 304.3 s)

**Action:** generate 4 questions over one-step + fractions + system-solve (beginner)

**Expected:** Questions from every topic that produced a usable one, each passing its own topic's check and graded against it


```
threw: fetch failed
```

### S19 — Session summary (PASS, 105.6 s)

**Action:** stats: one-step 4/4, fractions 3/1, mistakes listed

**Expected:** Needs-practice = fractions; next lesson = fractions; message + tips present


```
{
 "status": 200,
 "attempted": 7,
 "correct": 5,
 "strengths": [
  "One-step equations"
 ],
 "needsPractice": [
  "Equations with fractions"
 ],
 "nextTopicId": "fractions",
 "nextLesson": "Equations with fractions",
 "reason": "You got 1 of 3 right first time on Equations with fractions, so practise it with easier questions; if they still feel hard, review Two-step equations first.",
 "adaptation": "ease",
 "difficultyBias": "easier",
 "insufficientData": [],
 "message": "Asha, you've done well with one-step equations and are making progress with equations involving fractions. It seems you might have overlooked the importance of finding a common denominator when solving equations with fractions. For 'x/3 + 2 = 5', you need to isolate x by first subtracting 2 from both sides, then multiplying by 3. This gives you x = 9. Remember, when dealing with fractions, it's crucial to perform the same operation on both sides of the equation to maintain balance. Practicing with easier questions on equations with fractions will help you build confidence and improve your skills. If you find these still challenging, reviewing two-step equations could be beneficial as it will reinforce your understanding of solving equations with multiple operations. Keep practicing and don't hesitate to ask if you need further explanations or examples. You're making great strides in algebra, Asha! Keep up the good work.",
 "tips": [
  "Always check your work by substituting the solution back into the original equation.",
  "When solving equations with fractions, find a common denominator if necessary to simplify the process.",
  "Remember to perform operations on both sides of the equation to maintain equality."
 ],
 "model": "qwen2:7b"
}
```
