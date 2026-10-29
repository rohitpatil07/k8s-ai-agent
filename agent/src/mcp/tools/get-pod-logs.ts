
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { getPodLogs } from "../../kubernetes/logs.js";

export function registerGetPodLogsTool(server: McpServer): void {
  server.registerTool(
    "get_pod_logs",
    {
      title: "Get Kubernetes Pod Logs",
      description:
        "Retrieve logs from a Kubernetes pod container. Supports selecting " +
        "a container, limiting the number of returned lines, and retrieving " +
        "logs from the previous container instance. Useful for investigating " +
        "application errors, startup failures, and CrashLoopBackOff.",
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
          .describe("Name of the pod."),

        containerName: z.string()
          .trim()
          .min(1)
          .max(253)
          .optional()
          .describe("Container to retrieve logs from, when needed."),

        tailLines: z.number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe("Maximum number of log lines to retrieve. Defaults to 100."),

        previous: z.boolean()
          .optional()
          .describe("Retrieve logs from the previous container instance."),
      }),
    },
    async ({
      namespace,
      podName,
      containerName,
      tailLines,
      previous,
    }) => {
      try {
        const logs = await getPodLogs(
          namespace,
          podName,
          containerName,
          tailLines ?? 100,
          previous ?? false,
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(logs, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown Kubernetes error";

        console.error("get_pod_logs failed:", message);

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text:
                `Failed to retrieve logs for pod "${podName}" ` +
                `in namespace "${namespace}".`,
            },
          ],
        };
      }
    },
  );
}
