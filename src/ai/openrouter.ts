const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

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