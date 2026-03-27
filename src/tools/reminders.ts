import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runAppleScript, escapeForAppleScript } from "../applescript.js";
import { success, error, withErrorHandling } from "../helpers.js";

// Generates AppleScript that sets a date variable by components (locale-independent)
function asDateVar(varName: string, iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
  const h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  return `set ${varName} to current date
  set year of ${varName} to ${d.getFullYear()}
  set month of ${varName} to ${d.getMonth() + 1}
  set day of ${varName} to ${d.getDate()}
  set time of ${varName} to ${h * 3600 + m * 60 + s}`;
}

const RS = "\u001e"; // ASCII 30 Record Separator — safe delimiter unlikely to appear in reminder content

function parseReminders(raw: string) {
  if (!raw) return [];
  return raw
    .split(RS)
    .filter(Boolean)
    .map((line) => {
      const [id, name, list, completed, dueDate, body] = line.split("\t");
      if (!id?.startsWith("x-apple-reminder://")) return null;
      return {
        id,
        name,
        list,
        completed: completed === "true",
        dueDate: dueDate || null,
        notes: body || null,
      };
    })
    .filter(Boolean);
}

export function registerReminderTools(server: McpServer) {
  // List reminders
  server.registerTool(
    "reminders_list",
    {
      description: "List reminders in a list",
      inputSchema: z.object({
        list: z.string().describe("Reminder list name"),
        show_completed: z.coerce.boolean().default(false).describe("Include completed reminders"),
      }),
    },
    withErrorHandling(async ({ list, show_completed }) => {
      const esc = escapeForAppleScript(list);
      const filter = show_completed ? "" : " whose completed is false";
      const raw = await runAppleScript(`
tell application "Reminders"
  set lst to list "${esc}"
  set output to ""
  repeat with r in (every reminder of lst${filter})
    set bd to ""
    try
      if due date of r is not missing value then set bd to (due date of r as string)
    end try
    set nt to ""
    try
      if body of r is not missing value then set nt to (body of r)
    end try
    set output to output & (id of r) & "\\t" & (name of r) & "\\t" & "${esc}" & "\\t" & (completed of r) & "\\t" & bd & "\\t" & nt & (ASCII character 30)
  end repeat
  return output
end tell`);
      return success(parseReminders(raw));
    }),
  );

  // Get reminder by ID
  server.registerTool(
    "reminders_get",
    {
      description: "Get full details of a reminder by ID",
      inputSchema: z.object({
        id: z.string().describe("Reminder ID (x-apple-reminder://...)"),
      }),
    },
    withErrorHandling(async ({ id }) => {
      const esc = escapeForAppleScript(id);
      const raw = await runAppleScript(`
tell application "Reminders"
  set r to first reminder whose id is "${esc}"
  set lst to container of r
  set bd to ""
  try
    if due date of r is not missing value then set bd to (due date of r as string)
  end try
  set nt to ""
  try
    if body of r is not missing value then set nt to (body of r)
  end try
  return (id of r) & "\\t" & (name of r) & "\\t" & (name of lst) & "\\t" & (completed of r) & "\\t" & bd & "\\t" & nt
end tell`);
      // reminders_get returns a single line; split into at most 6 parts so notes with tabs are preserved
      const parts = raw.split("\t");
      const [rid, rname, rlist, rcompleted, rdueDate, ...rest] = parts;
      return success({
        id: rid,
        name: rname,
        list: rlist,
        completed: rcompleted === "true",
        dueDate: rdueDate || null,
        notes: rest.join("\t") || null,
      });
    }),
  );

  // Search reminders
  server.registerTool(
    "reminders_search",
    {
      description: "Search reminders by keyword across all lists",
      inputSchema: z.object({
        query: z.string().min(1).describe("Search keyword"),
        list: z.string().optional().describe("Limit search to this list (omit for all)"),
        show_completed: z.coerce.boolean().default(false).describe("Include completed reminders"),
      }),
    },
    withErrorHandling(async ({ query, list, show_completed }) => {
      const escQuery = escapeForAppleScript(query);
      const completedFilter = show_completed ? "" : " and completed is false";
      let script: string;
      if (list) {
        const escList = escapeForAppleScript(list);
        script = `
tell application "Reminders"
  set lst to list "${escList}"
  set output to ""
  repeat with r in (every reminder of lst whose name contains "${escQuery}"${completedFilter})
    set bd to ""
    try
      if due date of r is not missing value then set bd to (due date of r as string)
    end try
    set nt to ""
    try
      if body of r is not missing value then set nt to (body of r)
    end try
    set output to output & (id of r) & "\\t" & (name of r) & "\\t" & "${escList}" & "\\t" & (completed of r) & "\\t" & bd & "\\t" & nt & (ASCII character 30)
  end repeat
  return output
end tell`;
      } else {
        script = `
tell application "Reminders"
  set output to ""
  repeat with lst in every list
    set listName to name of lst
    repeat with r in (every reminder of lst whose name contains "${escQuery}"${completedFilter})
      set bd to ""
      try
        if due date of r is not missing value then set bd to (due date of r as string)
      end try
      set nt to ""
      try
        if body of r is not missing value then set nt to (body of r)
      end try
      set output to output & (id of r) & "\\t" & (name of r) & "\\t" & listName & "\\t" & (completed of r) & "\\t" & bd & "\\t" & nt & (ASCII character 30)
    end repeat
  end repeat
  return output
end tell`;
      }
      const raw = await runAppleScript(script);
      return success(parseReminders(raw));
    }),
  );

  // Create reminder
  server.registerTool(
    "reminders_create",
    {
      description: "Create a new reminder",
      inputSchema: z.object({
        name: z.string().describe("Reminder title"),
        list: z.string().describe("List name to add reminder to"),
        notes: z.string().optional().describe("Notes/body"),
        due_date: z.string().optional().describe("Due date ISO 8601, e.g. '2026-03-28' or '2026-03-28T09:00:00'"),
      }),
    },
    withErrorHandling(async ({ name, list, notes, due_date }) => {
      const escName = escapeForAppleScript(name);
      const escList = escapeForAppleScript(list);
      const escNotes = notes ? escapeForAppleScript(notes) : "";
      const dateSetup = due_date ? asDateVar("dueDate", due_date) : "";
      const dateArg = due_date ? ", due date:dueDate" : "";
      const notesArg = notes ? `, body:"${escNotes}"` : "";
      const raw = await runAppleScript(`
tell application "Reminders"
  set lst to list "${escList}"
  ${dateSetup}
  set r to make new reminder at end of lst with properties {name:"${escName}"${notesArg}${dateArg}}
  set bd to ""
  try
    if due date of r is not missing value then set bd to (due date of r as string)
  end try
  return (id of r) & "\\t" & (name of r) & "\\t" & "${escList}" & "\\t" & (completed of r) & "\\t" & bd & "\\t" & "${escNotes}"
end tell`);
      const items = parseReminders(raw);
      if (!items.length) return error("Failed to create reminder");
      return success({ ...items[0], created: true });
    }),
  );

  // Update reminder
  server.registerTool(
    "reminders_update",
    {
      description: "Update an existing reminder",
      inputSchema: z.object({
        id: z.string().describe("Reminder ID"),
        name: z.string().optional().describe("New title"),
        notes: z.string().optional().describe("New notes"),
        due_date: z.string().optional().describe("New due date ISO 8601"),
      }),
    },
    withErrorHandling(async ({ id, name, notes, due_date }) => {
      const esc = escapeForAppleScript(id);
      const updates: string[] = [];
      if (name) updates.push(`set name of r to "${escapeForAppleScript(name)}"`);
      if (notes !== undefined) updates.push(`set body of r to "${escapeForAppleScript(notes)}"`);
      const dateSetup = due_date ? asDateVar("newDue", due_date) : "";
      if (due_date) updates.push("set due date of r to newDue");
      if (!updates.length && !due_date) return error("No fields to update");
      await runAppleScript(`
tell application "Reminders"
  set r to first reminder whose id is "${esc}"
  ${dateSetup}
  ${updates.join("\n  ")}
end tell`);
      return success({ id, updated: true });
    }),
  );

  // Complete reminder
  server.registerTool(
    "reminders_complete",
    {
      description: "Mark a reminder as complete or incomplete",
      inputSchema: z.object({
        id: z.string().describe("Reminder ID"),
        completed: z.coerce.boolean().default(true).describe("true to complete, false to uncomplete"),
      }),
    },
    withErrorHandling(async ({ id, completed }) => {
      const esc = escapeForAppleScript(id);
      await runAppleScript(`
tell application "Reminders"
  set r to first reminder whose id is "${esc}"
  set completed of r to ${completed}
end tell`);
      return success({ id, completed });
    }),
  );

  // Delete reminder
  server.registerTool(
    "reminders_delete",
    {
      description: "Delete a reminder",
      inputSchema: z.object({
        id: z.string().describe("Reminder ID"),
      }),
    },
    withErrorHandling(async ({ id }) => {
      const esc = escapeForAppleScript(id);
      await runAppleScript(`
tell application "Reminders"
  set r to first reminder whose id is "${esc}"
  delete r
end tell`);
      return success({ id, deleted: true });
    }),
  );
}
