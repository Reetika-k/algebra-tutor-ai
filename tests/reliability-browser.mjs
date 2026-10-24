// Phase 6 browser check with the model unavailable (no model needed). Starts its own app on a free port with
// OLLAMA_URL pointing at a closed port, then drives headless Chrome over the DevTools protocol.
// Usage: start Chrome with --headless=new --remote-debugging-port=9333 --remote-allow-origins=*, then
//   node tests/reliability-browser.mjs [width]      (width defaults to 1440; use 390 for a phone)
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const width = Number(process.argv[2]) || 1440;
const mobile = width < 720;
const root = fileURLToPath(new URL("..", import.meta.url));
const PORT = 7000 + Math.floor(Math.random() * 900);
const base = `http://127.0.0.1:${PORT}`;
const server = spawn(process.execPath, ["server.js"], { cwd: root, env: { ...process.env, PORT: String(PORT), LLM_PROVIDER: "ollama", OLLAMA_URL: "http://127.0.0.1:9", ANTHROPIC_API_KEY: "" }, stdio: "ignore" });
for (let i = 0; i < 50; i++) { try { if ((await fetch(base + "/api/topics")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }

const target = await (await fetch(`http://localhost:9333/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const pageErrors = [];
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") pageErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") pageErrors.push(m.params.args.map((a) => a.value ?? a.description).join(" ")); };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
const waitFor = async (x, label, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(x)) return; await new Promise((r) => setTimeout(r, 200)); } throw new Error("timeout waiting for " + label); };
const results = []; const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + String(detail).replace(/\s+/g, " ").slice(0, 160) : ""}`); };
const leaks = (t) => /127\.0\.0\.1|localhost|11434|ECONNREFUSED|fetch failed|Cannot reach Ollama/i.test(t);

await send("Runtime.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width, height: mobile ? 844 : 900, deviceScaleFactor: 1, mobile });
await send("Page.navigate", { url: `${base}/?name=Asha&level=beginner&topic=two-step&mode=practice` });
try {
  await waitFor(`!document.querySelector("#app").classList.contains("hidden")`, "app");
  await waitFor(`!document.querySelector("#provider-banner").classList.contains("hidden")`, "provider banner");
  const banner = await ev(`document.querySelector("#provider-banner").innerText`);
  check("model down: banner says so and what still works", /not running/i.test(banner) && /still work/i.test(banner) && !leaks(banner), banner);
  check("model badge marked as a warning", await ev(`document.querySelector("#provider-badge").classList.contains("warn")`));

  await ev(`[...document.querySelectorAll("#actions button")].find((b) => b.textContent.includes("New question")).click()`);
  await waitFor(`!document.querySelector("#error-banner").classList.contains("hidden")`, "error banner", 20000);
  const err = await ev(`document.querySelector("#error-banner").innerText`);
  check("failed question shows a plain message with Try again, and no internal detail", /not responding/i.test(err) && !leaks(err) && await ev(`!document.querySelector("#error-retry").classList.contains("hidden")`), err);
  check("New question is offered again after the failure", await ev(`[...document.querySelectorAll("#actions button")].some((b) => b.textContent.includes("New question"))`));

  await ev(`document.querySelector("#error-retry").click()`);
  await waitFor(`!document.querySelector("#error-banner").classList.contains("hidden") && !document.querySelector(".skeleton")`, "retry result", 20000);
  check("Try again re-runs the request and reports the same failure cleanly", /not responding/i.test(await ev(`document.querySelector("#error-text").textContent`)));

  await ev(`document.querySelector('#tabs button[data-mode="learn"]').click()`);
  await waitFor(`!document.querySelector(".typing") && !document.querySelector("#error-banner").classList.contains("hidden")`, "lesson failure", 20000);
  check("Learn: the lesson fails cleanly, and no half-started lesson is left", await ev(`!document.querySelector("#chat .msg.system")`));
  await ev(`[...document.querySelectorAll("#actions button")].find((b) => b.textContent.includes("worked example")).click()`);
  await waitFor(`document.querySelector(".msg.stepscard svg.scale")`, "worked example");
  check("Learn: worked examples still work without the model", true, await ev(`document.querySelector(".msg.stepscard .qtext").textContent`));

  await ev(`document.querySelector("#open-progress").click()`);
  await waitFor(`document.querySelector("#dash-body").innerText.length > 10`, "dashboard");
  check("dashboard still opens", /No answers recorded yet|Your next step/.test(await ev(`document.querySelector("#dash-body").innerText`)));
  await ev(`document.querySelector("#progress-dialog").close()`);

  await ev(`document.querySelector('#tabs button[data-mode="practice"]').click()`);
  // Count the requests the page actually sends while the button is clicked three times in a row.
  await ev(`(() => { window.__q = 0; const f = window.fetch; window.fetch = (u, o) => { if (String(u).includes("/api/questions")) window.__q++; return f(u, o); }; return true; })()`);
  await ev(`(() => { const b = [...document.querySelectorAll("#actions button")].find((x) => x.textContent.includes("New question")); b.click(); b.click(); b.click(); return true; })()`);
  await waitFor(`!document.querySelector(".skeleton")`, "triple click settled", 20000);
  const sent = await ev(`window.__q`);
  check("triple-clicking New question sends one request, not three", sent === 1, `${sent} request(s)`);
} catch (e) {
  check("flow completed without exception", false, e.message);
}
check("no JavaScript errors in the page", pageErrors.length === 0, pageErrors.join(" | "));
console.log(`\n${results.filter(Boolean).length} / ${results.length} reliability checks passed (width ${width})`);
ws.close(); server.kill();
process.exit(results.every(Boolean) ? 0 : 1);
