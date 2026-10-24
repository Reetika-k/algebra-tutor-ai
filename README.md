# AlgebraTutor AI

**AI Tutor capstone – a personalized learning assistant for school algebra equations (NCERT Classes 8–10, as used by CBSE and RBSE).**

Built for the IIT Patna AI/ML capstone, Project 1: *AI Tutor: Build a Personalized Learning Assistant*.

## Problem statement

Class 8 students usually know the balancing rules for equations but fail at three points: choosing the right first step for a new equation form, sign errors when transposing (especially with brackets and fractions), and turning word problems into equations. Textbook exercises give no feedback until the answer key, tutoring is expensive, and a stuck student looks up the answer instead of getting a hint. The full statement is in [docs/CAPSTONE_DOCUMENTATION.md](docs/CAPSTONE_DOCUMENTATION.md).

## Objective

Demonstrate an AI tutor that is **interactive, adaptive and personalized**: it explains at the learner's level, generates unlimited fresh questions, coaches with hints before answers, tracks strengths and weaknesses, and recommends what to study next, while keeping the model's output verified.

## Solution

A small web app: a Node.js server that assembles layered prompts and calls the Claude API, plus a plain HTML/CSS/JS frontend with four modes (Learn, Practice, Quiz, Ask a Doubt), a session progress panel, a student dashboard and an end-of-session summary. The parts that must be right are computed by the app, not the model: grading, mistake diagnosis, the hint ladder's fallbacks, recommendations and worked steps.

## Features

- Learner setup: name, level (Beginner / Intermediate / Advanced), class (8, 9 or 10) and a starting topic (14 topics across four NCERT chapters; switchable any time)
- **Learn** – explanation with worked example and check questions, adapted to level; **worked examples on a balance scale** for the Class 8 equation topics
- **Practice** – one generated question at a time, three attempts, **hints that build step by step** (the idea, then the next step, then the solution), a **Hint button** that uses no attempt, and optional **working** the tutor can point to
- **Quiz** – five generated questions, one attempt each, immediate solution, score; **mixed revision** across 2–5 topics
- **Ask a Doubt** – free in-scope questions
- Answer evaluation: verdict, explanation, hint, encouragement, correct answer when allowed; answers may be a number, a pair (x, y), any solution of a two-variable equation, or two roots (partial credit for one root)
- **Mistake diagnosis**: the app names a likely mistake (a sign not changed, a bracket half expanded, x and y swapped, …) only when exactly one known mistake explains the answer; otherwise it asks for the steps
- **Verified steps** after a reveal: every line is re-solved by the app and must keep the same answer
- Session panel (today) and a **student dashboard** (saved): first-try accuracy, status per topic, recent sessions, recent mistakes, and **your next step with a reason** built from your own numbers
- **Recommendations** by transparent rules: not enough data under 3 answers; easier questions or a prerequisite under 50 %; harder questions, then the next topic, at 80 % over 4+ answers
- Session summary with recommended next lesson, the reason, and tips
- Shareable start links: `/?name=Asha&level=beginner&topic=two-step&mode=practice` opens the tutor directly
- Guardrails: scope control, prompt-injection guard, answer-leak scrubbing, no invented mistakes, plain-text maths sanitizer, input validation, plain error messages with Try again, request timeouts, and a banner when the model is unavailable

## Design

Version 2 of the interface (October 2026): light neutral surfaces, navy ink, indigo and violet accents, one typeface (Nunito), inline SVG icons, a segmented mode control, question and feedback cards with verdict chips, hint and diagnosis lines, a balance-scale step viewer, a student dashboard dialog, explicit loading, error and empty states, and three breakpoints (desktop, tablet, phone). System, components, states and screenshots: [docs/DESIGN_UI.md](docs/DESIGN_UI.md) and `docs/screenshots/` (version 1 shots `01`–`08` kept for comparison; `p2-`–`p5-` for version 2).

## Technology stack

| Layer | Choice |
|---|---|
| Runtime / server | Node.js 20+, Express 5 |
| LLM | Claude API via `@anthropic-ai/sdk` (`claude-opus-5` default; any current model via `CLAUDE_MODEL`) |
| Offline fallback | Ollama local model (`qwen2:7b`) for zero-cost development and testing |
| Schemas | zod (structured outputs + request validation) |
| Frontend | HTML, CSS, vanilla JavaScript (no build step) |
| Tests | `node:test` unit tests, scenario runner, remote smoke test |
| Deployment | Render blueprint (`render.yaml`) or Docker |

