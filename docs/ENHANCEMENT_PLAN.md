# AlgebraTutor AI — Enhancement audit and plan (Phase 1)

Date: 2026-10-19 · Brief: "Intelligent Learning & UI Enhancement" (IIT Patna B3 Capstone, Option 1: AI Tutor) · Status: **audit complete, no code changed; awaiting approval to start Phase 2**

## 1. Baseline (measured today, nothing changed)

| Check | Result | Evidence |
|---|---|---|
| Git state | `main` at `445fff0`; two uncommitted documentation files only (`docs/CAPSTONE_DOCUMENTATION.md` deduplicated, `docs/PROJECT_CONTEXT.md` new); no code changes pending | `git status` |
| Unit tests | **39 passed, 0 failed**, 1.1 s | `npm test` |
| AI scenario suite (22) | last recorded full run on prompt v2.0: 18/22 with 4 local-model timeouts, then 4/4 on re-run; every scenario has passed on v2.0 (2026-10-06, `qwen2:7b`) | `tests/results/scenarios-ollama-qwen2_7b-2026-10-06-01-43.*`, `…-01-46.*` |
| Browser end-to-end | last recorded 18/18 (run E, 2026-10-05). Re-run today with the local model: **12 of 13 checks passed** before the harness gave up waiting for the five-question quiz generation (question 1 alone took 91 s; the DevTools socket also dropped once and reconnected, as documented for runs C and D); the page reported no JavaScript errors. The practice flow, hints, reveal, progress and needs-practice checks all passed. Recorded in `tests/results/e2e-baseline-2026-10-19.txt` | `npm run test:e2e` |
| Model available locally | Ollama with `qwen2:7b` is running; no Anthropic key, so every AI test uses the local model | `GET /api/health` → `provider: ollama` |
| Quality dashboard | `reports/dashboard.html` current as of pull request #1 | `npm run dashboard` |

## 2. What already works, and where it lives

| Capability | Files | Notes |
|---|---|---|
| Learner setup (name, level, class, topic), shareable links, saved profile | `public/index.html` (`#setup`), `public/app.js` (`init`, `startApp`, `save/load`, key `algebratutor.v1`) | returning learners skip setup |
| 14 topics across Classes 8–10, answer types, per-topic method and common mistakes | `src/topics.js` | data-driven; `mistakes` text per topic already exists |
| Learn and Ask-a-Doubt chat | `src/tutor.js` `chat()`, `src/prompts.js` (`BASE_SYSTEM`, layers), `src/llm.js` | override guard before the model; LaTeX sanitizer after |
| Question generation with validation and repair | `tutor.generateQuestions`, `validate.checkQuestion`, `topicShapeProblem`, solvers | whole-number rule below advanced; two rounds; rejections logged |
| Evaluation: deterministic verdict, LLM feedback, attempt gating, leak scrubber, solution guarantee | `tutor.evaluate`, `validate.computeVerdictFor`, `revealsTruth`, `ensureSolution`, `prompts.buildFeedbackSystem` | `MAX_ATTEMPTS` practice 3 / quiz 1; the model never grades |
| Progress and summary | `public/app.js` (`recordResult`, `renderProgress`, `endSession`), `tutor.summarize` | strong ≥ 75 % over ≥ 2 attempts; weak < 60 %; next topic chosen in code |
| Providers | `src/config.js`, `src/llm.js` | Claude primary, Ollama fallback; structured JSON both ways; one retry on bad JSON |
| Security and limits | `src/validate.js` schemas, `src/config.js` limits, `src/app.js` error handler | 64 kB JSON cap; learner message 1,000 chars; key never reaches the browser |
| UI design system | `public/styles.css` (tokens), `docs/DESIGN_UI.md` | indigo primary, orange accent, Fredoka/Nunito, light canvas with two radial tints |
| Tests | `tests/unit.test.mjs` (39), `tests/scenarios.mjs` (S01–S22), `tests/e2e-browser.mjs` (18 checks), `tests/smoke-remote.mjs` | scenario runner supports `SCENARIOS=S23,S24` subsets |
| Dashboard | `scripts/build-dashboard.mjs`, `reports/dashboard.html`, served at `/reports/dashboard.html` | developer-facing; built from recorded files |

## 3. Gaps against the brief

**Educational logic**

