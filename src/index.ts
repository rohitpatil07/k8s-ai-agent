
import { getPod } from "./kubernetes/pod.js";
import { getPodEvents } from "./kubernetes/events.js";
import { getPodLogs } from "./kubernetes/logs.js";
import { diagnose } from "./diagnosis.js";
import { askAI, parseAIAnalysis } from "./ai/openrouter.js";
import { buildDiagnosisPrompt } from "./ai/prompts.js";
import { validateDiagnosticCommand } from "./ai/command-safety.js";
import type { AIAnalysis } from "./ai/types.js";

const namespace = process.argv[2] ?? "default";
const podName = process.argv[3] ?? "nginx";
const containerName = process.argv[4];

type DiagnosticResult =
  | {
      source: "ai";
      analysis: AIAnalysis;
    }
  | {
      source: "deterministic-fallback";
      diagnosis: ReturnType<typeof diagnose>;
    };

async function main() {
  // Collect facts from Kubernetes.
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
    // Ask the AI to interpret raw evidence independently.
    const prompt = buildDiagnosisPrompt(
      pod.name,
      namespace,
      {
        pod,
        events,
        logs,
      },
    );

    const rawResponse = await askAI(prompt);
    const parsedAnalysis = parseAIAnalysis(rawResponse);

    // Keep AI-generated commands as suggestions only.
    const validatedAnalysis: AIAnalysis = {
      ...parsedAnalysis,
      nextChecks: parsedAnalysis.nextChecks.filter(check => {
        const validation = validateDiagnosticCommand(check.command);

        if (!validation.safe) {
          console.warn(
            `Blocked AI-recommended command: ${check.command}`,
            `Reason: ${validation.reason}`,
          );
        }

        return validation.safe;
      }),
    };

    result = {
      source: "ai",
      analysis: validatedAnalysis,
    };
  } catch (error) {
    console.error(
      "AI analysis failed; using deterministic fallback:",
      error,
    );

    result = {
      source: "deterministic-fallback",
      diagnosis: diagnose({
        pod,
        events,
        logs,
      }),
    };
  }

  // The primary displayed result is the AI analysis when available.
  console.dir(
    {
      pod,
      events,
      logs,
      result,
    },
    {
      depth: null,
    },
  );
}

main().catch(error => {
  console.error("Failed to collect Kubernetes diagnostics:");
  console.error(error);
  process.exit(1);
});
