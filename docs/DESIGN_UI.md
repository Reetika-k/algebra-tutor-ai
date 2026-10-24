# UI/UX design – AlgebraTutor AI

Version 2 (enhancement Phase 2, October 2026). This is a presentation pass only. The API, prompts, grading, solvers and stored data are unchanged. Every element id that the browser test relies on was kept.

Version 1 shared the orange mark and the Fredoka typeface with Equation Catcher. The enhancement brief asks for a calmer, more professional look for a study tool: light neutral surfaces, navy ink, indigo and violet accents, restrained gradients and no emoji. Section 9 records what changed and why.

## 1. Audit of version 1

| Problem | Why it matters |
|---|---|
| Orange accent, warm canvas tints and the rounded Fredoka face read as a game | The brief asks for a premium, professional learning product |
| Emoji as icons (📖 ✏️ 🏁 💬 💡 📝) | They render differently on every device and cannot be styled |
| Learner name, level and topic sit in the side panel | The workspace header does not say who is studying what |
| The answer button says "Send" in Practice and Quiz | Answering a question is not chatting; the main action should say what it does |
| The only waiting state is three bouncing dots | Question generation on the local model can take a minute, with no sign of what is coming |
| Errors appear as a red chat message that scrolls away | An error is a state of the page, not part of the conversation |
| Empty input is silently ignored; the name field uses the browser bubble | No inline validation |
| Yellow focus ring `#ffd166` on white | Contrast about 1.5:1, too faint for keyboard users |
| No learner-facing view of progress across topics | The brief asks for a student dashboard separate from the developer dashboard |

## 2. Principles

1. **The workspace is the hero.** The question, the answer field and the feedback carry the page; progress is secondary and collapsible.
2. **One accent, used for meaning.** Indigo marks actions; the indigo-to-violet gradient is used only for the selected state and the brand mark.
3. **Feedback is structured.** A verdict chip, a sentence, then a separate hint or solution block, then encouragement.
4. **Every wait says what it is waiting for.** "Checking your answer", "Preparing your lesson", or a skeleton question card.
5. **Accessible by default.** Visible focus, labels, live regions, 44 px targets, reduced motion, AA contrast.

## 3. Design system (tokens in `public/styles.css`)

| Group | Values |
|---|---|
| Canvas and surfaces | `#f6f7fb` canvas with one faint top wash; surfaces white, `#f8f9fc`, `#eef0f6`; lines `#e3e6ef`, `#d3d8e6` |
| Ink | navy `#1b2340`, `#444d68`, `#646c83` |
| Primary | indigo `#4f46e5`, pressed `#4338ca`, tints `#f3f4ff` and `#e4e6ff` |
| Accent | violet `#7c3aed` / `#6d28d9`, tint `#efe9fe`, used for the level pill and the eyebrow labels |
| Gradient | `#4f46e5 → #7c3aed`; only the brand mark, avatars, the active mode, progress bars and the question rule |
| Semantic | success `#15803d`, danger `#b91c1c`, warning `#b45309`, each with a light tint for chips and blocks |
| Type | Nunito 500–900 for everything; weight carries the hierarchy (900 headings, 800 labels, 600 body) |
| Type scale | 12 · 13.5 · 15.5 · 18 · 22 px, hero 32–46 px |
| Radius | 8 · 12 · 16 · 20 px, pills 999 px |
| Elevation | shadow-1 for cards, shadow-2 for the setup card and workspace, shadow-3 for the dashboard dialog |
| Motion | 150 ms state changes, 500 ms ring fill, thinking dots and skeleton shimmer; all disabled under `prefers-reduced-motion` |
| Icons | 15 inline SVG symbols in `index.html`, 1.9 px stroke, colour from `currentColor` |

**Font decision.** Fredoka was dropped. One family at several weights looks more consistent and loads one font file family instead of two. No new dependency was added; Nunito was already loaded.

## 4. Layout and breakpoints

| Width | Layout |
|---|---|
| Desktop, 1100 px and wider | Setup has two columns: value proposition on the left, form on the right. The workspace sits beside a 340 px progress panel. |
| Tablet, 720 to 1099 px | One column. The progress panel moves below the workspace. |
| Phone, under 720 px | One column. The progress panel becomes a one-line toggle above the workspace. The model badge moves to a second top-bar line. Top-bar buttons show icons only. |

```
Desktop
┌───────────────────────────────────────────────────────────────┐
│ [x] AlgebraTutor AI          ● Local model · qwen2:7b  [My progress] [Start over] │
├──────────────────────────────────────────┬────────────────────┤
│ (A) Hi, Asha [Beginner]     TOPIC [Two-step ▾] │ THIS SESSION      │
│ [ Learn | Practice | Quiz | Ask a Doubt ] │ ◔ 71%  7 attempted │
│ mode description                          │        5 correct   │
│ [! error banner                        x ]│ topic bars         │
│ ┃ CLASS 8 · TWO-STEP EQUATIONS            │ strong / needs     │
│ ┃ Solve for x: 3x + 7 = 22                │ [End session …]    │
│                               [ x = 9 ]   │ summary card       │
│ ● NOT YET · 2 ATTEMPTS LEFT …  Hint block │                    │
│ [Next question]                           │                    │
│ [ Your answer, e.g. x = 6     ] [Check answer ✓] │             │
└──────────────────────────────────────────┴────────────────────┘
```