- Feedback for a wrong answer names a likely mistake only if the model notices it; nothing deterministic identifies error patterns, and the model is asked for "one hint" with no ladder, so hints can repeat across attempts.
- There is no way to submit working; the composer sends one line.
- The recommendation is a single topic id with no reason, no prerequisite logic, no difficulty adaptation, and no "not enough data" state; one attempt with a wrong answer already marks a topic "needs practice".
- Progress is per topic only: no first-attempt rate over time, no session history, no distinction between this session and saved data.

**Interface (against section 6 of the brief)**

- Two competing accents (indigo and orange), gradients on the mark and avatar, radial tints on the canvas; emoji as icons; a playful display font. The brief asks for navy/indigo ink, violet or blue accents, restrained gradients, small purposeful icons.
- The setup page works but mixes a tall hero with a three-step card; the learning modes are explained in the hero copy only.
- The workspace is "chat first": one input doubles as chat box and answer box, with no explicit *Check answer* or *Hint* controls, no hint-progression display, no student dashboard (the rail is a progress card), no collapsible sections.
- States: typing dots exist and the busy flag prevents double submission, but there is no timeout handling, no retry, no provider-unavailable banner, and errors are plain red lines; the End-session button is the only loading state outside chat.
- No mathematics visualization of any kind.

**Reliability**

- `fetch` has no timeout on the client; a stalled local model holds the UI until the server's 300 s abort.
- Error texts come straight from the server message; useful for developers, not phrased for a 14-year-old.

## 4. New functionality that is necessary

1. A deterministic mistake-pattern analyser (`src/diagnose.js`) that, given the stored truth, the machine equation and the student's parsed answer, returns a named pattern with a confidence tier and *never* a value; the model only phrases it.
2. A hint ladder tied to the attempt number, with the previous hints passed back so the model does not repeat them, and deterministic fallback hints from the topic method and the stored question hint.
3. Optional working text on the evaluate request, passed to the model as context and echoed into the diagnosis prompt, never used to invent steps.
4. A transparent recommendation module (`src/recommend.js`) with prerequisites per topic, accuracy and volume thresholds, an "insufficient data" state, a difficulty direction (ease / hold / stretch) and a one-sentence reason; the summary endpoint returns these.
5. Versioned local progress (`algebratutor.v2` with migration from v1) that keeps a short session history and separates "this session" from "all time".
6. A design-system refresh and three redesigned surfaces: setup, workspace, student progress panel; explicit states for loading, errors, hints, reveal, quiz completion, empty progress and session end.
7. A verified step generator for linear equations in one variable (`src/steps.js`) that produces school-style transformations whose every line is checked to have the same solution, and an SVG balance-scale view of it; unsupported forms return no steps rather than guesses.
8. Client-side timeouts, one retry for idempotent reads, friendlier error mapping and a provider-unavailable banner.

Not necessary, and not planned: a database, authentication, voice, new subjects, a second machine-learning model, new npm dependencies.

## 5. Contract policy

Every API change is additive and optional, so current callers and tests keep working:

