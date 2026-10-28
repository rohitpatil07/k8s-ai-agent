
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { getPods } from "../../kubernetes/pods.js";

export function registerListPodsTool(server: McpServer): void {
  server.registerTool(
    "list_pods",
    {
      title: "List Kubernetes Pods",
      description:
        "List pods in a specified Kubernetes namespace, or across all " +
        "namespaces if namespace is omitted. Returns pod names, phases, " +
        "readiness, restart counts, node assignments, IP addresses, " +
        "and container states.",
      inputSchema: z.object({
        namespace: z.string()
          .trim()
          .min(1)
          .max(63)
          .optional()
          .describe(
            "Namespace to list. Omit to list pods across all namespaces.",
          ),
      }),
    },
    async ({ namespace }) => {
      try {
        const pods = await getPods(namespace);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(pods, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown Kubernetes error";

        console.error("list_pods failed:", message);

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Failed to list Kubernetes pods.",
            },
          ],
        };
      }
    },
  );
}
