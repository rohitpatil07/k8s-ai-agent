
import { MCPToolset } from "@google/adk";

const toolset = new MCPToolset({
  type: "StdioConnectionParams",
  serverParams: {
    command: "npx",
    args: ["tsx", "src/mcp/server.ts"],
    env: {
      KUBECONFIG:
        process.env.KUBECONFIG ??
        "/etc/rancher/k3s/k3s.yaml",
    },
  },
});

async function main() {
  try {
    const tools = await toolset.getTools();

    console.log("Tools discovered through ADK MCPToolset:");
    for (const tool of tools) {
      console.log(`- ${tool.name}`);
    }

    console.log(`\nTotal tools discovered: ${tools.length}`);
  } finally {
    await toolset.close();
  }
}

main().catch(error => {
  console.error("ADK MCP discovery failed:", error);
  process.exitCode = 1;
});
