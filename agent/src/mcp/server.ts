
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { registerListPodsTool } from "./tools/list-pods.js";

function createServer(): McpServer {
  const server = new McpServer({
    name: "k8s-ai-agent",
    version: "1.0.0",
  });

  registerListPodsTool(server);

  return server;
}

console.error("Starting Kubernetes AI Agent MCP server...");

serveStdio(createServer, {
  onerror: error => {
    console.error("MCP server error:", error);
  },
});
