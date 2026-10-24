// Drives the real setup form: empty submit shows the inline error; Class 9 tab updates the note; submit opens the workspace.
// Usage: start the app and headless Chrome as for tests/e2e-browser.mjs, then: node tests/setup-check-browser.mjs [baseUrl]
const base = process.argv[2] || "http://localhost:3000";
const t = await (await fetch(`http://localhost:9333/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const P = new Map(); const errs = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && P.has(m.id)) { P.get(m.id)(m); P.delete(m.id); } if (m.method === "Runtime.exceptionThrown") errs.push(m.params.exceptionDetails.text); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; P.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (x) => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable"); await send("Page.navigate", { url: base }); await sleep(1500);
await ev(`localStorage.clear()`); await send("Page.navigate", { url: base }); await sleep(1500);
const out = [];
const chk = (n, ok, d = "") => { out.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); };
chk("default starting topic is first of Class 8", await ev(`document.querySelector("input[name=topic]:checked").value === "one-step" && document.querySelector(".topic-start")?.closest("label").querySelector("input").value === "one-step"`));
chk("note names the default topic", true, await ev(`document.querySelector("#topic-note").textContent`));
await ev(`document.querySelector("#setup-form").requestSubmit()`); await sleep(200);
chk("empty name blocked with inline error", await ev(`!document.querySelector("#name-error").classList.contains("hidden") && document.querySelector("#app").classList.contains("hidden")`));
await ev(`document.querySelector('#class-tabs button[data-class="9"]').click()`); await sleep(200);
chk("Class 9 tab pre-selects its first topic and updates note", await ev(`document.querySelector("input[name=topic]:checked").closest("label").querySelector(".topic-start") !== null && /Class 9 begins/.test(document.querySelector("#topic-note").textContent)`), await ev(`document.querySelector("#topic-note").textContent`));
await ev(`(() => { const n = document.querySelector("#name"); n.value = "Ravi"; n.dispatchEvent(new Event("input")); document.querySelector('input[name=topic][value="system-solve"]')?.closest("label") ; document.querySelector('#class-tabs button[data-class="10"]').click(); document.querySelector('input[name=topic][value="quad-solve"]').click(); document.querySelector("#setup-form").requestSubmit(); })()`);
await sleep(800);
chk("submit opens workspace with chosen topic", await ev(`!document.querySelector("#app").classList.contains("hidden") && document.querySelector("#topic-switch").value === "quad-solve" && document.querySelector("#learner-name").textContent === "Ravi"`));
chk("no page errors", errs.length === 0, errs.join(" | "));
console.log(`${out.filter(Boolean).length} / ${out.length} setup checks passed`);
ws.close(); process.exit(0);
