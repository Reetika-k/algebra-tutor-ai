# Project Design – AlgebraTutor AI

## Problem statement

Class 8 students learning *Linear Equations in One Variable* usually know the balancing rules but fail at three points: choosing the right first step for a given equation form, sign errors when transposing terms (especially with brackets and fractions), and turning word problems into equations. Textbook exercises give no feedback until the answer key, private tutoring is expensive or unavailable, and when a student gets stuck the usual fallback is to look up the answer rather than get a hint. The result is memorised procedures without the ability to recognise *which* procedure a problem needs.

## Target user

- **Who:** students aged 13–15 studying Class 8 Mathematics (NCERT Chapter 2, Linear Equations in One Variable), mostly in India, working at home without a tutor.
- **Problem they face:** they can solve a worked example but freeze on a new form; they get an answer wrong and do not know *why*; they need practice matched to their level, not a fixed worksheet.
- **Secondary users:** parents or teachers who want a quick practice tool and a summary of weak areas.

## Solution

**AlgebraTutor AI** is a web tutor that:

1. asks the learner for their name, level and topic and adapts every response to that profile;
2. explains the chosen topic in simple language with examples and check questions (Learn);
3. generates fresh practice questions on demand, coaches with hints before revealing a solution, and lets the learner retry (Practice);
4. runs a short five-question quiz with one attempt per question and a score (Quiz);
5. answers in-scope doubts (Ask a Doubt);
6. tracks attempts and correct answers per sub-topic to show strong areas and needs-practice areas;
7. produces an end-of-session performance summary with a recommended next lesson.

## Core features (mapped to PDF requirements)

| Feature | Description | Requirement |
|---|---|---|
| F1 Learner setup | Name, level (Beginner / Intermediate / Advanced), topic selection before starting | M6 |
| F2 Tutor interface | Title, chat window, text box, send button, AI response area | M4 |
| F3 Learn mode | Tutor explains the topic at the learner's level, with examples and check questions | M5, M3 |
| F4 Practice mode | One generated question at a time; up to three attempts; hint after each wrong attempt; solution after the third | M5, M7, M8 |
| F5 Quiz mode | Five generated questions, one attempt each, feedback per question, final score | M5, M7, M8 |
| F6 Ask a Doubt | Free-form in-scope questions | Optional mode (Step 4) |
| F7 Answer evaluation | Verdict, explanation, correct answer when allowed, hint, encouragement | M8 |
| F8 Learner profile panel | Attempted / correct per sub-topic; strong areas; needs practice | M9 |
| F9 Session summary | Attempted, correct, needs improvement, recommended next lesson | M10 |
| F10 Difficulty adaptation | Level changes question complexity, hint density and explanation depth | M6 |
| F11 Guardrails | Scope control, no direct answers before attempts are used, injection resistance, input validation, error handling | M3, M11 |

## Topics (one subject family, 14 topics across Classes 8–10)

The seven Class 8 topics below were the original scope. Class 9 adds *find y for a given x*, *write any one solution* and word problems (chapter: Linear Equations in Two Variables); Class 10 adds *solve a pair of linear equations* and word problems (chapter: Pair of Linear Equations in Two Variables) and *solve a quadratic* and word problems (chapter: Quadratic Equations). Each topic declares an answer type (number, pair, any-pair, roots) that drives parsing, deterministic solving and the reveal rules.

### Class 8 topics

| ID | Topic | Typical form |
|---|---|---|
| `one-step` | One-step equations | `x + 7 = 12`, `4x = 20` |
| `two-step` | Two-step equations | `3x + 5 = 20` |
| `both-sides` | Variable on both sides | `5x − 3 = 2x + 9` |
| `brackets` | Equations with brackets | `2(x + 3) = 16` |
| `fractions` | Equations with fractions | `x/3 + 2 = 5`, `(2x + 1)/3 = 5` |
| `word-numbers` | Word problems: numbers and ages | "A number increased by 7 is 15." |
| `word-everyday` | Word problems: perimeter, money and everyday situations | "The perimeter of a rectangle is 40 cm and its length is 4 cm more than its breadth." |

## AI/ML features

