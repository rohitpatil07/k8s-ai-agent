import OpenAI from "openai";
import type { AIContext } from "../kubernetes/types.js";

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export async function reason(
  context: AIContext,
) {
  const completion = await openai.chat.completions.create({
    model: "deepseek-ai/deepseek-v4-flash-0731",
    messages: [
      {
        role: "system",
        content:
          "You are a Kubernetes troubleshooting assistant. " +
          "Analyze the provided Kubernetes diagnostic context. " +
          "Identify the most likely root cause and provide a practical recommendation. " +
          "Only use evidence present in the context.",
      },
      {
        role: "user",
        content: JSON.stringify(context, null, 2),
      },
    ],
    temperature: 0.2,
    top_p: 0.95,
    max_tokens: 2048,
    stream: false,
  });

  const message = completion.choices[0]?.message;

  return {
    summary: context.diagnosis.summary,
    rootCause: message?.content ?? "Unable to determine root cause.",
    confidence: "medium" as const,
    explanation:
      "The diagnosis was analyzed using DeepSeek through the NVIDIA API.",
    recommendation: context.diagnosis.recommendation,
  };
}