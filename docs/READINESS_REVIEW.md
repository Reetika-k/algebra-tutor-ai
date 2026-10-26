# AlgebraTutor AI — Local readiness review (Phase 7)

Date: 2026-10-26 · App version 0.4.0 · Prompt version 2.2 · The tutor app is not hosted. The project page and the quality dashboard are live on GitHub Pages (https://reetika-k.github.io/algebra-tutor-ai/, published 2026-10-24); the enhancement round was merged as PR #2 and the submission PDF as PR #3.

This is the final review of the enhancement round described in `docs/ENHANCEMENT_PLAN.md`. Every result below was actually run; record files are in `tests/results/`. All AI results come from the local `qwen2:7b` model, because no Claude API key was available on the development machine.

## 1. Verdict

Ready for the owner to deploy, with one condition: run the scenario suite against Claude once a key is set (section 6). The local build passes every test suite on the final code, a clean install from the lock file passes, there are no known vulnerabilities in the installed dependencies, and no secret or internal detail reaches the browser.

## 2. What changed in this round

| Phase | Change |
|---|---|
| 2 · UI foundation | Design system v2: neutral surfaces, navy ink, indigo and violet accents, one typeface, SVG icons, segmented mode control, loading and error states, inline validation, three breakpoints. Setup asks "Where do you want to start?" and pre-selects a starting topic |
| 3 · Intelligent feedback | Rule-based mistake diagnosis (`src/diagnose.js`); a hint ladder with a Hint button (`src/hints.js`); optional student working; guards against repeated hints, numeric level-1 hints and invented mistakes |
| 4 · Personalized learning | Recommendation rules with reasons and prerequisites (`src/recommend.js`); difficulty bias; saved progress v2 with history and a one-time v1 migration (`public/progress.js`); student dashboard; mixed revision quiz |
| 5 · Visualization | Verified step generator (`src/steps.js`); balance-scale viewer after a reveal and as Learn worked examples (Class 8 equation topics) |
| 6 · Reliability | Public error messages only; timeout error kind; health check pings the local model; request timeouts, retry, Try again, slow-reply note, model-unavailable banner, duplicate-submission guard, expired-question recovery; two generation bugs fixed; documentation updated |
| 7 · Readiness | Dependency patches for two advisories; reports folder added to the Docker image; this review |

New API endpoints, all additive: `POST /api/hint`, `/api/recommend`, `/api/steps`. Existing requests and responses are unchanged apart from added optional fields (contract table in `docs/ENHANCEMENT_PLAN.md` §5).

## 3. Tests executed on the final code

| Suite | Result | Record |
|---|---|---|
| Unit and reliability-over-HTTP tests | **89 / 89** (39 before the round) | `tests/results/unit-latest.tap` |
| Clean install (`npm ci`) in a fresh copy, then the tests | **89 / 89** | this review |
| `npm audit` | **0 vulnerabilities** after patch updates (was 2 high) | this review; `docs/TESTING.md` R18 |
| Scenario suite, 26 AI scenarios | Full run **20 / 26**; the six failures re-run on the fixed code **6 / 6** | `scenarios-ollama-qwen2_7b-2026-10-23-02-49.md`, `…-04-53.md` |
| Browser, full learner flow (28 checks) | **28 / 28 at 1440 px, 28 / 28 at 390 px** (earlier attempts stopped on model waits while the machine was overloaded; records kept) | `e2e-phase6-1440-…-run4.txt`, `e2e-phase6-390-…-run5.txt` |
| Browser, model unavailable (10 checks) | **10 / 10** at 1440 px and 390 px; re-run after the dependency patch: 10 / 10 | `reliability-browser-*-2026-10-23.txt` |
| Browser, setup form (6 checks) | **6 / 6**, also after the patch | `setup-check-2026-10-20.txt` |
| Start-up without a key | Falls back to the local model; with `LLM_PROVIDER=claude` and no key, health reports `ready: false` and chat returns the public "not set up" message (503) | this review |
| Secrets | No real key in any file; `.env` absent and git-ignored; only `sk-ant-...` placeholders in `.env.example` and `docs/DEPLOYMENT.md` | this review |

Not executed: the Claude path (no key); a Docker image build (Docker is not installed here); a test of a hosted tutor (the app is not hosted; GitHub Pages serves only static pages).

## 4. Known limitations

- **Model.** All AI behaviour was measured on the local 7B model. Claude is expected to follow the prompts more closely and run faster; this is not yet measured.
- **Local-model speed.** A practice question takes about 20–60 s, a five-question quiz up to about two minutes, and a mixed revision quiz three to four minutes. On a heavily loaded laptop, calls can exceed the 300 s limit; the app reports this plainly and offers Try again.
- **Model wording.** The guards catch repeated hints, numeric first hints and invented mistakes using phrase rules, so unusual wordings can slip through. Feedback sentences (as opposed to the hint field) can still name the concrete step at the first attempt. Reply length varies (S01 exceeded 200 words once).
- **Coverage.** Diagnosis and balance-scale steps are strongest for the five Class 8 equation topics. Word problems get no steps by design, and Class 9–10 topics get fewer diagnosis patterns.
- **Recommendations** use first-attempt results only; hints used are not counted. Difficulty bias is prompt guidance; the app checks shape and answer, not whether a question really became easier.
- **Saved progress** lives in one browser (localStorage). There is no login or sync, by design.
- **Student working** is quoted to the model, which can misread it; the app does not yet check working line by line.
- **Questions** live in server memory for three hours; a restart expires open questions, which the page handles.

## 5. Not done, by decision

No deployment, no Render or other hosting changes, no database, authentication, voice or new subjects, and no new npm dependencies (the two patch updates stay within existing version ranges and change only the lock file).

## 6. Before you deploy (owner's checklist)

1. Commit the Phase 7 changes (dependency patch, Dockerfile, this review, TESTING R18–R19, rebuilt dashboard) on a `feat/` branch and merge it, with no agent attribution in messages. The GitHub Pages dashboard updates once this reaches `main`.
2. Set `ANTHROPIC_API_KEY` locally and run `npm run test:scenarios` against Claude; compare with the local-model results in `docs/TESTING.md`. Note anything that differs.
3. Deploy with `render.yaml` (key set in the Render dashboard, never in the file), or build the Docker image and confirm `/reports/dashboard.html` loads.
4. On the deployed URL: `BASE_URL=https://… npm run test:remote`, then walk through `docs/DEMO_SCRIPT.md`.
5. Add the hosted tutor's URL to `README.md` and section 15 of `docs/CAPSTONE_DOCUMENTATION.md` (the Pages links are already there), then rebuild the PDF with `npm run submission`.

## 7. Files to look at

- What the tutor does and how to run it: `README.md`
- Every test run and every finding with its fix: `docs/TESTING.md` (R8–R19 for this round)
- Prompt versions v2.1 and v2.2 and the guards they led to: `docs/PROMPT_ENGINEERING.md`
- Interface system, states and screenshots: `docs/DESIGN_UI.md`, `docs/screenshots/p2-…p5-*.png`
- Requirements traced to code and tests: `docs/REQUIREMENT_MAPPING.md`
- Quality dashboard: `reports/dashboard.html`
