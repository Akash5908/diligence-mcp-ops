import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { toolRegistry, toolHandlerMap } from "./tools/index.js";

// ─── MCP Server Factory ───────────────────────────────────────────────────────

export function createMcpServer() {
  const server = new Server(
    { name: "commerce-ops-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // 1. List all registered tools dynamically from the registry
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolRegistry.map((entry) => entry.definition),
  }));

  // 2. Dispatch tool calls to the matching handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = toolHandlerMap.get(name);
    if (!handler) {
      throw new Error(`Tool "${name}" not recognized.`);
    }

    return handler(args as Record<string, unknown>);
  });

  return server;
}