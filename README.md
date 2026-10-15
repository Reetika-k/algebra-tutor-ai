# AlgebraTutor AI

**AI Tutor capstone – a personalized learning assistant for school algebra equations (NCERT Classes 8–10, as used by CBSE and RBSE).**

Built for the IIT Patna AI/ML capstone, Project 1: *AI Tutor: Build a Personalized Learning Assistant*.

## Problem statement

Class 8 students usually know the balancing rules for equations but fail at three points: choosing the right first step for a new equation form, sign errors when transposing (especially with brackets and fractions), and turning word problems into equations. Textbook exercises give no feedback until the answer key, tutoring is expensive, and a stuck student looks up the answer instead of getting a hint. The full statement is in [docs/CAPSTONE_DOCUMENTATION.md](docs/CAPSTONE_DOCUMENTATION.md).

## Objective

Demonstrate an AI tutor that is **interactive, adaptive and personalized**: it explains at the learner's level, generates unlimited fresh questions, coaches with hints before answers, tracks strengths and weaknesses, and recommends what to study next, while keeping the model's output verified.

## Solution

A small web app: a Node.js server that assembles layered prompts and calls the Claude API, plus a plain HTML/CSS/JS frontend with four modes (Learn, Practice, Quiz, Ask a Doubt), a progress panel and an end-of-session summary.

## Features

- Learner setup: name, level (Beginner / Intermediate / Advanced), class (8, 9 or 10) and topic (14 topics across four NCERT chapters)
- **Learn** – explanation with worked example and check questions, adapted to level
- **Practice** – one generated question at a time, three attempts, hint after each wrong attempt, solution after the last
- **Quiz** – five generated questions, one attempt each, immediate solution, score
- **Ask a Doubt** – free in-scope questions
- Answer evaluation: verdict, explanation, hint, encouragement, correct answer when allowed; answers may be a number, a pair (x, y), any solution of a two-variable equation, or two roots (partial credit for one root)
- Progress panel: attempted / correct-first-try per topic, strong areas, needs practice
- Session summary with recommended next lesson and tips
- Shareable start links: `/?name=Asha&level=beginner&topic=two-step&mode=practice` opens the tutor directly
- Guardrails: scope control, prompt-injection guard, answer-leak scrubbing, plain-text maths sanitizer, input validation, error handling

## Design

A UI/UX pass after the working prototype: a hero setup with level and topic cards, a conversation-first tutor column with icon tabs and mode descriptions, distinct question and feedback cards with colour-coded verdicts, a tutor avatar, an accuracy ring and per-topic bars in a collapsible session rail, and a status pill for the model. It shares its type and tokens with the Equation Catcher game. Audit, system, layouts, components and states: [docs/DESIGN_UI.md](docs/DESIGN_UI.md); before/after screenshots in `docs/screenshots/`.

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
| Session summary | Deterministic statistics + LLM recommendation (structured) | Next topic restricted to the fixed topic list; numbers come from the app |
| Prompt caching | Stable system prefix marked cacheable on the Claude API | `usage.cache_read_input_tokens` |

Details, including why RAG and fine-tuning were deliberately not used, are in [docs/DESIGN.md](docs/DESIGN.md).

## Architecture

```
Student → Browser UI → Express API (/api/chat · /api/questions · /api/evaluate · /api/summary)
        → Prompt builder (src/prompts.js) → LLM provider (src/llm.js: Claude | Ollama)
        → Validators (src/validate.js, src/expr.js) → Response → UI → learner profile → summary
```

```
src/config.js    environment and limits          src/prompts.js   prompt layers + JSON schemas
src/topics.js    the 7 topics, forms, shapes     src/llm.js       Claude / Ollama provider layer
src/expr.js      safe expression evaluator       src/tutor.js     orchestration + answer gating
src/validate.js  request schemas, answer parsing, linear solver, self-consistency, topic-shape and override checks
src/format.js    LaTeX → plain-text sanitizer for model output
src/app.js       Express routes                  server.js        entry point
public/          index.html · styles.css · app.js
tests/           unit.test.mjs · scenarios.mjs · smoke-remote.mjs · results/
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
npm test                 # 34 deterministic unit tests, no network
npm run test:scenarios   # 19 AI scenarios against the configured provider → tests/results/*.md
BASE_URL=https://<deployed-url> npm run test:remote   # post-deployment smoke test
```

Three scenario runs on the local model went from 12/19 to 16/19 to 18/19 passing as each run's failures were fixed. Results, failures found and the fixes they led to are documented in [docs/TESTING.md](docs/TESTING.md); prompt iterations in [docs/PROMPT_ENGINEERING.md](docs/PROMPT_ENGINEERING.md).

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
- Progress lives in the browser (localStorage); there is no login or database, by design (optional per the PDF).
- Answers are numbers, pairs or root sets; chapters whose answers are expressions, graphs or proofs are out of scope.
- The offline model (`qwen2:7b`) is noticeably weaker and slower than Claude; its results are reported separately and never mixed.
- Model replies are non-deterministic: the off-topic boundary held in most but not all runs (see `docs/TESTING.md`, F15).

## Future improvements

Streaming replies, persistent progress with Supabase, a teacher view of class-wide weak areas, Hindi explanations, voice input, and more chapters once the pattern is proven.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Live URL: _to be added after deployment_.
