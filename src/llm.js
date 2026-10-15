// LLM provider layer. Primary: Claude API via the official SDK. Fallback: local Ollama for offline development.
// Both expose the same two calls: complete() → text, completeJSON() → schema-validated object.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { config } from "./config.js";

export class LLMError extends Error {
  constructor(message, kind = "provider", status = 502) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

// ---------- Claude ----------

let anthropicClient = null;
function claude() {
  if (!anthropicClient) anthropicClient = new Anthropic(); // reads ANTHROPIC_API_KEY / auth profile
  return anthropicClient;
}

// Effort is not accepted by Haiku 4.5 / Sonnet 4.5-era models.
const supportsEffort = (model) => !/haiku-4-5|sonnet-4-5|opus-4-1|claude-3/.test(model);

// Adaptive thinking shares max_tokens with the visible reply, so give every request headroom for it.
const THINKING_HEADROOM = 6000;

function claudeParams({ system, messages, maxTokens, effort }) {
  const model = config.claude.model;
  const params = {
    model,
    max_tokens: maxTokens + THINKING_HEADROOM,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages,
  };
  if (supportsEffort(model)) params.output_config = { effort };
  return params;
}

function mapClaudeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return new LLMError("Claude API key is invalid. Check ANTHROPIC_API_KEY.", "auth", 503);
  if (err instanceof Anthropic.RateLimitError) return new LLMError("Claude API rate limit reached. Try again in a moment.", "rate", 429);
  if (err instanceof Anthropic.APIError) return new LLMError(`Claude API error ${err.status}: ${err.message}`, "provider", 502);
  // No API key/token in the environment and the request never reached the API: almost certainly missing credentials.
  if (!config.claude.configured) return new LLMError("Claude is not configured: set ANTHROPIC_API_KEY in .env (or use LLM_PROVIDER=ollama).", "auth", 503);
  return new LLMError(`Claude request failed: ${err.message}`, "provider", 502);
}

async function claudeComplete(args) {
  try {
    const res = await claude().messages.create(claudeParams(args));
    if (res.stop_reason === "refusal") throw new LLMError("The model declined this request.", "refusal", 502);
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return { text, truncated: res.stop_reason === "max_tokens", usage: res.usage, model: res.model };
  } catch (err) {
    throw err instanceof LLMError ? err : mapClaudeError(err);
  }
}

async function claudeCompleteJSON({ schema, ...args }) {
  try {
    const params = claudeParams(args);
    params.output_config = { ...(params.output_config || {}), format: zodOutputFormat(schema) };
    const res = await claude().messages.parse(params);
    if (res.stop_reason === "refusal") throw new LLMError("The model declined this request.", "refusal", 502);
    if (!res.parsed_output) throw new LLMError("Model output did not match the expected schema.", "schema", 502);
    return { data: res.parsed_output, usage: res.usage, model: res.model };
  } catch (err) {
    throw err instanceof LLMError ? err : mapClaudeError(err);
  }
}

// ---------- Ollama (offline development) ----------

async function ollamaChat(body) {
  const url = `${config.ollama.url}/api/chat`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: config.ollama.model, stream: false, keep_alive: "15m", ...body }),
      signal: AbortSignal.timeout(300_000), // local models: structured generation measured at 41–126 s, occasionally longer
    });
  } catch (err) {
    throw new LLMError(`Cannot reach Ollama at ${config.ollama.url}: ${err.message}`, "provider", 503);
  }
  if (!res.ok) throw new LLMError(`Ollama error ${res.status}: ${await res.text()}`, "provider", 502);
  const json = await res.json();
  return { text: json.message?.content ?? "", done_reason: json.done_reason, usage: { input_tokens: json.prompt_eval_count, output_tokens: json.eval_count } };
}

async function ollamaComplete({ system, messages, maxTokens }) {
  const r = await ollamaChat({
    messages: [{ role: "system", content: system }, ...messages],
    options: { temperature: 0.2, num_predict: maxTokens, num_ctx: 8192 }, // 0.2: run 3 showed off-topic drift at 0.4
  });
  return { text: r.text.trim(), truncated: r.done_reason === "length", usage: r.usage, model: config.ollama.model };
}

async function ollamaCompleteJSON({ system, messages, schema, maxTokens }) {
  const jsonSchema = z.toJSONSchema(schema);
  const r = await ollamaChat({
    messages: [{ role: "system", content: system }, ...messages],
    format: jsonSchema,
    options: { temperature: 0.2, num_predict: maxTokens, num_ctx: 8192 },
  });
  let parsed;
  try {
    parsed = JSON.parse(r.text);
  } catch {
    throw new LLMError("Model returned invalid JSON.", "schema", 502);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new LLMError(`Model output did not match the expected schema: ${result.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`, "schema", 502);
  return { data: result.data, usage: r.usage, model: config.ollama.model };
}

// ---------- public API ----------

export const llm = {
  provider: config.provider,
  model: config.provider === "claude" ? config.claude.model : config.ollama.model,

  /** Free-text completion. effort: low | medium | high (Claude only). */
  async complete({ system, messages, maxTokens = 1500, effort = "medium" }) {
    return config.provider === "claude"
      ? claudeComplete({ system, messages, maxTokens, effort })
      : ollamaComplete({ system, messages, maxTokens });
  },

  /** Schema-constrained completion; returns a validated object. Retries once if the model's output does not parse. */
  async completeJSON({ system, messages, schema, maxTokens = 4000, effort = "medium" }) {
    const once = () => (config.provider === "claude"
      ? claudeCompleteJSON({ system, messages, schema, maxTokens, effort })
      : ollamaCompleteJSON({ system, messages, schema, maxTokens }));
    try {
      return await once();
    } catch (err) {
      if (err instanceof LLMError && err.kind === "schema") {
        console.warn(`[llm] ${err.message} — retrying once`);
        return once();
      }
      throw err;
    }
  },
};
