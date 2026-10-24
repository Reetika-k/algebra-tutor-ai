#!/usr/bin/env node
// Build reports/dashboard.html for AlgebraTutor AI from recorded files only:
//   tests/results/scenarios-*.json   every scenario run (provider, model, prompt version, per-scenario status, timing)
//   tests/results/unit-latest.tap    the latest unit-test run (node --test --test-reporter=tap)
//   src/topics.js                    the syllabus the tutor covers
//   src/config.js                    how the model provider is chosen
//   docs/TESTING.md                  the findings-and-fixes tables (F1…, R1…)
//   docs/screenshots/*.png           a few screens, embedded
// No dependencies, no network, nothing estimated: a missing input makes its section say so.
// Usage: npm run dashboard   (writes reports/dashboard.html, self-contained)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...parts) => path.join(root, ...parts);
const exists = (f) => fs.existsSync(f);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------- inputs ----------

const runs = exists(p("tests/results"))
  ? fs.readdirSync(p("tests/results")).filter((f) => f.startsWith("scenarios-") && f.endsWith(".json")).sort().map((f) => {
      const r = JSON.parse(fs.readFileSync(p("tests/results", f), "utf8"));
      const stamp = f.match(/(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})/);
      const when = stamp ? `${stamp[1]} ${stamp[2]}:${stamp[3]}` : f;
      const results = r.results || [];
      const pass = results.filter((e) => e.status === "PASS").length;
      const timeouts = results.filter((e) => e.status !== "PASS" && /timeout|aborted|timed out/i.test(`${e.actual} ${e.notes}`)).length;
      return { file: f, when, provider: r.provider, model: r.model, prompt: r.promptVersion, app: r.appVersion, results, pass, total: results.length, seconds: Math.round(results.reduce((s, e) => s + (e.ms || 0), 0) / 1000), timeouts, full: results.length >= 19 };
    })
  : [];
const latestFull = [...runs].reverse().find((r) => r.full);

const tapPath = p("tests/results/unit-latest.tap");
let unit = null;
if (exists(tapPath)) {
  const tap = fs.readFileSync(tapPath, "utf8");
  const num = (k) => Number((tap.match(new RegExp(`^# ${k} (\\S+)`, "m")) || [])[1] || 0);
  unit = {
    tests: num("tests"), pass: num("pass"), fail: num("fail"), ms: Math.round(num("duration_ms")),
    names: [...tap.matchAll(/^ok \d+ - (.+)$/gm)].map((m) => m[1]),
    when: fs.statSync(tapPath).mtime.toISOString().slice(0, 16).replace("T", " "),
  };
}

const { TOPICS } = exists(p("src/topics.js")) ? await import(pathToFileURL(p("src/topics.js")).href) : { TOPICS: [] };

const testingMd = exists(p("docs/TESTING.md")) ? fs.readFileSync(p("docs/TESTING.md"), "utf8") : "";
const findings = [...testingMd.matchAll(/^\| ((?:F|R)\d+) \| ([^|]+)\|([^\n]*)$/gm)].map((m) => {
  const cells = m[3].split("|").map((c) => c.trim()).filter(Boolean);
  return { id: m[1], problem: m[2].trim(), type: cells.length >= 2 ? cells[cells.length - 1] : "" };
});

const shots = ["p2-setup-desktop.png", "p3-feedback-desktop.png", "p5-reveal-desktop.png", "p4-dashboard-desktop.png"].filter((f) => exists(p("docs/screenshots", f)));
const img = (f) => `<img src="data:image/png;base64,${fs.readFileSync(p("docs/screenshots", f)).toString("base64")}" alt="${esc(f)}">`;

// ---------- tiny SVG charts ----------

