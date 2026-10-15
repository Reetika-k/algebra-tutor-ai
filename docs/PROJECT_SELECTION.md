# Capstone Project Selection

**Source of truth:** *IIT Patna B3 – Capstone Projects & Project Guidelines* (PDF, 37 pages).
The PDF defines three project topics (pages 1–32), common submission requirements (pages 33–35) and the report template (pages 36–37). All requirement statements below cite the PDF step or section they come from.

## 1. Available projects

| # | Project (exact name from PDF) | Main requirement | AI/ML skills demonstrated | Prompt engineering | Testing | Deployment | Complexity |
|---|---|---|---|---|---|---|---|
| 1 | **AI Tutor: Build a Personalized Learning Assistant** | Web tutoring app for one focused learning area: chat interface, ≥3 learning modes (Learn / Practice / Quiz), learner personalization, dynamic question generation, answer evaluation with hints, strengths/weaknesses profile, end-of-session recommendation | LLM API integration; system-prompt design; adaptive difficulty; structured outputs for questions, grading and summaries; validating AI output; personalized recommendation | **Yes** – the tutor's behaviour *is* the prompt (Step 2: "experiment with your system prompt until the AI behaves consistently") | **Yes** – Step 10 lists seven scenario types (correct, incorrect, unrelated, easy, difficult, spelling mistakes, direct-answer requests) | **Yes** – "Deployed online version" is an expected outcome (Section 6) | Medium |
| 2 | **Vibe Coding Challenge: Build and Host Your Own Online Video Game** | Browser game with objective, controls, scoring, ≥3 levels, win/loss, restart, start & game-over screens, public URL | None inside the product. AI is used only as the coding assistant; AI-generated questions/enemies are optional extras | Yes, but only prompts *to the coding assistant* – no prompt runs inside the product | Yes – play-testing (Step 11) | Yes – public URL mandatory (Step 12) | Low–Medium |
| 3 | **AI Voice Agent for Customer Support** | Voice agent on a hosted platform (Vapi / Retell / ElevenLabs / Bland) for one business: greeting, 10–15 FAQs, information collection, saved request in Sheets/Airtable, human escalation, safety rules | LLM + speech (STT/TTS) via a platform; knowledge-base grounding; conversation design; escalation logic | Yes – system prompt with knowledge base and safety rules (Steps 4, 10) | Yes – 15–20 test conversations (Step 12) | Optional phone number; browser voice acceptable (Step 11) | Medium–High (depends on third-party platform accounts, telephony and integrations) |

## 2. Selected project

**Project Name:** `AI Tutor: Build a Personalized Learning Assistant`

