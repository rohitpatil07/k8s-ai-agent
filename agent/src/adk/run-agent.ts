import {
  InMemoryRunner,
  isFinalResponse,
  stringifyContent,
} from "@google/adk";

import {
  kubernetesAgent,
  mcpToolset,
} from "./agent.js";

const prompt = "List the pods in the default namespace and summarize their health.";

// const prompt = "List the pods in the default namespace. For each pod, report its name, status, readiness, restart count, and node. Base your answer on the Kubernetes tools rather than assumptions"; 

// const prompt =
//   process.argv.slice(2).join(" ") ||
//   "List the pods in the default namespace and summarize their health.";

async function main(): Promise<void> {
  const runner = new InMemoryRunner({
    agent: kubernetesAgent,
    appName: "k8s-ai-agent",
  });

  try {
    console.log("Starting Kubernetes troubleshooting agent...");
    console.log(`Question: ${prompt}\n`);

    let finalResponseReceived = false;

    for await (const event of runner.runEphemeral({
      userId: "local-developer",
      newMessage: {
        role: "user",
        parts: [{ text: prompt }],
      },
    })) {
      if (isFinalResponse(event) && event.content) {
        console.log("Agent response:\n");
        console.log(stringifyContent(event));
        finalResponseReceived = true;
      }
    }

    if (!finalResponseReceived) {
      throw new Error(
        "Agent finished without producing a final response.",
      );
    }
  } finally {
    await mcpToolset.close();
  }
}

main().catch((error: unknown) => {
  console.error("ADK agent run failed:", error);
  process.exitCode = 1;
});
