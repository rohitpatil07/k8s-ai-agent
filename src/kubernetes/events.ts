import { coreApi } from "./client.js";
import type { PodEvent } from "./types.js";

export async function getPodEvents(
  namespace: string,
  podName: string,
): Promise<PodEvent[]> {
  const response = await coreApi.listNamespacedEvent({
    namespace,
    fieldSelector: `involvedObject.name=${podName}`,
  });

  return response.items.map(item => ({
    type: item.type ?? "Unknown",
    reason: item.reason ?? "Unknown",
    message: item.message ?? "",
    count: item.count ?? 1,
    firstTimestamp: item.firstTimestamp ?? undefined,
    lastTimestamp: item.lastTimestamp ?? undefined,
    component: item.reportingComponent ?? "Unknown",
  }));
}