## 5. Components

| Component | Spec |
|---|---|
| Top bar | Sticky and translucent. Gradient mark with an italic serif *x*, title and syllabus subtitle. Status pill with a green or amber dot. *My progress* appears once a session starts; *Start over* always. |
| Setup card | "Set up your session" with three numbered steps: name, level as three tiles, and "Where do you want to start?". The third step says topics can be switched any time. A class control sits above one-line topic rows grouped by chapter, with short example equations. The first topic of each class is pre-selected and tagged *Start here*, and a note says "Not sure? Keep …". Full-width *Start learning*. |
| Modes strip | Four cards on the setup page: Learn, Practice, Quiz, Ask a doubt, each with an icon and one line. Syllabus chips below. |
| Workspace header | Learner avatar with initial, "Hi, name", level pill, and the topic switch. |
| Mode control | Segmented control with icons. The active mode uses the gradient. A one-line description sits underneath. |
| Question card | White card with a 4 px gradient rule, a small-caps label such as "Question 1 of 5" and the equation at 22 px, weight 800, tabular figures. |
| Feedback card | Border tinted by verdict. Chip with a dot: Correct, Not yet · n attempts left, Partly right, I need an answer. *Hint:* block in amber with a bulb icon. *Solution:* block in grey with a sheet icon. Italic encouragement. |
| Composer | Answer field plus a primary button labelled *Check answer* in Practice and Quiz, and *Send* in Learn and Ask a Doubt. |
| Progress panel | Accuracy ring, attempted and correct-first-try counts, per-topic gradient bars, strong and needs-practice tags, *End session*, summary card. |
| Student dashboard | Modal dialog opened from *My progress*. Four tiles, a by-topic table with status tags, and the last five mistakes. Built only from data saved in this browser. Phase 4 adds history and recommendation reasons. |

**Hint button (Phase 3).** *Get a hint* sits in the action row while a practice question is open, then becomes *Another hint*, and disappears after two. Each press shows a yellow hint card labelled "Hint 1 of 2 · the idea" or "Hint 2 of 2 · next step". The hint comes from the app, not the model, so it is instant and never uses an attempt. Quiz has no Hint button.

**Feedback additions (Phase 3).** When the app's analyser has evidence, a violet line above the feedback reads "Likely mistake: …" or, in grey, "Possible mistake: …". With no evidence there is no line, and the tutor asks for the steps. The *Hint:* block carries a small "the idea" or "next step" tag.

**Working box (Phase 3).** A collapsible "Show your working" box above the answer field in Practice and Quiz, up to 600 characters. The working is sent with the answer, shown inside the student's message, and cleared afterwards.

Screenshots: `p3-feedback-desktop.png` and `p3-feedback-phone.png`, with illustrative content.

**Student dashboard, version 2 (Phase 4).** *My progress* opens a dialog with three parts.
- **This session** and **All saved answers** tiles.
- **Your next step:** the recommended topic, a tag such as "Easier questions", "Harder questions", "Review a prerequisite", "Move on", "Keep going" or "Not enough data yet", and the reason in one sentence built from the student's own numbers. One button follows it.
- **By topic, Recent sessions and Recent mistakes.** The by-topic status is Mastered, Developing, Struggling or "Not enough data (n of 3)", with the rules printed under the table.

The recommendation comes from `/api/recommend`, with no model call. Data stays in the browser under `algebratutor.v2`. A v1 record is migrated once into an "earlier" history row.

**Difficulty chip.** Following a recommendation for easier or harder questions shows a violet chip in the workspace header, "Easier questions ×". Clicking it returns to normal difficulty.

**Mixed revision.** In Quiz, *Mixed revision* opens a picker of all 14 topics grouped by class. It is pre-ticked with the current topic and any saved topic under 80 %, and asks for 2 to 5 topics. Each quiz question's label shows its topic.

**Side panel wording.** The side panel covers this session only, so its lists are "Going well today" and "To revisit today". Judgements that need at least 3 answers live in the dashboard.

Screenshots: `p4-dashboard-desktop.png`, `p4-dashboard-phone.png`, `p4-mixed-picker.png` and `p4-summary-desktop.png`, with illustrative data.

**Balance scale (Phase 5).** Once an answer is revealed, the feedback card has a collapsible "See it step by step on a balance scale" panel, tagged "Every line checked".
- **Scale:** a level beam with each side of the current line in a pan. The operation applied to both pans, such as "− 5", "÷ 3" or "× 6", sits above them.
- **Caption:** names the step and says why the balance holds.
- **Step list:** every line is clickable, with *Back* and *Next step* below.

