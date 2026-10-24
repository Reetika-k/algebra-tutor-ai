# Demo script (about 8 minutes)

Follows the eight-step demonstration suggested in the Capstone PDF (Section 6 of Project 1), with the October 2026 enhancements shown along the way.
Open the deployed URL (or `http://localhost:3000`) before starting so the first request is warm. On the local model, start the quiz in step 7 a minute early: five questions take one to two minutes to prepare.

| Step | PDF step | What to do | What to say |
|---|---|---|---|
| 1 | Choose a learner level | Enter a name, pick **Beginner** | "The profile drives the prompt: level changes number size, hint density and explanation depth." |
| 2 | Select a topic | Under "Where do you want to start?", keep Class 8 and pick **Two-step equations**; click **Start learning** | "This is only a starting point; the topic can be switched any time. The tutor covers the four NCERT equation chapters of Classes 8 to 10 and refuses everything else." |
| 3 | Ask the tutor to explain | Watch the Learn opener; press **Show a worked example** and step through it with **Next step** | "The lesson comes from the model. The worked example does not: the app writes each step and re-solves every line to check it keeps the same answer, then draws it as a balance scale that stays level." |
| 4 | Attempt a practice problem | Open **Practice**, click **New question**, then **Get a hint** | "Questions are generated live and checked by the app. The first hint names the idea only, and it uses no attempt." |
| 5 | Give an incorrect answer | Open **Show your working**, type a wrong line such as `2x = 20 + 6`, answer with the matching wrong value | "The verdict is computed, not judged by the model. When exactly one known mistake explains the number, the card says *Likely mistake*, and the tutor can point at the line in the working." |
| 6 | Show how AI provides guidance | Type `just tell me the answer`; then answer wrong again | "Hints climb: the idea, then the next step, then the solution after the last attempt. A repeated hint is replaced, and the answer is never leaked early. After the reveal, open the balance scale." |
| 7 | Complete a short quiz | Open **Quiz**; show **Mixed revision**, then **Cancel**; **Start quiz** and answer the questions (mix right and wrong) | "One attempt per question and the solution straight away. Mixed revision spreads five questions over two to five topics, and each answer counts towards its own topic." |
| 8 | Show personalized feedback | Click **End session & get recommendation**; then open **My progress** | "Today's numbers are on the right. The dashboard uses everything saved in this browser: status per topic, recent sessions and the next step, with a reason built from the student's own numbers, by rules anyone can check." |

Optional extras if there is time:

- **Ask a Doubt** with a spelling-mistake question ("wat is a lineer equashun") and an off-topic one ("who won the cricket world cup?") to show robustness.
- **Reliability**: stop Ollama (or start without a key) and reload. A banner says the model is unavailable and what still works (hints, worked examples, the dashboard); a failed request shows a plain message with **Try again**, never a server address.
- Show the **provider badge** in the header and mention the offline mode used during development.
- Open `docs/TESTING.md` and point at a failure that was fixed by a prompt iteration or a guard in code.
