
import { getPod } from "./kubernetes/pod.js";
import { getPodEvents } from "./kubernetes/events.js";
import { getPodLogs } from "./kubernetes/logs.js";
import { diagnose } from "./diagnosis.js";
import { askAI, parseAIAnalysis } from "./ai/openrouter.js";
import { buildDiagnosisPrompt } from "./ai/prompts.js";
import { validateDiagnosticCommand } from "./ai/command-safety.js";
import { AIAnalysis } from "./ai/types.js"

const namespace = process.argv[2] ?? "default";
const podName = process.argv[3] ?? "nginx";
const containerName = process.argv[4];

async function main() {
  const pod = await getPod(namespace, podName);

  const events = await getPodEvents(namespace, podName);

  const logs = await getPodLogs(
    namespace,
    podName,
    containerName,
    100,
    false,
  );

  // Layer 1: Existing rule-based diagnosis.
  const diagnosis = diagnose({
    pod,
    events,
    logs,
  });

  // Layer 2: AI review based on the diagnosis evidence.
  
  let aiAnalysis: AIAnalysis | null = null;

  try {
    const prompt = buildDiagnosisPrompt(
      pod.name,
      namespace,
      diagnosis,
      {
        pod,
        events,
        logs,
      },
    );

    const rawResponse = await askAI(prompt);

    const parsedAnalysis = parseAIAnalysis(rawResponse);

    aiAnalysis = {
      ...parsedAnalysis,
      nextChecks: parsedAnalysis.nextChecks.filter(check => {
        const result = validateDiagnosticCommand(check.command);

        if (!result.safe) {
          console.warn(
            `Blocked AI-recommended command: ${check.command}`,
            `Reason: ${result.reason}`,
          );
        }

        return result.safe;
      }),
    };

  } catch (error) {
    console.error("AI review failed:", error);
  }


  console.dir(
    {
      pod,
      events,
      logs,
      diagnosis,
      aiAnalysis,
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
