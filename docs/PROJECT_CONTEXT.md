# AlgebraTutor AI — full project context

Snapshot date: 2026-10-19. This is the one document to read before working on, presenting or submitting the project. Every number comes from a file in the repository; where something was not done, it says so.

## 1. In one paragraph

AlgebraTutor AI is a web tutor for the equation chapters of NCERT Classes 8 to 10 (as used by CBSE and RBSE): linear equations in one variable, linear equations in two variables, pairs of linear equations, quadratic equations. A student enters a name, level, class and topic; the tutor explains at that level, generates fresh questions, grades answers, coaches with hints before revealing solutions, tracks strengths and weaknesses, and ends with a recommended next lesson. A large language model writes the words; the application decides everything that must be right: whether an answer is correct, whether a generated question is valid, when a solution may be shown, which topic comes next. It is the IIT Patna B3 AI/ML capstone, Project 1 ("AI Tutor: Build a Personalized Learning Assistant"), by Reetika Kukreja.

| Item | Value |
|---|---|
| Repository | https://github.com/Reetika-k/algebra-tutor-ai (default branch `main`) |
| Local folder | `~/Projects/aiml-project/ai_tutor` (its own git repository inside an umbrella folder that has no commits or remote) |
| Version | 0.3.0 (`package.json`), prompt version 2.0 (`src/prompts.js`) |
| Stack | Node.js 20+, Express 5, `@anthropic-ai/sdk`, zod 4, plain HTML/CSS/JS; no build step, no database |
| Model | Claude (`claude-opus-5` by default) when `ANTHROPIC_API_KEY` is set; otherwise local Ollama `qwen2:7b` |
| State of deployment | **Not deployed.** Render blueprint and Dockerfile are ready; the live URL is still "to be added" |
| State of testing | 39 unit tests pass; 22 AI scenarios have all passed on prompt v2.0 across two runs (local model); browser play test 18/18; the Claude provider path has **never been exercised live** |
| Dashboard | `reports/dashboard.html`, built by `npm run dashboard`, served by the app at `/reports/dashboard.html` |
| Capstone report | `docs/CAPSTONE_DOCUMENTATION.md` (15-section template, cover page filled) |

## 2. Problem, users, solution

**Problem.** Students know the balancing rules for equations but fail at three points: choosing the first step for a new form, sign errors when transposing (brackets, fractions), and turning word problems into equations. Worksheets give no feedback until the answer key, so a stuck student looks the answer up and the mistake is never diagnosed.

**Users.** Primary: Class 8 to 10 students (13 to 16), mostly studying at home. Secondary: parents and teachers who want a quick practice tool and a summary of weak areas.

**Solution.** Four modes (Learn, Practice, Quiz, Ask a Doubt), level-adapted explanations, unlimited generated questions, hints before answers, deterministic grading, a per-topic progress panel and an end-of-session recommendation, all behind guardrails that keep the model on topic and prevent it from leaking answers.

## 3. Scope: the syllabus

Topics are data in `src/topics.js`; each declares its class, chapter, kind and how answers are graded.

