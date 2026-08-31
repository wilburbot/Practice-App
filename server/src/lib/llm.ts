import type { Response } from "express";
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new MissingApiKeyError();
  }
  if (!client) client = new Anthropic();
  return client;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set — AI features are unavailable until it's configured.");
  }
}

/** One-shot text completion. Uses medium effort by default — these are short, conversational
 * outputs (recaps, Q&A answers, suggestion lists), not the kind of hard reasoning task that
 * benefits from paying for higher effort. */
export async function askClaude(system: string, userPrompt: string, maxTokens = 700): Promise<string> {
  const response = await getClient().messages.create({
    model: "claude-opus-5",
    max_tokens: maxTokens,
    output_config: { effort: "medium" },
    system,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === "text");
  return textBlock?.text ?? "";
}

/** Shared error handling for AI-feature routes — keeps "not configured" distinct from a real API failure. */
export function handleLLMError(err: unknown, res: Response) {
  if (err instanceof MissingApiKeyError) {
    return res.status(503).json({ error: "AI features aren't configured yet — ask your admin to set ANTHROPIC_API_KEY." });
  }
  console.error(err);
  res.status(502).json({ error: "The AI request failed. Please try again." });
}
