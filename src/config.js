import "dotenv/config";

const hasClaudeKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export const config = {
  port: Number(process.env.PORT) || 3000,
  provider: process.env.LLM_PROVIDER || (hasClaudeKey ? "claude" : "ollama"),
  claude: {
    model: process.env.CLAUDE_MODEL || "claude-opus-5",
    configured: hasClaudeKey,
  },
  ollama: {
    url: process.env.OLLAMA_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "qwen2:7b",
  },
  limits: {
    maxMessageChars: 1000, // learner messages
    maxAssistantChars: 8000, // tutor replies echoed back as history
    maxHistoryMessages: 20,
    maxAnswerChars: 100,
  },
};
