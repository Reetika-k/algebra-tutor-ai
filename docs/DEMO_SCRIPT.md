# Demo script (about 6 minutes)

Follows the eight-step demonstration suggested in the Capstone PDF (Section 6 of Project 1).
Open the deployed URL (or `http://localhost:3000`) before starting so the first request is warm.

| Step | PDF step | What to do | What to say |
|---|---|---|---|
| 1 | Choose a learner level | Enter a name, pick **Beginner** | "The profile drives the prompt: level changes number size, hint density and explanation depth." |
| 2 | Select a topic | Pick **Two-step equations**, click **Start learning** | "The tutor is scoped to one chapter and seven topics; everything outside it is politely refused." |
| 3 | Ask the tutor to explain | Watch the Learn opener; then ask "why do we subtract from both sides?" | "This is Learn mode: persona + topic + level + mode layers make up the system prompt." |
| 4 | Attempt a practice problem | Open **Practice**, click **New question** | "Questions are generated live as JSON. The server checks that the stated answer satisfies the stated equation and that the shape matches the topic; bad items are discarded." |
| 5 | Give an incorrect answer | Type a wrong value, e.g. `x = 100` | "The verdict comes from a deterministic comparison, not from the model. The model only writes the feedback, and it may not reveal the answer yet." |
| 6 | Show how AI provides guidance | Type `just tell me the answer`; then answer wrong again | "Hints before answers, up to three attempts; the app scrubs any leaked answer and only reveals the worked solution after the last attempt." |
| 7 | Complete a short quiz | Open **Quiz**, **Start quiz**, answer five questions (mix right and wrong) | "One attempt per question, immediate solution, running score; every answer updates the profile on the right." |
| 8 | Show personalized feedback | Point at **Strong areas / Needs practice**, click **End session & get recommendation** | "Strengths and weaknesses are computed from the counts; the model turns them into a recommendation and picks the next topic from the fixed list." |

Optional extras if there is time:

- **Ask a Doubt** with a spelling-mistake question ("wat is a lineer equashun") and an off-topic one ("who won the cricket world cup?") to show robustness.
- Show the **provider badge** in the header and mention the offline mode used during development.
- Open `docs/TESTING.md` and point at a failure that was fixed by a prompt iteration.
