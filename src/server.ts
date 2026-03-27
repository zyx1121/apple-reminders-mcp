import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListTools } from "./tools/lists.js";
import { registerReminderTools } from "./tools/reminders.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "apple-reminders",
    version: "0.1.0",
  });

  registerListTools(server);
  registerReminderTools(server);

  return server;
}
