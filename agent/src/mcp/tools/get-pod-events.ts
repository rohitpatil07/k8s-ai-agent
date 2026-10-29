
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { getPodEvents } from "../../kubernetes/events.js";

export function registerGetPodEventsTool(server: McpServer): void {
  server.registerTool(
    "get_pod_events",
    {
      title: "Get Kubernetes Pod Events",
      description:
        "Retrieve Kubernetes events associated with a specific pod. " +
        "Returns event type, reason, message, occurrence count, timestamps, " +
        "and reporting component. Use this tool to investigate scheduling " +
        "failures, image-pull errors, container creation failures, and restarts.",
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
          .describe("Name of the pod whose events should be retrieved."),
      }),
    },
    async ({ namespace, podName }) => {
      try {
        const events = await getPodEvents(namespace, podName);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(events, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown Kubernetes error";

        console.error("get_pod_events failed:", message);

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text:
                `Failed to retrieve events for pod "${podName}" ` +
                `in namespace "${namespace}".`,
            },
          ],
        };
      }
    },
  );
}