In Learn, *Show a worked example* adds a card with the topic's own example and opens the scale. The button then becomes *Another worked example*. Steps exist only for the five Class 8 equation topics, and the app solves and checks them without the model.

Screenshots: `p5-reveal-desktop.png`, `p5-reveal-phone.png` and `p5-learn-desktop.png`.

## 6. States

| State | What the learner sees |
|---|---|
| First visit | Hero, modes strip, setup card |
| Name missing | Red field border and "Enter your name so the tutor can greet you." under the field; focus returns to it |
| Practice, no question | Intro message and a *New question* pill |
| Generating a question or quiz | Skeleton question card: "Preparing a new question…" or "Preparing your quiz questions…" |
| Checking an answer | Thinking bubble: "Checking your answer" with dots |
| Learn opener, chat reply | "Preparing your lesson" or "Thinking" |
| Busy | Input, *Check answer* and action pills are disabled, so the same answer cannot be sent twice |
| Empty answer | "Type your answer first, for example x = 6." under the field |
| Error | Red banner with an icon above the conversation, with the server's message and a dismiss button. It clears on the next action or mode change. |
| Question expired | Banner text "That question expired. Ask for a new one." and a *New question* pill |
| App failed to load | Banner under the top bar telling the learner to check the server and reload |
| Dashboard, no answers yet | Empty state: "No answers recorded yet" with what to do next |
| Provider not configured | Amber status pill: "not configured (set ANTHROPIC_API_KEY)", and a banner (Phase 6) saying what still works |
| Model unreachable (Phase 6) | The health check pings the local model. If it is down, an amber banner under the top bar reads "The local AI model is not running…" with *Check again* |
| Slow reply (Phase 6) | After 20 s the skeleton or thinking bubble adds "This is taking longer than usual…" |
| Request failed (Phase 6) | The red banner shows a plain message by kind (not responding, busy, took too long, not set up) and *Try again*, which re-sends the same request without repeating the student's message. Server addresses and provider replies never reach the page |
| Expired quiz question (Phase 6) | Skipped with a note, not scored, and the quiz carries on |

## 7. Accessibility

- **Contrast.** Ink on white is about 15:1. Secondary text `#646c83` is 5.1:1 on white and 4.8:1 on the composer background. White on indigo is 6.3:1. Every chip uses dark text on a light tint at 4.5:1 or more.
- **Focus.** A 2 px indigo outline with offset on every control. Hidden radio inputs pass focus to their tile.
- **Semantics.** The chat is `aria-live="polite"`. Errors use `role="alert"`; waiting indicators use `role="status"`. Mode buttons expose `aria-pressed`. The dashboard is a native `<dialog>`, so Escape closes it and focus is trapped.
- **Targets.** Buttons, inputs, mode buttons and tiles are 44 px tall or more. Top-bar buttons are 40 px.
- **Motion.** Dots, shimmer, ring fill and button press are disabled under `prefers-reduced-motion`.

## 8. Screenshots

The Phase 2 screenshots are in `docs/screenshots/`, rendered in headless Chrome. The conversation in the practice and dashboard shots is illustrative content set through the page's own render functions, so the look can be judged without waiting on the model. They are design references, not test evidence. The browser test in `tests/e2e-browser.mjs` exercises the real flow.

| File | Shows |
|---|---|
| `p2-setup-desktop.png`, `p2-setup-phone.png` | Setup page |
| `p2-setup-validation.png` | Missing-name message |
| `p2-practice-desktop.png`, `p2-practice-tablet.png`, `p2-practice-phone.png` | Workspace with question, feedback and hint |
| `p2-quiz-loading.png` | Skeleton while quiz questions are generated |
| `p2-error-validation.png` | Error banner and empty-answer message |
| `p2-dashboard-desktop.png`, `p2-dashboard-phone.png` | Student dashboard |

Version 1 screenshots `01`–`08` are kept for the before-and-after comparison.

## 9. Changes from version 1

| Area | Version 1 | Version 2 |
|---|---|---|
| Palette | Indigo `#4353d9` with an orange accent and canvas tints | Indigo `#4f46e5` with a violet accent; orange removed |
| Type | Fredoka titles, Nunito text | Nunito only |
| Icons | Emoji | Inline SVG |
| Mode tabs | Underline tabs | Segmented control |
| Learner and topic | Side panel | Workspace header |
| Answer button | "Send" | "Check answer" in Practice and Quiz |
| Waiting | Dots only | Skeleton card or a labelled thinking bubble |
| Errors | Chat message | Dismissible banner |
| Validation | Browser bubble or none | Inline messages |
| Focus ring | Yellow, low contrast | Indigo, AA contrast |
| Student dashboard | None | Dialog from *My progress* |
| Breakpoints | One, at 900 px | Three |