function bars(items, { height = 170, barW = 44, gap = 18, max = 1, fmt = (v) => v, colours = () => "#36e4ff" } = {}) {
  const w = items.length * (barW + gap) + gap;
  const top = 26, bottom = 46, h = height - top - bottom;
  const rects = items.map((it, i) => {
    const x = gap + i * (barW + gap);
    const bh = Math.max(1, Math.round((it.value / max) * h));
    const y = top + h - bh;
    return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="5" fill="${colours(it)}"/>
      <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="11" fill="#e8eeff">${esc(fmt(it.value, it))}</text>
      <text x="${x + barW / 2}" y="${top + h + 16}" text-anchor="middle" font-size="10" fill="#8a94b8">${esc(it.label)}</text>
      ${it.sub ? `<text x="${x + barW / 2}" y="${top + h + 30}" text-anchor="middle" font-size="9" fill="#8a94b8">${esc(it.sub)}</text>` : ""}`;
  });
  return `<svg viewBox="0 0 ${w} ${height}" width="${w}" height="${height}" role="img"><rect width="${w}" height="${height}" fill="#1a2240" rx="10"/>${rects.join("")}</svg>`;
}

function hbars(items, { max = 1, fmt = (v) => v, colour = "#8f6eff", rowH = 20, labelW = 250, width = 820 } = {}) {
  const barMax = width - labelW - 80;
  const rows = items.map((it, i) => {
    const y = 10 + i * rowH;
    const bw = Math.max(2, Math.round((it.value / max) * barMax));
    return `<text x="${labelW - 8}" y="${y + 13}" text-anchor="end" font-size="11" fill="#e8eeff">${esc(it.label)}</text>
      <rect x="${labelW}" y="${y + 2}" width="${bw}" height="${rowH - 6}" rx="4" fill="${colour}"/>
      <text x="${labelW + bw + 6}" y="${y + 13}" font-size="11" fill="#8a94b8">${esc(fmt(it.value, it))}</text>`;
  });
  const h = 20 + items.length * rowH;
  return `<svg viewBox="0 0 ${width} ${h}" width="${width}" height="${h}" role="img"><rect width="${width}" height="${h}" fill="#1a2240" rx="10"/>${rows.join("")}</svg>`;
}

const table = (head, rows) => `<div class="scroll"><table><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table></div>`;
const status = (s) => (s === "PASS" ? `<span class="ok">PASS</span>` : s === "FAIL" ? `<span class="bad">FAIL</span>` : `<span class="muted">—</span>`);

// ---------- sections ----------

const parts = [];
const stamp = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
parts.push(`<h1>AlgebraTutor AI — Quality dashboard</h1><p class="sub">What the tutor covers, which model answered in every recorded test, how the scenario suite evolved across prompt versions, what the unit tests pin down, and what is still untested. Generated ${stamp} from recorded files only.</p>`);

// overview
const classes = [...new Set(TOPICS.map((t) => t.classLevel))];
const chapters = [...new Set(TOPICS.map((t) => t.chapter))];
const stats = [
  ["topics", TOPICS.length], ["chapters / classes", `${chapters.length} / ${classes.length}`],
  ["unit tests", unit ? `${unit.pass}/${unit.tests}` : "not run"],
  ["latest full scenario run", latestFull ? `${latestFull.pass}/${latestFull.total}` : "none"],
  ["model in every recorded run", runs.length ? [...new Set(runs.map((r) => `${r.provider} · ${r.model}`))].join(", ") : "—"],
  ["Claude path measured live", "no"],
];
parts.push(`<div class="grid">${stats.map(([k, v]) => `<div class="card stat"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join("")}</div>`);

// 1 syllabus
parts.push(`<h2>1. What the tutor covers</h2>`);
if (TOPICS.length) {
  parts.push(`<p>Everything outside these topics is refused by the system prompt and checked by scenarios S03 and S10. Each topic declares how answers are graded (<code>answerType</code>): a number, a pair (x, y), any solution of a two-variable equation, or two roots with partial credit for one.</p>`
    + table(["class", "chapter", "topic id", "kind", "answer type"], TOPICS.map((t) => [t.classLevel, esc(t.chapter), `<code>${esc(t.id)}</code>`, esc(t.kind), esc(t.answerType)])));
} else parts.push(`<p class="muted">src/topics.js not found.</p>`);

// 2 provider
parts.push(`<h2>2. Which model answers</h2>`);
parts.push(`<div class="card"><b>Provider rule</b> (<code>src/config.js</code>): <code>LLM_PROVIDER</code> if set; otherwise <b>Claude</b> (<code>claude-opus-5</code>) when <code>ANTHROPIC_API_KEY</code> is present, else <b>Ollama</b> with <code>qwen2:7b</code> locally. `
  + `Every recorded scenario run below was produced by <b>${runs.length ? [...new Set(runs.map((r) => `${r.provider} · ${r.model}`))].join(", ") : "—"}</b>: no API key was available on the development machine. The Claude path uses only documented SDK calls but has not been exercised live; the first action after adding a key should be <code>npm run test:scenarios</code>. Local-model latency in the latest full run: see section 5.</div>`);

// 3 scenario runs
parts.push(`<h2>3. Scenario suite across prompt versions</h2>`);
if (runs.length) {
  const items = runs.map((r) => ({ label: r.when.slice(5), sub: `v${r.prompt}${r.app ? " · " + r.app : ""}${r.full ? "" : " · targeted"}`, value: r.pass / Math.max(1, r.total), run: r }));
  parts.push(`<p>One bar per recorded run (<code>tests/results/</code>), in time order. Full runs cover every scenario; targeted runs re-ran only the scenarios named in <code>docs/TESTING.md</code> after a fix or a timeout. The void run on 2026-10-05 is kept as a record of an infrastructure failure: ${runs.find((r) => r.timeouts >= 10)?.timeouts ?? 0} local-model timeouts, not app defects.</p>`
    + bars(items, { max: 1, fmt: (v, it) => `${it.run.pass}/${it.run.total}`, colours: (it) => (it.run.timeouts >= 10 ? "#ff385c" : it.run.full ? "#36e4ff" : "#18e0aa") })
    + table(["run", "prompt", "app", "scenarios", "passed", "timeouts", "wall time", "file"], runs.map((r) => [esc(r.when), esc(r.prompt), esc(r.app || "0.1.0"), r.total, `${r.pass} (${Math.round((100 * r.pass) / Math.max(1, r.total))} %)`, r.timeouts || "", `${r.seconds} s`, `<code>${esc(r.file)}</code>`])));
  // matrix
  const ids = [...new Set(runs.flatMap((r) => r.results.map((e) => e.id)))].sort();
  const cat = Object.fromEntries(runs.flatMap((r) => r.results.map((e) => [e.id, e.category])));
  parts.push(`<p style="margin-top:14px"><b>Every scenario in every run.</b> Columns are the runs above (date and prompt version); a dash means the scenario was not part of that run.</p>`
    + table(["scenario", ...runs.map((r) => `${r.when.slice(5)}<br>v${r.prompt}`)], ids.map((id) => [`<b>${esc(id)}</b> ${esc(cat[id])}`, ...runs.map((r) => status(r.results.find((e) => e.id === id)?.status))])));
  summaryNote("runs");
} else parts.push(`<p class="muted">No scenario reports in tests/results/: run <code>npm run test:scenarios</code>.</p>`);

// 4 learner behaviours (PDF step 10)
parts.push(`<h2>4. The seven learner behaviours the brief asks to test</h2>`);
if (runs.length) {
  const latestStatus = (id) => { for (const r of [...runs].reverse()) { const e = r.results.find((x) => x.id === id); if (e) return { st: e.status, run: r }; } return { st: "—" }; };
  const map = [["Correct answers", "S09"], ["Incorrect answers", "S07, S08"], ["Unrelated questions", "S03"], ["Very easy questions", "S04"], ["Difficult questions", "S05"], ["Spelling mistakes", "S02"], ["Requests for direct answers", "S06"], ["Normal question", "S01"], ["Prompt injection", "S10, S11"], ["Classes 9–10 answer types", "S20, S21, S22"]];
  parts.push(table(["behaviour", "scenarios", "latest recorded status"], map.map(([b, ids]) => [esc(b), esc(ids), ids.split(", ").map((id) => { const { st, run } = latestStatus(id); return `${esc(id)} ${status(st)}${run ? ` <span class="muted">(${esc(run.when.slice(5))})</span>` : ""}`; }).join("<br>")])));
}

// 5 latency
parts.push(`<h2>5. Latency per scenario (latest full run)</h2>`);
if (latestFull) {
  const items = latestFull.results.map((e) => ({ label: `${e.id} ${e.category}`, value: (e.ms || 0) / 1000 }));
  parts.push(`<p>Wall-clock seconds per scenario with <b>${esc(latestFull.provider)} · ${esc(latestFull.model)}</b> on the development laptop (${esc(latestFull.when)}). Scenarios near zero never call the model (guards and validation). S17 and S18 generate several questions each; S06–S08 share one generated question.</p>`
    + hbars(items, { max: Math.max(...items.map((i) => i.value)), fmt: (v) => `${v.toFixed(1)} s` }));
} else parts.push(`<p class="muted">No full run recorded.</p>`);

// 6 unit tests
parts.push(`<h2>6. What the unit tests pin down (no model involved)</h2>`);
if (unit) {
  parts.push(`<div class="card"><b>${unit.pass} of ${unit.tests} passed</b>, ${unit.fail} failed, ${unit.ms} ms, run ${esc(unit.when)} (<code>tests/results/unit-latest.tap</code>; regenerate with <code>npm run test:tap</code>). These are deterministic checks of the parts that must not depend on a model: expression evaluation, answer parsing and grading, request validation, prompt assembly, the answer-leak scrubber, the LaTeX sanitizer, topic-shape and consistency checks, the override guard, and the tutor logic against a fake model.</div>`
    + `<details><summary>${unit.names.length} top-level test names from the run</summary><ul>${unit.names.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></details>`);
} else parts.push(`<p class="muted">No unit-test record: run <code>npm run test:tap</code>.</p>`);

// 7 findings
parts.push(`<h2>7. Findings and fixes recorded during testing</h2>`);
if (findings.length) {
  const byType = {};
  for (const f of findings) byType[f.type || "—"] = (byType[f.type || "—"] || 0) + 1;
  parts.push(`<p>${findings.length} findings in <code>docs/TESTING.md</code> (F = scenario and smoke runs, R = code review and browser runs), each with its cause and fix there. By type: ${Object.entries(byType).map(([k, v]) => `<code>${esc(k)}</code> ×${v}`).join(", ")}.</p>`
    + table(["id", "problem (as recorded)", "type"], findings.map((f) => [`<b>${esc(f.id)}</b>`, esc(f.problem), esc(f.type)])));
} else parts.push(`<p class="muted">docs/TESTING.md not found.</p>`);

// 8 screens
parts.push(`<h2>8. Screens</h2>`);
parts.push(shots.length ? `<p>Setup, Practice and a feedback card, from <code>docs/screenshots/</code>.</p>${shots.map(img).join("")}` : `<p class="muted">No screenshots found.</p>`);

// 9 limitations
parts.push(`<h2>9. Limitations</h2><div class="card"><ul>
<li>Every AI result here comes from the local <code>qwen2:7b</code> model; the Claude provider path has not been exercised live. Results are per provider and never mixed.</li>
<li>One run per version: scenario outcomes vary between runs with a sampled model (reply length, off-topic drift), so single-run pass rates are indicative, not precise.</li>
<li>Scenario checks are automated assertions on structure and content; the quality of an explanation beyond those checks is a human judgement (see the demo script).</li>
<li>Latencies are local-laptop figures for a 7B model and say nothing about the hosted Claude path.</li>
</ul></div>`);
parts.push(`<h2>Reproduce</h2><div class="card"><code>npm test</code> → <code>npm run test:tap</code> (records the unit run) → <code>npm run test:scenarios</code> (needs a model; writes <code>tests/results/</code>) → <code>npm run dashboard</code>. This file embeds its figures and screenshots.</div>`);

function summaryNote() {}

// ---------- write ----------

const css = `
body{margin:0;background:#0f1428;color:#e8eeff;font:15px/1.55 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif}
main{max-width:1080px;margin:0 auto;padding:32px 20px 60px}
h1{font-size:30px;margin:0 0 4px}h2{font-size:21px;margin:40px 0 10px;border-bottom:1px solid #2e3860;padding-bottom:6px}
.sub{color:#8a94b8;margin:0 0 18px}.card{background:#1a2240;border:1px solid #2e3860;border-radius:12px;padding:16px 18px;margin:12px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.stat b{display:block;font-size:22px}
.stat span{color:#8a94b8;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
img{max-width:100%;height:auto;border-radius:10px;border:1px solid #2e3860;margin:8px 0}svg{max-width:100%;height:auto;margin:8px 0}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13.5px}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #2e3860;vertical-align:top}
th{color:#8a94b8;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.06em}
.ok{color:#18e0aa;font-weight:700}.bad{color:#ff385c;font-weight:700}.muted{color:#8a94b8}
code{background:#0b1020;padding:2px 6px;border-radius:6px;font-size:13px}details{margin:8px 0}summary{cursor:pointer;color:#8a94b8}
`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AlgebraTutor AI — Quality dashboard</title><style>${css}</style></head><body><main>${parts.join("")}</main></body></html>`;
fs.mkdirSync(p("reports"), { recursive: true });
fs.writeFileSync(p("reports/dashboard.html"), html);
console.log(`dashboard: reports/dashboard.html (${(html.length / 1e6).toFixed(2)} MB) · runs ${runs.length} · unit ${unit ? `${unit.pass}/${unit.tests}` : "none"} · topics ${TOPICS.length} · findings ${findings.length} · screenshots ${shots.length}`);
