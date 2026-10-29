
import { troubleshootPod } from "../core/agent.js";

const namespace = process.argv[2] ?? "default";
const podName = process.argv[3] ?? "nginx";
const containerName = process.argv[4];

async function main() {
  const response = await troubleshootPod({
    namespace,
    podName,
    containerName,
  });

  console.dir(response, {
    depth: null,
  });
}

main().catch(error => {
  console.error("Failed to troubleshoot pod:");
  console.error(error);
  process.exitCode = 1;
});
