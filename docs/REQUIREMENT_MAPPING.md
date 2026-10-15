# Requirement → Implementation mapping

Every mandatory requirement extracted from the Capstone PDF (see `docs/PROJECT_SELECTION.md`) traced to the feature, the code and the test that covers it. Test ids: `U` = unit test in `tests/unit.test.mjs`, `S` = scenario in `tests/scenarios.mjs` (results in `tests/results/`), `M` = manual demo step in `docs/DEMO_SCRIPT.md`.

| Requirement from PDF | Implementation | File / feature | Tested? |
|---|---|---|---|
| M1 One focused learning area | Class 8 Linear Equations in One Variable, 7 topics; everything else refused | `src/topics.js`, BASE_SYSTEM boundaries | S03 (unrelated question), S10 (injection) |
| M2 Define the learner | Target-user section: who, problem, how the tutor helps | `docs/DESIGN.md`, `docs/CAPSTONE_DOCUMENTATION.md` | n/a (document) |
| M3 System prompt defining personality and teaching style | Layered system prompt: persona, hints-before-answers, encourage retry, adapt difficulty, examples, short quizzes, constructive feedback | `src/prompts.js` (BASE_SYSTEM, LEVEL, MODE, tasks) | U "system prompts contain every layer"; S01, S02, S06–S08 |
| M4 Interface: title, chat window, text box, send button, response area | Single-page UI with header title, chat transcript, composer input, Send button, tutor bubbles | `public/index.html`, `public/app.js` | M steps 3–7; static id check |
| M5 At least three learning modes | Learn, Practice, Quiz, plus Ask a Doubt | `public/app.js` (`switchMode`), `/api/chat`, `/api/questions`, `/api/evaluate` | S01 (Learn), S06–S09 (Practice), M step 7 (Quiz), S02–S05 (Doubt) |
| M6 Personalization: name, level, topic, difficulty; explanations adapt | Setup form; profile sent with every request; LEVEL layer changes depth, hint density and number size | `public/index.html` setup card, `src/prompts.js` LEVEL_GUIDANCE | S18 (difficulty adaptation), U prompt layers |
| M7 Dynamic question generation, not manually stored | Structured-output generation per topic/level with avoid-list; self-consistency + shape validation | `src/tutor.js` `generateQuestions`, `src/validate.js` | S17, U "discards inconsistent", U "topicShapeProblem" |
| M8 Evaluation: correct/incorrect, explanation, correct answer if necessary, hint, encouragement | Deterministic verdict + structured feedback `{feedback, hint, encouragement, solution}`; answer gated by attempt | `src/tutor.js` `evaluate`, `src/validate.js` `computeVerdict` | S06–S09, S11; U evaluate tests |
| M9 Strengths and weaknesses profile (session storage OK) | Per-topic attempted/correct-first-try; strong (≥2 attempts, ≥75 %) and needs-practice (<60 %) lists; mirrored to localStorage | `public/app.js` `renderProgress`, `src/tutor.js` `summarize` | U "summarize computes strengths", M step 8 |
| M10 End-of-session recommendation: attempted, correct, needs improvement, next lesson | Summary card: counts, needs-practice list, recommended next lesson, message, tips, "study next" button | `/api/summary`, `public/app.js` `endSession` | S19 |
| M11 Test: correct, incorrect, unrelated, very easy, difficult, spelling mistakes, direct-answer requests | One scenario per category plus edge cases | `tests/scenarios.mjs` | S01–S11 |
| M12 Expected outcomes incl. deployed online version | All modes, evaluation, feedback, difficulty selection, progress summary; Render blueprint + Docker | whole app, `render.yaml`, `Dockerfile`, `docs/DEPLOYMENT.md` | `npm run test:remote` after deployment |
| M13 Eight-step demonstration | Scripted walkthrough | `docs/DEMO_SCRIPT.md` | M |
| M14 Submission: problem statement, architecture diagram, prototype, prompts, ≥10 test scenarios, challenges | Capstone report + supporting docs | `docs/CAPSTONE_DOCUMENTATION.md`, `docs/PROMPT_ENGINEERING.md`, `docs/TESTING.md` | n/a (documents) |
| M15 15-section report template | Report follows the template order | `docs/CAPSTONE_DOCUMENTATION.md` | n/a |

Recommended features covered: 5–10 topics (7), guide instead of answer (attempt gating), examples in Learn mode, structured prompts, simple UI, optional "Ask a Doubt" mode.
Optional features deliberately not built: database, login, voice, gamification (see README "Future improvements").