| Class | Chapter | Topic ids | Kind | Answer type | Deterministic check |
|---|---|---|---|---|---|
| 8 | Linear Equations in One Variable | `one-step`, `two-step`, `both-sides`, `brackets`, `fractions` | equation | number | the prompt's equation is solved exactly; a wrong model answer is **repaired** |
| 8 | same | `word-numbers`, `word-everyday` | word problem | number | must satisfy its own equation or is discarded and regenerated |
| 9 | Linear Equations in Two Variables | `two-var-value` | find y for a given x | number | coefficient extraction |
| 9 | same | `two-var-any` | any one solution | pair, any | substitution |
| 9 | same | `two-var-word` | word problem | number | consistency |
| 10 | Pair of Linear Equations in Two Variables | `system-solve` | system | pair | 2×2 solver (Cramer's rule); repair |
| 10 | same | `system-word` | word problem | pair | consistency |
| 10 | Quadratic Equations | `quad-solve` | quadratic | two roots, **partial** credit for one | quadratic solver; whole-number roots below the advanced level |
| 10 | same | `quad-word` | word problem | number | consistency |

Fourteen topics, four chapters, three classes. Below the advanced level, generated equations must have whole-number solutions (`requireInteger`). Everything outside these topics is refused.

## 4. Features

1. Learner setup: name, level (Beginner / Intermediate / Advanced), class, topic; shareable start links such as `/?name=Asha&level=beginner&topic=two-step&mode=practice`.
2. **Learn**: explanation with a worked example and check questions, adapted to the level.
3. **Practice**: one generated question at a time, three attempts, a hint after each wrong attempt, the solution after the last.
4. **Quiz**: five generated questions, one attempt each, immediate solution, score.
5. **Ask a Doubt**: free in-scope questions.
6. Answer evaluation: verdict (correct / incorrect / unclear / partial), explanation, hint, encouragement, correct answer only when allowed. Answers may be a number, `x = 6`, a fraction or decimal (0.5 % tolerance), a pair `(x, y)`, any solution of a two-variable equation, or two roots.
7. Progress panel: attempted / correct-first-try per topic; strong areas (≥ 2 attempts, ≥ 75 %) and needs-practice (< 60 %); mirrored to `localStorage`.
8. Session summary: counts, needs-practice list, recommended next lesson (computed in code: weakest topic, else next in syllabus order), message and tips written by the model.
9. Status pill in the top bar showing the provider and model ("Local model · qwen2:7b", "Claude · claude-opus-5", or "not configured").
10. Offline development mode with the local model, so iteration costs nothing.

Deliberately not built (optional per the brief): accounts, database, voice, gamification, streaming replies, multi-subject support.

## 5. Architecture

```
Student → Browser UI (public/index.html, app.js, styles.css)
        → Express API (src/app.js): GET /api/health · GET /api/topics · POST /api/chat · POST /api/questions · POST /api/evaluate · POST /api/hint · POST /api/recommend · POST /api/steps · POST /api/summary
        → Prompt builder (src/prompts.js): BASE + TOPIC + LEVEL + MODE/TASK + LEARNER, JSON schemas for tasks
        → LLM provider (src/llm.js): Claude via the SDK | Ollama via HTTP, same two calls complete() / completeJSON()
        → Validators (src/validate.js, src/expr.js, src/format.js)
        → Response → UI → learner profile (browser) → summary
```

| Module | Lines | Role |
|---|---|---|
| `src/config.js` | 22 | environment, provider rule, limits (learner message ≤ 1,000 chars, tutor reply in history ≤ 8,000, history ≤ 20 messages, answer ≤ 100 chars) |
| `src/topics.js` | 115 | the 14 topics with forms, methods, common mistakes, required prompt formats |
| `src/prompts.js` | 210 | prompt layers, `PROMPT_VERSION = "2.0"`, zod schemas for question sets, feedback and summary |
| `src/llm.js` | 150 | provider layer: Claude (`messages.create` / `messages.parse` with `zodOutputFormat`, cacheable system prefix, effort, 6,000-token thinking headroom) and Ollama (`/api/chat`, JSON-schema `format`, temperature 0.2, 8,192 context, 300 s timeout); one retry on invalid JSON |
| `src/tutor.js` | 238 | orchestration: chat, question generation with validation and repair, evaluation with answer gating (`MAX_ATTEMPTS` practice 3 / quiz 1), summary; override guard reply without a model call; in-memory question store (three-hour expiry) |
| `src/validate.js` | 417 | request schemas, answer parsers (number, pair, roots), `answersMatch`, verdicts, linear / 2×2 / quadratic solvers, topic-shape check, question consistency check, `looksLikeOverride` |
| `src/expr.js` | 102 | safe arithmetic expression evaluator (`2x`, brackets, unicode operators; rejects code) |
| `src/format.js` | 25 | LaTeX-to-plain-text sanitizer applied to every model output |
| `src/app.js` | 70 | routes, validation middleware, error handler, static files, `/reports` |
| `public/app.js` | 416 | the single-page UI: setup, mode tabs, chat, practice and quiz flows, progress rail, summary card |
| `tests/` | 828 | `unit.test.mjs` (39 tests), `scenarios.mjs` (22 scenarios), `e2e-browser.mjs` (headless Chrome via DevTools), `smoke-remote.mjs` |
| `scripts/build-dashboard.mjs` | 202 | the quality dashboard builder |

Storage: generated questions live in server memory for three hours (answers never go to the browser); progress lives in `localStorage`. There is no database and no login.

## 6. The AI design, and the rule behind it

**The rule: prompts set behaviour, code guarantees it.** The model is asked to do what it is good at, explaining, phrasing and varying questions. Everything that must be right is decided or verified in code:

| Concern | Who decides | How |
|---|---|---|
| Is the answer correct? | code | numeric comparison, substitution, or root matching; the model receives the verdict as a fact ("App verdict: incorrect – trust the verdict") |
| Is a generated question valid? | code | topic-shape check; for equation prompts the server solves the equation itself and overwrites a wrong model answer (logged as "repaired"); word problems must satisfy their own equation or are regenerated |
| May the solution be shown? | code | attempt gating; a leak detector scrubs any premature answer and falls back to the stored hint |
| Which topic next? | code | weakest needs-practice topic, else next in syllabus order; the model only writes the message |
| Output format | code | LaTeX sanitizer on every reply; schema validation of every JSON reply |
| Blatant instruction overrides | code | `looksLikeOverride` answers with a fixed redirect, no model call |
| Explanations, hints, encouragement, question wording | model | layered system prompt; structured JSON where a task needs it |

**Prompt architecture.** Five layers: `BASE_SYSTEM` (persona, teaching rules, boundaries; stable, marked cacheable on Claude), `TOPIC` (from `topics.js`), `LEVEL`, `MODE` or `TASK` (with its JSON schema), `LEARNER`. Prompt versions went v1.0 → v1.1 (format rules, topic shapes) → v1.2 (speak to the student as "you") → v1.3 (whole-number answers, rejection reasons) → v1.4 (escaped backslashes found in code review) → v2.0 (Classes 9 and 10: required prompt formats per topic, nullable machine fields, partial verdict). Snapshots are in `docs/prompt-history/`; the iteration record with real model outputs is `docs/PROMPT_ENGINEERING.md`.

**Provider selection.** `LLM_PROVIDER` if set; otherwise Claude when a key exists, else Ollama. On the development machine there is no `.env`, so the app runs on `qwen2:7b` and every recorded AI test result was produced by that model. The Claude path uses only documented SDK calls but is unmeasured; the first action after adding a key is `npm run test:scenarios`.

**Not used, on purpose.** RAG or embeddings (the syllabus is small and within the model's knowledge), fine-tuning, classification models.

## 7. Testing record

| Level | What | Command | Status |
|---|---|---|---|
| Unit (deterministic, no network) | expression evaluator, answer parsing and grading, request schemas, prompt assembly, leak detector, topic-shape and consistency checks, override guard, LaTeX sanitizer, tutor logic against a fake model, the Classes 9–10 solvers and verdicts | `npm test` | **39 / 39** (recorded in `tests/results/unit-latest.tap` by `npm run test:tap`) |
| Scenario (real model, in-process app) | S01–S22: normal question, spelling mistakes, unrelated question, very easy, difficult, direct-answer request, incorrect answer, reveal after last attempt, correct answer in two formats, injection in chat and in the answer field, empty / long / invalid input, malformed JSON, expired question, generation quality across four topics, difficulty adaptation, summary, Class 10 quadratic, Class 10 pair, Class 9 any-solution | `npm run test:scenarios` | see the run table |
| Browser play test | headless Chrome drives the real page: shareable link, practice flow with wrong answers and a direct-answer request, reveal, quiz question, summary, Learn opener plain text, injection | `npm run test:e2e` | 18 / 18 on the final markup (run E, 2026-10-05) |
| Remote smoke | health, topics, frontend, validation, one chat, one question, one evaluation against a deployed URL | `BASE_URL=… npm run test:remote` | not run: nothing deployed yet |

Scenario runs, all on Ollama `qwen2:7b` (`tests/results/`):

| Date (file) | Prompt / app | Scenarios | Passed | Note |
|---|---|---|---|---|
| 2026-09-26 05:54 | v1.1 / 0.1.0 | 19 | 12 | LaTeX in replies, injection succeeded, fractions unusable |
| 2026-09-26 06:07 | v1.3 / 0.2.0 | 19 | 16 | sanitizer, override guard, next topic in code |
| 2026-09-26 06:19 | v1.3 / 0.3.0 | 19 | 18 | solver repair, JSON retry; one off-topic drift |
| 2026-10-05 07:00 | v2.0 / 0.3.0 | 22 | 7 | **void run**: 15 local-model timeouts, kept as a record of an infrastructure failure |
| 2026-10-05 09:04 | v2.0 | 3 (S20–S22) | 0 | timeouts |
| 2026-10-06 01:24 | v2.0 | 3 (S20–S22) | 3 | targeted re-run |
| 2026-10-06 01:43 | v2.0 / 0.3.0 | 22 | 18 | the four failures were one generation timeout each (S06–S08, S18) |
| 2026-10-06 01:46 | v2.0 | 4 (S06–S08, S18) | 4 | after raising the local-model abort to 300 s; every scenario has now passed on v2.0 |

Findings recorded with cause and fix: F1–F15 from the smoke and scenario runs (format, topic drift, hint leakage, validation, summary JSON, off-topic drift, fractions), R1–R7 from the code review and browser runs (escaped backslashes in the prompt, thinking headroom, auth error message, history trimming, UI edge cases, the 1,000-character history cap that broke long conversations, fractional "repairs" for beginners). All in `docs/TESTING.md`. Local-model latency on the laptop: chat 8–50 s, evaluation 11–37 s, generating two questions 26–60 s (up to 126 s for Classes 9–10).

Limitations of the testing: local model only; one run per version, so pass rates are indicative; quiz flow and progress panel checked through the API and screenshots plus the browser test; nothing tested on a deployed URL.

## 8. Quality dashboard

`reports/dashboard.html` is one self-contained file (0.68 MB) built by `scripts/build-dashboard.mjs` from recorded files only: the syllabus table, the provider rule and the model behind every run, a pass-rate bar per run, a scenario-by-run matrix, the seven learner behaviours from the brief with their latest status, latency per scenario, the recorded unit-test run with its 39 test names, the findings table parsed from `docs/TESTING.md`, three screenshots, limitations. Rebuild with `npm run test:tap && npm run dashboard`. The Express app serves it at `/reports/dashboard.html`.

## 9. Deployment

- **Target:** Render free tier via `render.yaml` (`LLM_PROVIDER=claude`, `CLAUDE_MODEL=claude-opus-5`, `ANTHROPIC_API_KEY` entered in the Render dashboard, health check `/api/health`). Alternatives: any Node host, or the Dockerfile (`node:22-alpine`).
- **Status:** not deployed. `README.md` and section 15 of the capstone report still say "live URL to be added".
- **After deploying:** check `/api/health` reports `provider: claude` and `ready: true`; run `npm run test:remote` against the URL; run `npm run test:scenarios` with the key to measure the Claude path for the first time; open `/reports/dashboard.html`; complete the demo flow in two browsers; confirm the key never reaches the page.
- **Cost note:** a demo session of about 30 requests costs well under one US dollar on the default model; `CLAUDE_MODEL=claude-sonnet-5` roughly halves it.

## 10. Repository, history and documents

Commits on `main`: `c544510` initial commit (2026-10-15), `808272b` + `445fff0` quality dashboard via pull request #1 (2026-10-18, branch `feat/quality-dashboard`, merged and deleted). Rule for all commits and pull requests: no AI-agent attribution anywhere.

| Document | What it holds |
|---|---|
| `README.md` | overview, features, stack, techniques, architecture, install, configuration, run, testing, dashboard, syllabus, limitations, future improvements, deployment |
| `docs/PROJECT_SELECTION.md` | the three capstone options, why Project 1, the requirements M1–M15 extracted from the brief, what the brief leaves open |
| `docs/DESIGN.md` | problem, users, features mapped to requirements, topics, AI/ML components table, prompt plan, user flow, architecture, stack, non-goals |
| `docs/DESIGN_UI.md` | the UI/UX redesign: audit, system, layouts, components, states |
| `docs/PROMPT_ENGINEERING.md` | prompt architecture, the iteration record v1.0 → v2.0 with real outputs, final prompts, why v2.0 |
| `docs/TESTING.md` | plan, unit tests, every scenario run with expected and actual results, findings and fixes, browser runs, Classes 9–10 extension runs |
| `docs/REQUIREMENT_MAPPING.md` | requirement → implementation → test |
| `docs/CAPSTONE_DOCUMENTATION.md` | the 15-section submission report (cover page filled; duplicate stale copies removed 2026-10-19) |
| `docs/DEMO_SCRIPT.md` | the eight-step live demonstration with what to say |
| `docs/DEPLOYMENT.md` | Render, other hosts, Docker, post-deployment checklist, cost |
| `docs/prompt-history/` | prompt snapshots per version |
| `docs/screenshots/` | setup, practice, quiz, phone and desktop views (01–08) |
| `tests/results/` | scenario reports (`.md` + `.json`) and the TAP unit run |

## 11. Timeline

| Date | What happened |
|---|---|
| 2026-09-26 | Project selected, designed and built; smoke run; scenario runs 1–3 (12 → 16 → 18 of 19) with fixes between them |
| 2026-09-28 | Code review (R1–R5), first browser end-to-end test |
| 2026-10-05 | UI/UX redesign with five browser runs (final 18/18); extension to Classes 9 and 10 (14 topics, new answer types, 39 unit tests); prompt v2.0; a void 22-scenario run caused by local-model timeouts |
| 2026-10-06 | S20–S22 pass 3/3; full v2.0 run 18/22; the four timeout failures re-run 4/4 after the 300 s abort |
| 2026-10-15 | Pushed to GitHub as `Reetika-k/algebra-tutor-ai` |
| 2026-10-17 to 18 | Quality dashboard built, served at `/reports/dashboard.html`, merged through pull request #1 |
| 2026-10-19 | This context document; stale duplicate copies removed from the capstone report |

## 12. Open items and known issues

1. **Deploy** to Render with an Anthropic key, then run the remote smoke test and the scenario suite on Claude; paste the live URL into the README and the report. Until then, every AI result is a local-model result.
2. **Manual demo** in two browsers per `docs/DEMO_SCRIPT.md` (the brief's live demonstration).
3. Known behaviour of the local model: reply length rules are weakly followed; the off-topic boundary held in most but not all runs; word-problem topics for Classes 9 and 10 depend on the model filling structured fields and are regenerated when it does not.
4. Generated questions expire after three hours or a server restart; the UI asks for a new one.
5. Future improvements listed in the README: streaming, persistent progress, a teacher view, Hindi explanations, voice input, more chapters.

## 13. Commands

```bash
npm install                        # once
cp .env.example .env               # set ANTHROPIC_API_KEY, or leave it out to use Ollama
npm start                          # http://localhost:3000
LLM_PROVIDER=ollama npm start      # offline, needs `ollama pull qwen2:7b`
npm test                           # 39 unit tests, no network
npm run test:tap                   # same, recorded for the dashboard
npm run test:scenarios             # 22 AI scenarios (SCENARIOS=S20,S21,S22 to filter)
npm run test:e2e                   # headless Chrome play test (Chrome with --remote-debugging-port=9334)
BASE_URL=https://… npm run test:remote
npm run dashboard                  # rebuild reports/dashboard.html
```

## 14. How this project relates to the other two

The same learner's capstone work has two more repositories: `Reetika-k/equation-catcher` (Project 2, a browser game built with vibe coding, no AI at runtime) and `Reetika-k/neuroquest` (a self-directed Python/Pygame maze game with trained models, an adaptive controller and a Q-learning agent). All three share the "recorded files only" rule for their dashboards and the no-attribution rule for commits. The tutor is the one where the AI is in the product and the evaluation is strongest among the two brief-listed projects, which is why it is the recommended submission for Project 1.