**Chosen learning area:** Class 8 Mathematics – *Linear Equations in One Variable* (the PDF's own worked example area, Step 1). After the Class 8 version was built and tested, the scope was extended on request to the equation chapters of Classes 9 and 10 (NCERT, CBSE/RBSE), keeping the same deterministic-checking standard for every new answer type.

### Selection reason

- **Fit with the capstone requirements.** Page 1 lists what must be demonstrated: problem understanding, practical use of AI, prompt engineering, vibe coding, API integration, UX thinking, testing and iteration. The AI Tutor exercises every one of these *inside the product*, not only in the development process.
- **AI/ML skills demonstrated.** Direct LLM API integration; a layered prompt architecture (persona + topic + level + mode); structured JSON outputs for question generation, answer feedback and session summaries; validation of model output (a deterministic answer check and a self-consistency check on generated questions); adaptive difficulty; and a personalized recommendation. These are the course's core ideas: *when* to use an LLM, *how* to constrain it, and *how* to verify it.
- **Prompt-engineering skills demonstrated.** Behaviours the PDF asks for (hints before answers, encourage retry, adjust difficulty, stay on topic, constructive feedback) are all prompt-controlled and observable, so prompt iterations can be tested and documented with real before/after results.
- **Vibe coding.** The whole application (backend, frontend, tests, documentation) is built incrementally with Claude Code, one phase at a time, and the prompts are recorded.
- **Meaningful testing.** Step 10 defines seven learner behaviours to test; each maps to an automated scenario. The deterministic parts (answer normalization, validation, prompt assembly) are unit-testable without an API key.
- **Working prototype.** A small Node.js server plus plain HTML/CSS/JS; runs locally with one environment variable and deploys to any Node host.
- **Practical AI usage.** An evaluator can see AI adding value at each step: explain, generate, evaluate, recommend. In the game project, AI is absent from the product; in the voice project, most of the "AI" is platform configuration.
- **Achievable individually.** No third-party voice platform, no telephony, no database. The PDF explicitly recommends a narrow scope ("one subject and approximately 5–10 topics").

### Why not the others

- **Video game** – demonstrates vibe coding well but contains no AI/ML technique in the delivered product, so it demonstrates the AI/ML course weakly.
- **Voice agent** – strong AI content, but it depends on external voice platforms and phone numbers, is hard to test reproducibly, and cannot be demonstrated or graded without live platform accounts.

## 3. Requirements of the selected project (extracted from the PDF)

### Mandatory requirements (explicitly stated)

| ID | Requirement | PDF reference |
|---|---|---|
| M1 | One focused learning area; not "AI tutor for everything" | Step 1 |
| M2 | Define the learner: who they are, what problem they face, how the tutor helps | Section 2 |
| M3 | System prompt defining personality and teaching style: explain simply, avoid jargon, ask questions, give hints before answers, encourage retry, adjust difficulty, use examples, give short quizzes, constructive feedback | Step 2 |
| M4 | Main interface: application title, chat window, user text box, send button, AI response area | Step 3 |
| M5 | At least three learning modes (recommended: Learn, Practice, Quiz) | Step 4 |
| M6 | Personalization before starting: name, current level, topic, difficulty (Beginner / Intermediate / Advanced); explanations adapt accordingly | Step 5 |
| M7 | Dynamic question generation; questions are not manually stored | Step 6 |
| M8 | Answer evaluation returning: correct/incorrect, explanation, correct answer if necessary, hint, encouragement | Step 7 |
| M9 | Simple learner profile with strong areas and needs-practice areas (session-only storage acceptable) | Step 8 |
| M10 | End-of-session recommendation: questions attempted, correct, needs improvement, recommended next lesson | Step 9 |
| M11 | Test with correct answers, incorrect answers, unrelated questions, very easy questions, difficult questions, spelling mistakes, requests for direct answers | Step 10 |
| M12 | Expected outcomes: working web app, personalized responses, Learn/Practice/Quiz modes, answer evaluation, feedback, difficulty selection, basic progress summary, **deployed online version** | Section 6 |
| M13 | Short demonstration following the 8-step suggested flow | Section 6 |
| M14 | Submission: problem statement (200–300 words), architecture flow diagram, working prototype, prompts used, testing report (≥10 scenarios in the given table format), challenges faced | Common Submission Requirements |
| M15 | Report in the 15-section template (cover page … project demo URL) | Report template |

### Recommended / expected features

- One subject with approximately 5–10 topics (Tips and Best Practices)
- Guide the student instead of immediately giving answers; add examples; use structured prompts; keep the UI simple (Tips)
- Optional extra modes: Revision, Ask a Doubt, Challenge, Exam Preparation (Step 4)
- Any LLM API (OpenAI / Claude / Gemini); HTML/CSS/JS frontend; Claude Code or VS Code with AI (Section 4)

### Optional features

- Database for saving progress (Supabase / Firebase / Airtable / Google Sheets) – "optional enhancement rather than a compulsory requirement" (Section 4)
- Persistent storage of the learner profile (Step 8)
- Advanced features: voice, login, learning history, progress charts, gamification, badges, streaks, PDF upload, teacher dashboard, study plans (Optional Advanced Features)

### Constraints

- Not enterprise-grade; a functional MVP that can be demonstrated (page 1)
- Advanced programming knowledge not required; rely on AI coding assistants (Section 3)
- Narrow scope; "a small tutor that works properly is better than a very ambitious application that does not work reliably" (Tips)
- Philosophy: build small → make it work → test it → improve it (Recommended Project Philosophy)
- Individual submission

### Expected deliverables

1. Working AI Tutor web application with a deployed online version
2. Live demonstration (choose level → select topic → explain → practice → wrong answer → guidance → quiz → personalized feedback)
3. Submission report following the 15-section template, including prompts used, ≥10 documented test scenarios and challenges faced

### Not specified in the Capstone PDF

- Programming language, framework or hosting provider
- Which LLM or model to use
- Number of questions per quiz or practice set
- How strengths and weaknesses are computed
- Whether the deployed version needs authentication
- Visual design of the interface