## AI/ML techniques

| Where | Technique | Verification |
|---|---|---|
| Learn / Doubt replies | LLM chat with a layered system prompt (persona + topic + level + mode) | Scenario tests: scope, spelling tolerance, injection, LaTeX-free, length; **override guard** answers blatant "ignore your instructions" messages without the model; **LaTeX sanitizer** normalises every reply to plain-text maths |
| Question generation | Structured JSON output (schema-constrained) | **Topic-shape check**; for equation topics the prompt is **solved deterministically** and a wrong model answer is corrected (repaired) rather than trusted; word problems must satisfy their own equation or are discarded and regenerated |
| Answer evaluation | Deterministic numeric verdict **then** LLM feedback conditioned on that verdict | The model never grades; answer-leak detector with retry and safe fallback; solution guaranteed to state `x = value` |
| Mistake diagnosis | Rule-based: the answer each known mistake would give is recomputed and compared (`src/diagnose.js`) | "Likely" only when exactly one mistake matches; the model phrases it; with no evidence, guesses are removed from its text |
| Hint ladder | Prompted levels (idea → next step → reveal) with app-written fallbacks (`src/hints.js`) | Repeats (also when padded) and level-1 hints with numbers are replaced by the app's next step |
| Recommendations | Transparent rules over first-attempt counts (`src/recommend.js`), no learned model | Reason sentence quotes the student's numbers; prerequisites are earlier syllabus topics |
| Worked steps | Deterministic step generator (`src/steps.js`) | Every line is re-solved and must keep the root, or nothing is shown |
| Session summary | Deterministic statistics + rules-based next step + LLM message (structured) | Next topic, kind of practice and reason come from the app |
| Prompt caching | Stable system prefix marked cacheable on the Claude API | `usage.cache_read_input_tokens` |

Details, including why RAG and fine-tuning were deliberately not used, are in [docs/DESIGN.md](docs/DESIGN.md).

## Architecture

```
Student → Browser UI → Express API (/api/chat · /api/questions · /api/evaluate · /api/hint · /api/recommend · /api/steps · /api/summary)
        → Prompt builder (src/prompts.js) → LLM provider (src/llm.js: Claude | Ollama)
        → Validators (src/validate.js, src/expr.js) → Response → UI → learner profile → summary
```

```
src/config.js    environment and limits          src/prompts.js   prompt layers + JSON schemas (v2.2)
src/topics.js    14 topics, forms, prerequisites src/llm.js       Claude / Ollama provider, public error messages
src/expr.js      safe expression evaluator       src/tutor.js     orchestration + answer gating + guards
src/validate.js  request schemas, answer parsing, solvers, self-consistency, topic-shape and override checks
src/diagnose.js  mistake patterns                src/hints.js     hint ladder and fallbacks
src/recommend.js recommendation rules            src/steps.js     verified worked steps
src/format.js    LaTeX → plain-text sanitizer for model output
src/app.js       Express routes                  server.js        entry point
public/          index.html · styles.css · app.js · progress.js (saved progress, algebratutor.v2)
tests/           unit.test.mjs · reliability.test.mjs · scenarios.mjs · e2e-browser.mjs · reliability-browser.mjs · setup-check-browser.mjs · smoke-remote.mjs · results/
docs/            selection, design, prompts, testing, capstone report, demo, deployment
```

## Installation

```bash
git clone git@github.com:Reetika-k/algebra-tutor-ai.git   # or https://github.com/Reetika-k/algebra-tutor-ai.git
cd algebra-tutor-ai
npm install
cp .env.example .env      # then edit
```

## Configuration

| Variable | Meaning | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API key (server-side only) | – |
| `LLM_PROVIDER` | `claude` or `ollama` | `claude` if a key is present, else `ollama` |
| `CLAUDE_MODEL` | Claude model id | `claude-opus-5` |
| `OLLAMA_URL` / `OLLAMA_MODEL` | Local model settings | `http://localhost:11434` / `qwen2:7b` |
| `PORT` | HTTP port | `3000` |