| Component | Problem it solves | Why AI/ML | Technique | Input | AI processing | Validation | Output |
|---|---|---|---|---|---|---|---|
| Concept explanation (Learn / Doubt) | Explain a topic at the learner's level and answer follow-ups | Open-ended natural-language tutoring cannot be scripted for every question | LLM chat with a layered system prompt (persona + topic + level + mode) | Learner profile, mode, conversation history, message | Generates the explanation / reply | Input validation; override guard answers blatant injection without the model; LaTeX sanitizer on output; scenario tests for tone, scope, spelling tolerance, injection | Tutor message |
| Question generation | Provide unlimited fresh questions per topic and level | Questions must vary in numbers, wording and difficulty without a hand-made bank | LLM structured output (JSON schema) | Profile, topic, count | Generates question text, canonical equation, numeric answer, hint, worked steps, sub-topic tag | **Topic-shape check**, then for equation topics a **deterministic linear solve** of the prompt (wrong model answers are corrected, worked steps replaced); word problems must satisfy their own equation or are discarded and regenerated | Question set (answers kept server-side) |
| Answer evaluation | Tell the learner if they are right and coach them | Feedback wording must be specific to the learner's mistake | Deterministic answer check **plus** LLM structured feedback | Question, stored answer, learner's text, attempt number | Given the verdict computed by the app, writes explanation, hint, encouragement, and the solution only when allowed | The verdict never comes from the model; the model's output is schema-validated; solution is withheld until attempts are exhausted | Feedback card |
| Session summary | Personalized recommendation | Turning statistics into advice needs natural language | Deterministic statistics + LLM structured summary | Per-topic attempts/correct, mistakes list, next topic chosen by the app | Writes the message and tips for the given facts | Numbers, strengths/weaknesses and the next topic are computed by the app; the model only narrates | Summary card |

Techniques deliberately **not** used: RAG/embeddings (the syllabus content is small and fully within the model's knowledge; retrieval would add complexity without value), fine-tuning, classification models.

## Prompt engineering plan

- **Layered system prompt:** `BASE` (persona, rules, safety) + `TOPIC` (forms, common mistakes) + `LEVEL` (depth, hint density, number size) + `MODE` (what to do in Learn / Practice / Quiz / Doubt).
- **Task prompts with JSON schemas** for question generation, evaluation feedback and session summary.
- **Iteration record** in `docs/PROMPT_ENGINEERING.md`: problem → prompt → test → result → change → final.

## Vibe coding plan

Claude Code is used incrementally: scaffold → core UI/API → LLM wiring → prompt iterations → tests → fixes → UI polish → docs → deployment config. Meaningful prompts and debugging exchanges are recorded in `docs/CAPSTONE_DOCUMENTATION.md`.

## User flow

1. Open the app → setup card → enter name, choose level and topic → **Start**.
2. **Learn** tab: the tutor greets the learner and explains the topic; the learner asks follow-up questions.
3. **Practice** tab: **New question** → learner types an answer → feedback (hint or correct) → retry or **Next question**.
4. **Quiz** tab: **Start quiz** → five questions in sequence → score.
5. **Ask a Doubt** tab: free in-scope questions.
6. The **Progress** panel updates after every evaluated answer.
7. **End session** → summary card with recommendation → optionally change topic and continue.

## Architecture

```
Student
  ↓
Browser UI (HTML / CSS / JS)  — profile, mode tabs, chat, progress panel
  ↓  JSON over HTTP
Express API (server.js)
  /api/chat  /api/questions  /api/evaluate  /api/summary  /api/health
  ↓
Prompt builder (src/prompts.js)  — persona + topic + level + mode + task
  ↓
LLM provider (src/llm.js)
  Claude API via @anthropic-ai/sdk  (primary; model configurable)
  Ollama local model               (offline development fallback)
  ↓
Validators (src/validate.js, src/expr.js, src/format.js)
  schema validation · question self-consistency · topic shape · deterministic answer check · leak scrub · override guard · LaTeX sanitizer
  ↓
Response → UI → learner profile (browser session state) → summary & recommendation
```

## Technology stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 20+ | Single language for server and tests; no build step |
| Server | Express 5 | Minimal routing and static hosting |
| LLM | Claude API via `@anthropic-ai/sdk` (`claude-opus-5` default, `CLAUDE_MODEL` to change) | Listed in the PDF; structured outputs and prompt caching supported |
| Offline fallback | Ollama (`qwen2:7b`) | Zero-cost local runs and testing without an API key |
| Schemas | zod | One schema definition for both providers and for validation |
| Frontend | Plain HTML / CSS / JS | PDF recommendation; easy to explain and demo |
| Tests | `node:test` unit tests + scenario runner script | No extra dependencies |
| Deployment | Render (`render.yaml`) or any Docker/Node host | Free tier, one environment variable |
| Storage | None (browser session state, optional localStorage) | Database is optional per PDF |

## Non-goals (deliberately out of scope)

User accounts, database persistence, voice, gamification, multi-subject support, streaming responses, analytics dashboards.
