import type { AIAnalysis } from "./types.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function askAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;

  if (!apiKey || !model) {
    throw new Error(
      "Missing OPENROUTER_API_KEY or OPENROUTER_MODEL environment variable."
    );
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      reasoning: { enabled: false },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `OpenRouter request failed (${response.status}): ${
        data.error?.message ?? "Unknown API error"
      }`
    );
  }

  const answer = data.choices?.[0]?.message?.content;

  if (typeof answer !== "string" || answer.trim() === "") {
    throw new Error(
      "The AI model returned no text. Try again or check the model's response."
    );
  }

  return answer.trim();
}


export function parseAIAnalysis(raw: string): AIAnalysis {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI returned invalid JSON.");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error("AI response must be a JSON object.");
  }

  const data = parsed as Record<string, unknown>;

  if (
    typeof data.assessment !== "string" ||
    typeof data.likelyCause !== "string"
  ) {
    throw new Error("AI response is missing assessment or likelyCause.");
  }

  if (
    data.confidence !== "low" &&
    data.confidence !== "medium" &&
    data.confidence !== "high"
  ) {
    throw new Error("AI response has an invalid confidence value.");
  }

  const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) &&
    value.every(item => typeof item === "string");

  if (
    !isStringArray(data.supportingEvidence) ||
    !isStringArray(data.uncertainties)
  ) {
    throw new Error(
      "AI evidence and uncertainties must be arrays of strings.",
    );
  }

  if (
    !Array.isArray(data.nextChecks) ||
    !data.nextChecks.every(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).command === "string" &&
        typeof (item as Record<string, unknown>).reason === "string",
    )
  ) {
    throw new Error("AI nextChecks has an invalid structure.");
  }

  return {
    assessment: data.assessment,
    likelyCause: data.likelyCause,
    confidence: data.confidence,
    supportingEvidence: data.supportingEvidence,
    uncertainties: data.uncertainties,
    nextChecks: data.nextChecks as AIAnalysis["nextChecks"],
  };
}
