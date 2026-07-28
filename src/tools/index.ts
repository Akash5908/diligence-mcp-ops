// ─── Tool Registry ────────────────────────────────────────────────────────────
//
// Each tool module exports:
//   - `definition`: the JSON schema descriptor used in ListTools
//   - `handler`:    the async function called in CallTool
//
// To add a new tool, just import it here and add it to the `toolRegistry` array.

import * as getOrder from "./getOrder.js";
import * as checkStock from "./checkStock.js";
import * as processRefund from "./processRefund.js";
import * as createShipment from "./createShipment.js";

// ─── Shared Types ─────────────────────────────────────────────────────────────

export type ToolHandler = (
  args: Record<string, unknown>
) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const toolRegistry: ToolEntry[] = [
  { definition: getOrder.definition, handler: getOrder.handler },
  { definition: checkStock.definition, handler: checkStock.handler },
  { definition: processRefund.definition, handler: processRefund.handler },
  { definition: createShipment.definition, handler: createShipment.handler },
];

// ─── Lookup Map (name → handler) ─────────────────────────────────────────────

export const toolHandlerMap: Map<string, ToolHandler> = new Map(
  toolRegistry.map(({ definition, handler }) => [definition.name, handler])
);
