# UI/UX design – AlgebraTutor AI

A senior-designer pass on the working prototype. Backend, prompts and app logic are unchanged; this is presentation, layout, hierarchy and feedback. It shares a visual family with the second capstone project (Equation Catcher): the same orange mark, Fredoka/Nunito type and token scale, on a light, calm surface suited to long study sessions.

## 1. Audit of the first version

| Problem | Why it matters |
|---|---|
| Setup is a lone form; nothing explains what the tutor does or why level matters | First impression is "a form", not "a tutor"; no motivation to fill it in |
| Topic is a plain `<select>` | The seven topics are the syllabus; hidden in a dropdown they cannot be compared or scanned |
| Chat area is a large empty grey box with one line of text in Practice | Empty state gives no direction; the primary action ("New question") sits far away in a small outline button |
| Tutor and student messages differ only by alignment and colour | No identity for the tutor; a question card and a feedback card look like ordinary messages |
| Progress panel: two bare numbers and "none yet" chips | Accuracy, the number that matters, is never shown; per-topic numbers are text rows |
| Provider badge is raw text ("ollama · qwen2:7b") | Reads as debug output; readiness problems are not visible |
| On a phone the progress panel pushes the chat below the fold | The chat is the product; the panel should collapse |

## 2. Goals and principles

1. **Conversation first.** The chat column is the hero; everything else is secondary and collapsible.
2. **Teach through hierarchy.** Questions, hints and solutions are distinct cards, not messages; verdicts are colour-coded chips.
3. **Make progress tangible.** An accuracy ring and per-topic bars, updated after every answer.
4. **Explain the modes.** Each tab has an icon and a one-line description so a 13-year-old knows what will happen.
5. **Consistency with the game.** Same mark, type and tokens, so the two capstone projects read as one body of work.
6. **Accessible by default.** Focus rings, labels, live regions, 44 px targets, reduced motion.

## 3. Design system

| Token group | Values |
|---|---|
| Colour – canvas | `#f4f6fb` with two faint radial tints (indigo, orange) |
| Colour – surfaces | white, `#f6f8fd`, `#eceff8`; line `#dfe5f1` |
| Colour – ink | `#1b2340`, `#4b5675`, `#7c86a3` |
| Colour – primary | indigo `#4353d9` (actions, student bubbles, active tab), `#3242b8` pressed, `#e8ebfb` tint |
| Colour – accent | orange `#ff7a1a` for the tutor identity (mark, avatar, level pill) |
| Colour – semantic | success `#1aa36b`, warning `#d98b00`, danger `#e23d4f`, each with a 100-tint for chips and blocks |
| Type | Fredoka 500–700 for titles, numbers, equations, verdict chips; Nunito 500–800 for text |
| Spacing | 4 · 8 · 12 · 16 · 20 · 24 |
| Radius | 10 (inputs, chips) · 16 (cards, bubbles) · 22 (page cards) |
| Elevation | shadow-1 cards and bubbles; shadow-2 the setup card |
| Motion | 120 ms buttons, 500 ms ring fill, typing dots; all off under `prefers-reduced-motion` |

## 4. Layout

```
Desktop (> 900 px)                                      Phone (≤ 900 px)
┌──────────────────────────────────────────────────┐    ┌──────────────────────┐
│ ⬢ AlgebraTutor AI · subtitle    ● Local model  Start over │    │ ⬢ AlgebraTutor  ● · Start over │
├───────────────────────────────┬──────────────────┤    ├──────────────────────┤
│ 📖 Learn ✏️ Practice 🏁 Quiz 💬 │ Hi, Asha  [Beginner] │    │ Your session 3·2  ▾  │  ← collapsible rail
│ mode description              │ Topic ▾          │    ├──────────────────────┤
│                               ├──────────────────┤    │ 📖 ✏️ 🏁 💬 tabs      │
│  AT ▢ tutor message           │ ◔ 67%  3 attempted│    │ mode description     │
│            student bubble ▢   │        2 correct │    │                      │
│  AT ▢ QUESTION card           │ topic bars       │    │  chat                │
│  AT ▢ feedback card           │ strong / needs   │    │                      │
│ [New question]                │ [End session]    │    │ [actions]            │
│ [ message…            Send ↑ ]│ summary card     │    │ [ message…   Send ↑ ]│
└───────────────────────────────┴──────────────────┘    └──────────────────────┘
```

