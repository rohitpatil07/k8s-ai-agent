
import { getPod } from "../kubernetes/pod.js";
import { getPodEvents } from "../kubernetes/events.js";
import { getPodLogs } from "../kubernetes/logs.js";
import { diagnose } from "./diagnosis.js";
import {
  askAI,
  parseAIAnalysis,
} from "../ai/openrouter.js";
import { buildDiagnosisPrompt } from "../ai/prompts.js";
import { validateDiagnosticCommand } from "../ai/command-safety.js";
import type { AIAnalysis } from "../ai/types.js";

export interface AgentRequest {
  namespace: string;
  podName: string;
  containerName?: string;
}

export type DiagnosticResult =
  | {
      source: "ai";
      analysis: AIAnalysis;
    }
  | {
      source: "deterministic-fallback";
      diagnosis: ReturnType<typeof diagnose>;
    };

export interface AgentResponse {
  pod: Awaited<ReturnType<typeof getPod>>;
  events: Awaited<ReturnType<typeof getPodEvents>>;
  logs: Awaited<ReturnType<typeof getPodLogs>>;
  result: DiagnosticResult;
}

export async function troubleshootPod(
  request: AgentRequest,
): Promise<AgentResponse> {
  const { namespace, podName, containerName } = request;

  // Collect the evidence supported by the current MVP.
  const pod = await getPod(namespace, podName);

  const events = await getPodEvents(namespace, podName);

  const logs = await getPodLogs(
    namespace,
    podName,
    containerName,
    100,
    false,
  );

  let result: DiagnosticResult;

  try {
    // Let the AI interpret the raw evidence independently.
    const prompt = buildDiagnosisPrompt(
      pod.name,
      namespace,
      { pod, events, logs },
    );

    const rawResponse = await askAI(prompt);
    const parsedAnalysis = parseAIAnalysis(rawResponse);

    // Keep only approved diagnostic command suggestions.
    const nextChecks = parsedAnalysis.nextChecks.filter(check => {
      const validation = validateDiagnosticCommand(check.command);

      if (!validation.safe) {
        console.warn(
          `Blocked AI-recommended command: ${check.command}`,
          `Reason: ${validation.reason}`,
        );
      }

      return validation.safe;
    });

    result = {
      source: "ai",
      analysis: {
        ...parsedAnalysis,
        nextChecks,
      },
    };
  } catch (error) {
    console.error(
      "AI analysis failed; using deterministic fallback:",
      error,
    );

    result = {
      source: "deterministic-fallback",
      diagnosis: diagnose({ pod, events, logs }),
    };
  }

  return {
    pod,
    events,
    logs,
    result,
  };
}
