import { coreApi } from "./client.js";
import type { PodSummary } from "./types.js";

export async function getPods(
  namespace?: string,
): Promise<PodSummary[]> {
  const response = namespace
    ? await coreApi.listNamespacedPod({ namespace })
    : await coreApi.listPodForAllNamespaces();

  return response.items.map((pod) => {
    const name = pod.metadata?.name;
    const podNamespace = pod.metadata?.namespace;

    if (!name || !podNamespace) {
      throw new Error("Pod is missing required metadata");
    }

    const containers = pod.status?.containerStatuses ?? [];

    return {
      name,
      namespace: podNamespace,
      phase: pod.status?.phase,

      ready: containers.length > 0 &&
        containers.every((container) => container.ready),

      restartCount: containers.reduce(
        (total, container) => total + container.restartCount,
        0,
      ),

      node: pod.spec?.nodeName,
      podIP: pod.status?.podIP,

      containers: containers.map((container) => ({
        name: container.name,
        ready: container.ready,
        restartCount: container.restartCount,

        state: container.state?.waiting
          ? {
              type: "waiting" as const,
              reason: container.state.waiting.reason,
              message: container.state.waiting.message,
            }
          : container.state?.terminated
            ? {
                type: "terminated" as const,
                reason: container.state.terminated.reason,
                exitCode: container.state.terminated.exitCode,
                message: container.state.terminated.message,
              }
            : container.state?.running
              ? {
                  type: "running" as const,
                  startedAt: container.state.running.startedAt,
                }
              : undefined,
      })),
    };
  });
}