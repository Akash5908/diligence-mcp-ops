import express, { Request, Response } from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer } from "./server.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
let transport: SSEServerTransport | null = null;

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "commerce-ops-mcp" });
});

// SSE endpoint for client connection establishment
app.get("/sse", async (_req: Request, res: Response) => {
  console.log("Establishing SSE connection...");
  const server = createMcpServer();
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

// Messages endpoint for client RPC calls
app.post("/messages", async (req: Request, res: Response) => {
  if (!transport) {
    res.status(400).json({ error: "SSE connection not established" });
    return;
  }
  await transport.handlePostMessage(req, res);
});

app.listen(PORT, () => {
  console.log(`🚀 Commerce Ops MCP Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});