The browser never sees the key; it only calls `/api/*` on the same origin.

## How to run

```bash
npm start                # http://localhost:3000
npm run dev              # restarts on file changes
```

Offline, without a key (needs [Ollama](https://ollama.com) and `ollama pull qwen2:7b`):

```bash
LLM_PROVIDER=ollama npm start
```

## Testing

```bash
npm test                 # 89 deterministic tests (unit + reliability over HTTP), no model needed
npm run test:tap         # the same tests, recorded to tests/results/unit-latest.tap for the dashboard
npm run test:scenarios   # 26 AI scenarios against the configured provider → tests/results/*.md + *.json
SCENARIOS=S23,S24 npm run test:scenarios               # run selected scenarios only
npm run test:e2e         # browser flow, 28 checks (needs headless Chrome on port 9333; see docs/TESTING.md)
E2E_WIDTH=390 npm run test:e2e                         # the same flow at phone width
node tests/reliability-browser.mjs 390                 # browser checks with the model unavailable
BASE_URL=https://<deployed-url> npm run test:remote   # post-deployment smoke test
```

Three scenario runs on the local model went from 12/19 to 16/19 to 18/19 passing as each run's failures were fixed; the Classes 8–10 suite (22 scenarios, prompt v2.0) then passed in full across two runs. After the October 2026 enhancement round the 26-scenario suite ran 20/26, and the six failures (one generation bug, fixed; three model timeouts; one over-long reply) passed on re-run. Results, failures found and the fixes they led to are documented in [docs/TESTING.md](docs/TESTING.md); prompt iterations in [docs/PROMPT_ENGINEERING.md](docs/PROMPT_ENGINEERING.md).

## Quality dashboard

[`reports/dashboard.html`](reports/dashboard.html) is a self-contained page built from recorded files only (`npm run dashboard`, no dependencies): the syllabus the tutor covers, which model answered in every recorded run (so far always the local `qwen2:7b`; the Claude path is not measured live), every scenario in every run across prompt versions, the seven learner behaviours the brief asks to test with their latest status, latency per scenario, the recorded unit-test run, the findings-and-fixes table and screenshots. The running server also serves it at `/reports/dashboard.html`.

## Syllabus

| Class | NCERT chapter | Topics | Answer type | Deterministic check |
|---|---|---|---|---|
| 8 | Linear Equations in One Variable | one-step, two-step, variable on both sides, brackets, fractions, two word-problem topics | a number | linear solver on the prompt; repair of wrong model answers |
| 9 | Linear Equations in Two Variables | find y for a given x; write any one solution; word problems | a number / any (x, y) pair | substitution; coefficient extraction |
| 10 | Pair of Linear Equations in Two Variables | solve a pair; word problems | (x, y) pair | 2×2 solver (Cramer's rule); repair |
| 10 | Quadratic Equations | solve by factorising; word problems | two roots (partial credit for one) / a number | quadratic solver; whole-number roots below advanced |

Topics are data in `src/topics.js`; adding one means adding an entry and, for a new answer type, a parser and a check in `src/validate.js`.

## Limitations

- Generated questions are kept in server memory for three hours; a restart invalidates open questions (the UI asks for a new one).
- Progress lives in the browser (localStorage, `algebratutor.v2`, migrated once from v1); there is no login or database, by design (optional per the PDF). Clearing site data or another browser starts afresh.
- Mistake diagnosis and worked steps are strongest for the Class 8 equation topics; Class 9–10 topics get fewer patterns and no balance scale.
- Recommendations use first-attempt results only; hints used are not counted.
- On the local model, a quiz or a mixed revision quiz can take one to four minutes to prepare; the page says so after 20 seconds.
- Answers are numbers, pairs or root sets; chapters whose answers are expressions, graphs or proofs are out of scope.
- The offline model (`qwen2:7b`) is noticeably weaker and slower than Claude; its results are reported separately and never mixed.
- Model replies are non-deterministic: the off-topic boundary held in most but not all runs (see `docs/TESTING.md`, F15).

## Future improvements

Streaming replies, persistent progress with Supabase, a teacher view of class-wide weak areas, Hindi explanations, voice input, and more chapters once the pattern is proven.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Live URL: _to be added after deployment_. The quality dashboard is served by the app at `<live URL>/reports/dashboard.html`.
