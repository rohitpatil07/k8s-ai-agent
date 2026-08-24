import { getPod } from "./kubernetes/pod.js";
import { getPodEvents } from "./kubernetes/events.js";
import { getPodLogs } from "./kubernetes/logs.js";
import { diagnose } from "./diagnosis.js";

const namespace = "default";
const podName = "exitpod";
const containerName = "exitpod";

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

  console.dir(
    {
      pod,
      events,
      logs,
      diagnosis,
    },
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