import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runAppleScript, escapeForAppleScript } from "../applescript.js";
import { success, withErrorHandling } from "../helpers.js";

export function registerListTools(server: McpServer) {
  server.registerTool(
    "reminders_get_lists",
    {
      description: "List all reminder lists",
      inputSchema: {},
    },
    withErrorHandling(async () => {
      const raw = await runAppleScript(`
tell application "Reminders"
  set output to ""
  repeat with lst in every list
    set cnt to count of reminders of lst
    set cntDone to count (every reminder of lst whose completed is true)
    set output to output & (name of lst) & "\\t" & cnt & "\\t" & cntDone & "\\n"
  end repeat
  return output
end tell`);
      const lists = raw
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [name, total, done] = line.split("\t");
          return { name, total: Number(total), completed: Number(done), pending: Number(total) - Number(done) };
        });
      return success(lists);
    }),
  );

  // Create list
  server.registerTool(
    "reminders_create_list",
    {
      description: "Create a new reminder list",
      inputSchema: z.object({
        name: z.string().describe("Name for the new list"),
      }),
    },
    withErrorHandling(async ({ name }) => {
      const esc = escapeForAppleScript(name);
      await runAppleScript(`
tell application "Reminders"
  make new list with properties {name:"${esc}"}
end tell`);
      return success({ name, created: true });
    }),
  );

  // Delete list
  server.registerTool(
    "reminders_delete_list",
    {
      description: "Delete a reminder list by name",
      inputSchema: z.object({
        name: z.string().describe("Name of the list to delete"),
      }),
    },
    withErrorHandling(async ({ name }) => {
      const esc = escapeForAppleScript(name);
      await runAppleScript(`
tell application "Reminders"
  delete list "${esc}"
end tell`);
      return success({ name, deleted: true });
    }),
  );
}