| Endpoint | Addition | Default when absent |
|---|---|---|
| `POST /api/evaluate` request | `working?: string ≤ 600`, `previousHints?: string[] ≤ 3` | no working; no prior hints |
| `POST /api/evaluate` response | `diagnosis?: { code, label, confidence: "likely" \| "possible" \| "unknown", explanation }`, `hintLevel: 1 \| 2 \| 3` (null when correct); as built in Phase 3 also `hintReplaced`, `workingUsed`, `guessesRemoved` | — |
| `POST /api/hint` (new endpoint, Phase 3) | request `{ profile, questionId, level: 1 \| 2 }`; response `{ hint, hintLevel, maxHintLevel }`; app-only, no model call, no attempt used | — |
| `POST /api/questions` request | `difficultyBias?: "easier" \| "normal" \| "harder"` | `"normal"` |
| `POST /api/questions` request | `topics?: string[]`, 2–5 ids from `TOPIC_IDS`, for a mixed revision quiz (added 2026-10-20 at the user's request) | `[profile.topic]` |
| `POST /api/summary` response | `reason`, `adaptation`, `insufficientData` (topic ids); as built also `difficultyBias` | — |
| `POST /api/summary` request (Phase 4) | `session?: { byTopic }`, this session's counts for "Today's performance"; `stats` holds all saved answers | `stats` used for both |
| `POST /api/recommend` (new endpoint, Phase 4) | request `{ profile, stats: { byTopic } }`; response `{ nextTopicId, nextLesson, adaptation, difficultyBias, reason, insufficientData, perTopic }`; rules only, no model call | — |
| `GET /api/topics` | `prerequisite` per topic (one id or null); `workedExamples` (Phase 5) | — |
| `POST /api/evaluate` response (Phase 5) | `steps`: verified lines for the balance scale, only when the answer is revealed and the topic shows its equation; otherwise null | — |
| `POST /api/steps` (new endpoint, Phase 5) | request `{ profile, index }`; response `{ equation, steps, index, count }` from the topic's own example equations, never a student-typed one | — |

Unchanged: topic ids, answer formats and parsers, verdicts, `MAX_ATTEMPTS`, the provider abstraction, the solvers, the leak scrubber, the override guard, the sanitizer, every existing test.

## 6. Phase plan (each phase ends with a report and waits for approval)

### Phase 2 — UI foundation (`public/styles.css`, `public/index.html`, `public/app.js`, `docs/DESIGN_UI.md`)

- Tokens: ink navy `#1b2340`, indigo primary, a violet secondary for interactive accents, neutral surfaces, one restrained gradient for the selected state; semantic green/amber/red kept; the orange accent and canvas tints removed; emoji replaced by inline SVG icons; display font reconsidered against the brief (decision by screenshots before committing).
- Setup: brand block, benefit headline, compact form (name, class, level, topic), *Start learning*, a four-item modes strip.
- Workspace: compact header with learner chip and topic; segmented mode control; central area with question card, answer field, *Check answer* and *Hint* buttons; collapsible progress panel; summary area; the student dashboard shell (filled in Phase 4).
- States: skeleton while a question generates, "thinking" for AI replies, inline validation, error banner, reduced motion, focus rings, 44 px targets, three breakpoints.
- Two full-page screenshots of the proposal (desktop and phone) rendered in headless Chrome **before** the final CSS is applied, for approval of the look.
- Tests: `npm test` after each change; `npm run test:e2e` at the end of the phase (the harness uses element ids; ids are preserved or the harness is updated with the markup, never weakened).

### Phase 3 — Intelligent feedback (`src/diagnose.js` new, `src/tutor.js`, `src/prompts.js`, `src/validate.js`, `public/app.js`, tests)

- Patterns for number answers from a linear prompt (solve the prompt's equation to get the true root; compare the student's value with candidates): `sign_transpose` (constant moved without changing sign), `forgot_divide` (constant moved, coefficient not divided), `multiplied_instead` (multiplied by the coefficient), `lost_sign` (negative of the answer), `bracket_partial` (for bracket topics: only the first term multiplied, derived by transforming the machine equation and solving it), `fraction_partial` (for fraction topics: the whole numerator not multiplied, same method), `arithmetic_slip` (within a small absolute distance of the root, never certain). Pairs: `swapped`. Roots: `sign_of_roots`, `one_root_only` (existing partial). A pattern is `likely` only when exactly one candidate matches and it is not the true answer; two matches or none → `unknown` with "show me your steps".
- Hint ladder in the feedback task: attempt 1 conceptual (which operation first), attempt 2 the concrete next step with the number but not its result, final attempt the existing reveal rule; previous hints quoted with "do not repeat"; deterministic fallbacks when the model's hint repeats or leaks.
- Optional working: a collapsible "Show your working" textarea in the UI; the text is quoted to the model with the instruction to refer only to what the student wrote.
- Tests: unit tests per pattern with crafted equations and answers, no-false-positive tests (correct answer, ambiguous answer, two candidates), fallback tests with a fake model; scenarios S23 (diagnosis and no leak on a known wrong answer), S24 (two different hints across two attempts); the browser test gains a working-field step.

### Phase 4 — Personalized learning (`src/recommend.js` new, `src/topics.js` prerequisites, `src/tutor.js`, `public/app.js`, student dashboard)

- Rules: fewer than 3 attempts on a topic → insufficient data; ≥ 3 attempts with first-attempt accuracy < 50 % → recommend the prerequisite if one exists, else the same topic at an easier bias; ≥ 4 attempts with accuracy ≥ 80 % → stretch (harder bias, then the next topic); otherwise continue; recommendations limited to `TOPIC_IDS`; a one-sentence reason built from the numbers.
- Difficulty bias threads into question generation as prompt guidance (number size, steps), never changing the chosen level label.
- Progress: `algebratutor.v2` with `history: [{ date, attempted, correct, topics }]`, migration from v1, size cap; the student dashboard shows first-attempt rate, questions, topic bars, strong / revisit, next topic with reason, recent sessions, and labels "this session" versus "saved".
- Mixed revision (added 2026-10-20 at the user's request): in Quiz, a "Mixed revision" option lets the learner tick 2–5 topics and get questions spread across them. Learn stays one topic at a time, because a lesson is about one idea. The server generates and checks each question against its own topic; stored questions already carry their topic, so grading needs no change. The quiz label shows each question's topic, and results are recorded per topic as today.
- As built (2026-10-22): a struggling topic's prerequisite is recommended only when it has been practised and is under 80 %; with no answers on the prerequisite, the app recommends easier questions on the same topic and names the prerequisite as the fallback, rather than sending the student back on zero evidence. Mixed topics are generated concurrently, one model call per topic.
- Tests: unit tests for every rule, the migration and the mixed-topic request (spread across topics, unknown ids rejected, single-topic calls unchanged); a scenario (S25) for the summary's reason and adaptation fields; browser checks for the dashboard numbers.

### Phase 5 — Mathematics visualization (`src/steps.js` new, `public/app.js`, `public/styles.css`)

- Step generator for one-step, two-step and both-sides forms parsed from school-style prompts; each produced line is re-solved and must share the root, else the generator returns nothing; the view shows a balance scale with the operation highlighted and a sentence on why equality is preserved; shown after a reveal and on request in Learn.
- Expand to brackets and fractions only if the first version is stable.
- Tests: `2x + 4 = 12 → 2x = 8 → x = 4`, negative and both-sides cases, invariance of the root across steps, unsupported forms return null.
- As built (2026-10-22): brackets and fractions were included because every line passes the same root check; fraction steps show each term multiplied out, then a separate "collect like terms" line. When x has the larger coefficient on the right, the smaller x term is subtracted and the sides swapped, so x stays positive. Learn shows worked examples only from each topic's example list, so the step generator can never be used to answer a practice question. Word problems get no steps, because forming the equation is the skill being practised.

### Phase 6 — Reliability and regression

- Client timeouts with an in-progress message, one retry for `GET` reads, error mapping by kind, provider-unavailable banner, duplicate-submission audit, expired-question recovery; the server error handler checked for leaks of internals.
- Full feasible suite: unit, scenarios (full 22 + new), browser test on desktop and phone widths, dashboard rebuilt if results changed; documentation updates (`DESIGN_UI.md`, `TESTING.md`, `PROMPT_ENGINEERING.md`, `REQUIREMENT_MAPPING.md`, `CAPSTONE_DOCUMENTATION.md`, `DEMO_SCRIPT.md`, `README.md`).

### Phase 7 — Final local readiness review

What changed, tests executed with real results, known limitations, remaining tasks. No deployment.

## 7. Risks and how they are handled

| Risk | Handling |
|---|---|
| Local-model latency (20–120 s per call) makes browser runs slow and occasionally time out | Scenario subsets per feature; the full suite at Phase 6; timeouts recorded as such, never as app failures |
| False mistake diagnoses would mislead a student | Exact candidate matching only; "possible" and "unknown" tiers; the model may soften but never upgrade confidence; tests for every pattern and for ambiguity |
| Diagnosis or hints leaking the answer | Everything passes through the existing `revealsTruth` scrubber and the stored-hint fallback |
| A look the learner dislikes | Screenshots of the proposed design for approval before the CSS lands (the approach that worked for the NeuroQuest redesign) |
| Breaking the browser harness by changing markup | Element ids kept; where markup must change, the harness is updated in the same change and re-run |
| Scope growth in visualizations | Linear one-variable forms first; expansion only after the generator is proven |

## 8. How to verify Phase 1 locally

```bash
cd ai_tutor
git status                      # only the two documentation files listed above
npm test                        # 39 passed
cat tests/results/e2e-baseline-2026-10-19.txt | tail -5   # today's browser baseline
open reports/dashboard.html     # current quality dashboard
```
