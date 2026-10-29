
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { registerListPodsTool } from "./tools/list-pods.js";
import { registerGetPodDetailsTool } from "./tools/get-pod-details.js";
import { registerGetPodEventsTool } from "./tools/get-pod-events.js";

const registerTools = (server: McpServer) => {
  registerListPodsTool(server);
  registerGetPodDetailsTool(server);
  registerGetPodEventsTool(server);
}

function createServer(): McpServer {
  const server = new McpServer({
    name: "k8s-ai-agent",
    version: "1.0.0",
  });

  console.log("Starting to register tools...");
  registerTools(server)
  console.log("Tools have been registered");

  return server;
}

console.error("Starting Kubernetes AI Agent MCP server...");

serveStdio(createServer, {
  onerror: error => {
    console.error("MCP server error:", error);
  },
});
