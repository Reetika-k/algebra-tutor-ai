# Requirement → Implementation mapping

Every mandatory requirement extracted from the Capstone PDF (see `docs/PROJECT_SELECTION.md`) traced to the feature, the code and the test that covers it. Test ids: `U` = unit test in `tests/unit.test.mjs` or `tests/reliability.test.mjs`, `S` = scenario in `tests/scenarios.mjs` (results in `tests/results/`), `B` = browser check in `tests/e2e-browser.mjs` or `tests/reliability-browser.mjs`, `M` = manual demo step in `docs/DEMO_SCRIPT.md`.

| Requirement from PDF | Implementation | File / feature | Tested? |
|---|---|---|---|
| M1 One focused learning area | School algebra equations: the four NCERT equation chapters of Classes 8–10, 14 topics; everything else refused | `src/topics.js`, BASE_SYSTEM boundaries | S03 (unrelated question), S10 (injection) |
| M2 Define the learner | Target-user section: who, problem, how the tutor helps | `docs/DESIGN.md`, `docs/CAPSTONE_DOCUMENTATION.md` | n/a (document) |
| M3 System prompt defining personality and teaching style | Layered system prompt: persona, hints-before-answers, encourage retry, adapt difficulty, examples, short quizzes, constructive feedback | `src/prompts.js` (BASE_SYSTEM, LEVEL, MODE, tasks) | U "system prompts contain every layer"; S01, S02, S06–S08 |
| M4 Interface: title, chat window, text box, send button, response area | Single-page UI with header title, chat transcript, composer input, Send button, tutor bubbles | `public/index.html`, `public/app.js` | M steps 3–7; static id check |
| M5 At least three learning modes | Learn, Practice, Quiz, plus Ask a Doubt | `public/app.js` (`switchMode`), `/api/chat`, `/api/questions`, `/api/evaluate` | S01 (Learn), S06–S09 (Practice), M step 7 (Quiz), S02–S05 (Doubt) |
| M6 Personalization: name, level, topic, difficulty; explanations adapt | Setup form; profile sent with every request; LEVEL layer changes depth, hint density and number size | `public/index.html` setup card, `src/prompts.js` LEVEL_GUIDANCE | S18 (difficulty adaptation), U prompt layers |
| M7 Dynamic question generation, not manually stored | Structured-output generation per topic/level with avoid-list; self-consistency + shape validation | `src/tutor.js` `generateQuestions`, `src/validate.js` | S17, U "discards inconsistent", U "topicShapeProblem" |
| M8 Evaluation: correct/incorrect, explanation, correct answer if necessary, hint, encouragement | Deterministic verdict + structured feedback `{feedback, hint, encouragement, solution}`; answer gated by attempt | `src/tutor.js` `evaluate`, `src/validate.js` `computeVerdict` | S06–S09, S11; U evaluate tests |
| M9 Strengths and weaknesses profile (session storage OK) | Session panel (today: going well / to revisit) and a student dashboard (saved: status per topic as mastered, developing, struggling or not enough data; recent sessions; recent mistakes); saved in localStorage `algebratutor.v2` with a one-time v1 migration | `public/app.js` `renderProgress` / `renderDashboard`, `public/progress.js`, `src/recommend.js` | U "progress: …" (migration, caps, corrupt data), U "topicStatus thresholds", B dashboard check, M step 8 |
| M10 End-of-session recommendation: attempted, correct, needs improvement, next lesson | Summary card: today's counts, needs-improvement list, recommended next lesson, kind of practice and the reason, message, tips, one button to follow it | `/api/summary`, `/api/recommend`, `src/recommend.js`, `public/app.js` `endSession` | S19, S25; U "recommend: …" (every rule) |
| M11 Test: correct, incorrect, unrelated, very easy, difficult, spelling mistakes, direct-answer requests | One scenario per category plus edge cases | `tests/scenarios.mjs` | S01–S11 |
| M12 Expected outcomes incl. deployed online version | All modes, evaluation, feedback, difficulty selection, progress summary; Render blueprint + Docker | whole app, `render.yaml`, `Dockerfile`, `docs/DEPLOYMENT.md` | `npm run test:remote` after deployment |
| M13 Eight-step demonstration | Scripted walkthrough | `docs/DEMO_SCRIPT.md` | M |
| M14 Submission: problem statement, architecture diagram, prototype, prompts, ≥10 test scenarios, challenges | Capstone report + supporting docs | `docs/CAPSTONE_DOCUMENTATION.md`, `docs/PROMPT_ENGINEERING.md`, `docs/TESTING.md` | n/a (documents) |
| M15 15-section report template | Report follows the template order | `docs/CAPSTONE_DOCUMENTATION.md` | n/a |

Recommended features covered: topics (14), guide instead of answer (attempt gating and a three-step hint ladder), examples in Learn mode (including verified worked examples on a balance scale), structured prompts, simple UI, optional "Ask a Doubt" mode.

## Enhancement brief (October 2026) → implementation

| Brief section | Implementation | File / feature | Tested? |
|---|---|---|---|
| §3 Intelligent mistake diagnosis | Rule-based patterns compared against the student's number; likely / possible / unknown; the model only phrases it; guesses removed when there is no evidence | `src/diagnose.js`, `src/tutor.js` (`dropGuesses`) | U diagnose tests (each pattern, no false positives, no numbers in text); S23; U guess-removal tests |
| §4 Progressive hints | Hint level by attempt and hints shown; app-written ladder hints for the Hint button and as fallbacks; no repeats | `src/hints.js`, `/api/hint`, `public/app.js` `requestHint` | U ladder and repeat tests; S24; B hint-card and next-step checks |
| §5 Personalized recommendations | Transparent rules, prerequisites, difficulty bias, not-enough-data state; mixed revision quiz | `src/recommend.js`, `src/topics.js`, `/api/recommend`, `public/app.js` | U recommend and mixed-topic tests; S25, S26; B dashboard and picker checks |
| §6 Premium UI/UX | Design system v2, setup, workspace, cards, student dashboard, states, accessibility, three breakpoints | `public/*`, `docs/DESIGN_UI.md` | B checks at desktop and phone widths; screenshots `p2-`–`p5-` |
| §7 Visualizations | Verified step generator; balance-scale view after a reveal and as Learn worked examples | `src/steps.js`, `/api/steps`, `public/app.js` | U steps tests (root invariance, unsupported forms); B step-view and worked-example checks |
| §8 Reliability | Request timeouts, GET retry, Try again, slow notice, model-unavailable banner, duplicate-submission guard, expired-question recovery, public error messages only | `public/app.js` `api` / `showError`, `src/llm.js` `publicError`, `src/app.js` | U reliability tests over HTTP; B reliability check (model down) at two widths |
Optional features deliberately not built: database, login, voice, gamification (see README "Future improvements").
