import { coreApi } from "./client.js";
import type { PodLogs } from "./types.js";

export async function getPodLogs(
  namespace: string,
  podName: string,
  containerName?: string,
  tailLines = 100,
  previous = false,
): Promise<PodLogs> {
  try {
    const logs = await coreApi.readNamespacedPodLog({
      namespace,
      name: podName,
      container: containerName,
      tailLines,
      previous,
      timestamps: true,
    });

    return {
      logs,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    if (
      previous &&
      error instanceof Error &&
      "code" in error &&
      error.code === 400
    ) {
      return {
        logs: null,
        reason: "NO_PREVIOUS_CONTAINER",
        error: errorMessage,
      };
    }

    return {
      logs: null,
      reason: "LOG_RETRIEVAL_FAILED",
      error: errorMessage,
    };
  }
}