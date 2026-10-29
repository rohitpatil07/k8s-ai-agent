
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { getNodeResources } from "../../kubernetes/nodes.js";

export function registerGetNodeResourcesTool(
  server: McpServer,
): void {
  server.registerTool(
    "get_node_resources",
    {
      title: "Get Kubernetes Node Resources",
      description:
        "List all Kubernetes nodes with readiness, schedulability, " +
        "CPU and memory capacity, allocatable CPU and memory, and " +
        "maximum pod capacity. Use this to compare nodes when investigating " +
        "scheduling failures or insufficient cluster resources. " +
        "Allocatable resources are not the same as currently unused resources.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const nodes = await getNodeResources();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(nodes, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown Kubernetes error";

        console.error("get_node_resources failed:", message);

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Failed to retrieve Kubernetes node resources.",
            },
          ],
        };
      }
    },
  );
}
