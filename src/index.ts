
import { getPod } from "./kubernetes/pod.js";
import { getPodEvents } from "./kubernetes/events.js";
import { getPodLogs } from "./kubernetes/logs.js";
import { diagnose } from "./diagnosis.js";
import { askAI, parseAIAnalysis } from "./ai/openrouter.js";
import { buildDiagnosisPrompt } from "./ai/prompts.js";

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
  
  let aiAnalysis: import("./ai/types.js").AIAnalysis | null = null;

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
    aiAnalysis = parseAIAnalysis(rawResponse);
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
