import { getPod } from "./kubernetes/pod.js";
import { getPodEvents } from "./kubernetes/events.js";
import { getPodLogs } from "./kubernetes/logs.js";
import { diagnose } from "./diagnosis.js";
import { buildAIContext } from "./ai/context.js";
import { reason } from "./ai/reasoner.js";

const namespace = "default";
const podName = "pvcpod";
const containerName = "pvcpod";

async function main() {
  const pod = await getPod(
    namespace,
    podName,
  );

  const events = await getPodEvents(
    namespace,
    podName,
  );

  const logs = await getPodLogs(
    namespace,
    podName,
    containerName,
    100,
    false,
  );

  const diagnosis = diagnose({
    pod,
    events,
    logs,
  });

  const aiContext = buildAIContext(
    pod,
    events,
    logs,
    diagnosis,
  );

  const aiResult = await reason(aiContext);

  console.dir(
    aiResult,
    {
      depth: null,
    },
  );
}

main().catch(error => {
  console.error(
    "Failed to collect Kubernetes diagnostics:",
  );

  console.error(error);

  process.exit(1);
});