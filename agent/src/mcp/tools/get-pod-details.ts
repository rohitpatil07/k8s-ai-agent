
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { getPod } from "../../kubernetes/pod.js";

export function registerGetPodDetailsTool(server: McpServer): void {
  server.registerTool(
    "get_pod_details",
    {
      title: "Get Kubernetes Pod Details",
      description:
        "Retrieve detailed information about a specific Kubernetes pod, " +
        "including phase, node assignment, pod IP, container images, " +
        "readiness, resource requests and limits, current states, " +
        "restart counts, and previous termination details.",
      inputSchema: z.object({
        namespace: z.string()
          .trim()
          .min(1)
          .max(63)
          .describe("Namespace containing the pod."),
        podName: z.string()
          .trim()
          .min(1)
          .max(253)
          .describe("Name of the pod to inspect."),
      }),
    },
    async ({ namespace, podName }) => {
      try {
        const pod = await getPod(namespace, podName);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(pod, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown Kubernetes error";

        console.error("get_pod_details failed:", message);

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Failed to retrieve details for pod "${podName}" in namespace "${namespace}".`,
            },
          ],
        };
      }
    },
  );
}