Setup is a two-column hero on desktop (value proposition left, numbered 3-step form right: name → level cards → topic cards) and a single column on phones.

## 5. Components

| Component | Spec |
|---|---|
| Top bar | Sticky, translucent; mark + title + subtitle; status pill with a green/amber dot ("Local model · qwen2:7b", "Claude · claude-opus-5", "not configured"); Start over |
| Level card | Radio card with title and one-line description; selected state = indigo border + tint |
| Class tabs + topic card | Segmented Class 8 / 9 / 10 tabs filter a 2-column grid of radio cards grouped by NCERT chapter: topic name + example form in display type |
| Mode tabs | Underline tabs with icons; the active tab's description appears in a strip beneath |
| Tutor message | Orange "AT" avatar + soft grey bubble; student messages are indigo bubbles on the right |
| Question card | White card, indigo left rule, small caps label ("Question · Two-step equations"), equation in 22 px Fredoka |
| Feedback card | Left rule and verdict chip coloured by result (green Correct / red Not yet · n attempts left / amber I need a number); amber "Hint:" block; grey "Solution:" block in display type; italic encouragement |
| Typing indicator | Avatar + three bouncing dots |
| Action pills | Indigo-tint pills for New question / Start quiz / Next question |
| Composer | Full-width input with indigo Send button; sticky at the bottom of the tutor column |
| Session card | Avatar, greeting, level pill, topic switch |
| Progress card | Accuracy ring (84 px), attempted / correct-first-try, per-topic bars, strong / needs-practice chips, End session, summary card with "Study X now" |
| Rail toggle (phone) | One-line summary "Your session · 3 attempted · 2 correct ▾" that expands the rail |

## 6. States

| State | What the learner sees |
|---|---|
| First visit | Hero + 3-step setup; Start learning |
| Returning (saved profile) | Straight into Learn with the lesson opener |
| Learn | Opener message, then conversation; composer placeholder "Ask a question or reply to the tutor…" |
| Practice, no question | Intro message + "New question" pill |
| Practice, answering | Question card; verdict cards after each answer with attempts left; "Next question" after reveal |
| Quiz | "Question n of 5" cards, solution after each answer, score message, "Start another quiz" |
| Waiting on the model | Typing indicator; composer and actions disabled |
| Error | Centred red message with the server's explanation; a "New question" pill when a question expired |
| Session summary | Indigo-tinted card with counts, needs-improvement, recommended next lesson, tips, "Study X now" |
| Provider not configured | Amber status dot and the text "not configured (set ANTHROPIC_API_KEY)" |

## 7. Accessibility

- Contrast: ink on white ≥ 12:1; ink-3 labels 4.6:1; white on indigo buttons 7.4:1; verdict chips use dark text tints.
- Visible focus rings on every control; the chat is an `aria-live="polite"` region; inputs have labels; the rail toggle exposes `aria-expanded`.
- Touch targets ≥ 44 px; the composer stays reachable on phones.
- All animation (typing dots, ring fill, button lift) is disabled under `prefers-reduced-motion`.

## 8. Before / after

- Before: `docs/screenshots/01-setup.png`, `02-practice.png`, `03-narrow-quiz.png`.
- After: `04-setup-desktop.png`, `05-practice-desktop.png`, `06-practice-phone.png`, `07-feedback-desktop.png` (question card, student bubble, feedback card with verdict chip and hint block), `08-setup-classes.png` (class selector with chapter-grouped topic cards).
