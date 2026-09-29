import Anthropic from "@anthropic-ai/sdk";

// Claude API access for policy briefs and change summaries (lib/summaries.ts).
// Enabled when ANTHROPIC_API_KEY is set; everything else works without it.

export const AI_MODEL = process.env.AI_MODEL || "claude-opus-5-5";
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];
const AI_EFFORT: Effort = (EFFORTS as readonly string[]).includes(process.env.AI_EFFORT ?? "")
  ? (process.env.AI_EFFORT as Effort)
  : "medium";

// Per million tokens (input, output), for the usage estimate only.
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-4-5": [1, 5],
};

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export class AiError extends Error {}

let client: Anthropic | undefined;
function getClient(): Anthropic {
  return (client ??= new Anthropic());
}

export interface AiResult<T> {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** One request whose reply must match `schema` (JSON). Throws AiError with a readable message. */
export async function askClaude<T>(opts: {
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: Record<string, unknown>;
}): Promise<AiResult<T>> {
  if (!aiEnabled()) throw new AiError("AI summaries are off: set ANTHROPIC_API_KEY (see the README).");

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await getClient().beta.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      // If a safety classifier declines, the API retries on its recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: AI_EFFORT, format: { type: "json_schema", schema: opts.schema } },
      system: opts.system,
      messages: [{ role: "user", content: opts.content }],
    });
  } catch (err) {
    throw new AiError(describeApiError(err));
  }

  if (response.stop_reason === "refusal") throw new AiError("Claude declined to summarize this.");
  if (response.stop_reason === "max_tokens") throw new AiError("The summary was cut off. Try again.");
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new AiError("Claude's reply couldn't be read. Try again.");
  }
  const u = response.usage;
  return {
    data,
    model: response.model,
    inputTokens: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
    outputTokens: u.output_tokens,
  };
}

function describeApiError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.PermissionDeniedError) return "This API key isn't allowed to use the model. Check your Anthropic account.";
  if (err instanceof Anthropic.NotFoundError) return `Model "${AI_MODEL}" wasn't found. Check AI_MODEL.`;
  if (err instanceof Anthropic.RateLimitError) return "The Anthropic API is rate limiting requests. It will be retried later.";
  if (err instanceof Anthropic.BadRequestError) return `The Anthropic API rejected the request: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the Anthropic API.";
  if (err instanceof Anthropic.APIError) return `Anthropic API error ${err.status ?? ""}: ${err.message}`.trim();
  return err instanceof Error ? err.message : "Unknown error calling the Anthropic API.";
}

/** Estimated cost in dollars, or null for models without a known price. */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number | null {
  const key = Object.keys(PRICES).find((k) => model.startsWith(k));
  if (!key) return null;
  const [inPrice, outPrice] = PRICES[key];
  return (inputTokens * inPrice + outputTokens * outPrice) / 1_000_000;
}
