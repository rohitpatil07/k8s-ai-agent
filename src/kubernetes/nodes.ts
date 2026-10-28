import { coreApi } from "./client.js";
import type { NodeResourceSummary } from "./types.js";

export async function getNodeResources(): Promise<NodeResourceSummary[]> {
  const nodeList = await coreApi.listNode();

  return (nodeList.items ?? []).map(node => {
    const resources = node.status;

    return {
      name: node.metadata?.name ?? "unknown",

      ready:
        resources?.conditions?.some(
          condition =>
            condition.type === "Ready" &&
            condition.status === "True",
        ) ?? false,

      unschedulable: node.spec?.unschedulable ?? false,

      capacity: {
        cpu: resources?.capacity?.cpu,
        memory: resources?.capacity?.memory,
        pods: resources?.capacity?.pods,
      },

      allocatable: {
        cpu: resources?.allocatable?.cpu,
        memory: resources?.allocatable?.memory,
        pods: resources?.allocatable?.pods,
      },
    };
  });
}