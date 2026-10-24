// Transparent recommendation rules (docs/ENHANCEMENT_PLAN.md, Phase 4). No model and no learned weights:
// every recommendation comes from first-attempt counts per topic, and carries a one-sentence reason
// built from those numbers, so a student or teacher can check it.
//
// Per topic, from first-attempt accuracy:
//   fewer than 3 answers             → "insufficient" (no judgement yet)
//   3+ answers and under 50 %        → "struggling"
//   4+ answers and 80 % or more      → "mastered"
//   otherwise                        → "developing"
// Choice of next step, in order:
//   1. A struggling topic (the weakest one) comes first. If its prerequisite has been practised and is not
//      secure (under 80 %), review the prerequisite. Otherwise practise the same topic with easier questions,
//      naming the prerequisite as the fallback. (A prerequisite with no answers is not recommended on zero evidence.)
//   2. Otherwise, for the current topic: insufficient → keep going; mastered → harder questions, and after
//      8+ answers the next topic in syllabus order; developing → keep going at this level.

import { TOPIC_IDS, getTopic, prerequisiteOf } from "./topics.js";

export const MIN_ANSWERS = 3;
export const STRUGGLING_BELOW = 0.5;
export const MASTERED_FROM = 0.8;
export const MASTERED_MIN_ANSWERS = 4;
export const MOVE_ON_AFTER = 8;
const SECURE_FROM = 0.8;

const name = (id) => getTopic(id)?.name ?? id;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Status of one topic from its first-attempt counts. */
export function topicStatus({ attempted = 0, correct = 0 } = {}) {
  if (attempted < MIN_ANSWERS) return "insufficient";
  const rate = correct / attempted;
  if (rate < STRUGGLING_BELOW) return "struggling";
  if (attempted >= MASTERED_MIN_ANSWERS && rate >= MASTERED_FROM) return "mastered";
  return "developing";
}

/**
 * Recommend the next step from saved first-attempt counts.
 * @param {{ byTopic: Record<string, {attempted:number, correct:number}> }} stats
 * @param {string} currentTopic the topic the student is on now
 * @returns {{ nextTopicId, adaptation, difficultyBias, reason, insufficientData, perTopic }}
 *   adaptation: "prerequisite" | "ease" | "stretch" | "next" | "hold" | "start"
 *   difficultyBias: "easier" | "normal" | "harder"
 */
export function recommend(stats, currentTopic) {
  const byTopic = Object.fromEntries(Object.entries(stats?.byTopic || {}).filter(([id, s]) => TOPIC_IDS.includes(id) && s?.attempted > 0));
  const perTopic = Object.fromEntries(Object.entries(byTopic).map(([id, s]) => [id, { attempted: s.attempted, correct: s.correct, rate: s.correct / s.attempted, status: topicStatus(s) }]));
  const insufficientData = TOPIC_IDS.filter((id) => perTopic[id]?.status === "insufficient");
  const counts = (id) => `${byTopic[id].correct} of ${byTopic[id].attempted}`;
  const out = (nextTopicId, adaptation, difficultyBias, reason) => ({ nextTopicId, adaptation, difficultyBias, reason, insufficientData, perTopic });

  // 1. Weakest struggling topic first (lowest rate, then more answers, then syllabus order).
  const struggling = TOPIC_IDS.filter((id) => perTopic[id]?.status === "struggling")
    .sort((a, b) => perTopic[a].rate - perTopic[b].rate || perTopic[b].attempted - perTopic[a].attempted);
  if (struggling.length) {
    const t = struggling[0];
    const p = prerequisiteOf(t);
    const pStats = p ? byTopic[p] : null;
    if (p && pStats && pStats.correct / pStats.attempted < SECURE_FROM) {
      return out(p, "prerequisite", "normal",
        `You got ${counts(t)} right first time on ${name(t)}, and ${name(p)}, which it builds on, is not secure yet (${counts(p)}), so review ${name(p)} first.`);
    }
    return out(t, "ease", "easier",
      `You got ${counts(t)} right first time on ${name(t)}, so practise it with easier questions${p ? `; if they still feel hard, review ${name(p)} first` : ""}.`);
  }

  // 2. Otherwise judge the current topic.
  const t = TOPIC_IDS.includes(currentTopic) ? currentTopic : TOPIC_IDS[0];
  const s = perTopic[t];
  if (!s || s.status === "insufficient") {
    const have = s?.attempted ?? 0;
    return out(t, "start", "normal",
      `Answer at least ${MIN_ANSWERS} questions on ${name(t)} (${have} so far) before I suggest a change.`);
  }
  if (s.status === "mastered") {
    const i = TOPIC_IDS.indexOf(t);
    const next = TOPIC_IDS[i + 1];
    if (s.attempted >= MOVE_ON_AFTER && next) {
      return out(next, "next", "normal", `You got ${counts(t)} right first time on ${name(t)}, so you are ready for ${name(next)}.`);
    }
    return out(t, "stretch", "harder",
      `You got ${counts(t)} right first time on ${name(t)}, so try harder questions on it${next ? ` before moving on to ${name(next)}` : ""}.`);
  }
  // developing
  if (s.rate >= MASTERED_FROM) {
    const more = MASTERED_MIN_ANSWERS - s.attempted;
    return out(t, "hold", "normal", `You got ${counts(t)} right first time on ${name(t)}; ${plural(more, "more correct answer")} will confirm it before harder questions.`);
  }
  return out(t, "hold", "normal", `You got ${counts(t)} right first time on ${name(t)}; keep practising at this level until you get at least 4 out of 5 right.`);
}
