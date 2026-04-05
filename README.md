```
██████╗ ███████╗███╗   ███╗██╗███╗   ██╗██████╗ ███████╗██████╗ ███████╗
██╔══██╗██╔════╝████╗ ████║██║████╗  ██║██╔══██╗██╔════╝██╔══██╗██╔════╝
██████╔╝█████╗  ██╔████╔██║██║██╔██╗ ██║██║  ██║█████╗  ██████╔╝███████╗
██╔══██╗██╔══╝  ██║╚██╔╝██║██║██║╚██╗██║██║  ██║██╔══╝  ██╔══██╗╚════██║
██║  ██║███████╗██║ ╚═╝ ██║██║██║ ╚████║██████╔╝███████╗██║  ██║███████║
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝
                                                                        
```

# @zyx1121/apple-reminders-mcp

MCP server for Apple Reminders — create, search, and manage reminders and lists via Claude Code.

## Install

```bash
claude mcp add apple-reminders -- npx @zyx1121/apple-reminders-mcp
```

## Prerequisites

- macOS with Reminders.app configured
- Node.js >= 18
- First run will prompt for Automation permission (System Settings > Privacy & Security > Automation)

## Tools

### Lists

| Tool | Description |
|------|-------------|
| `reminders_get_lists` | List all reminder lists |
| `reminders_create_list` | Create a new reminder list |
| `reminders_delete_list` | Delete a reminder list by name |

### Reminders

| Tool | Description |
|------|-------------|
| `reminders_list` | List reminders in a list |
| `reminders_get` | Get full details of a reminder by ID |
| `reminders_search` | Search reminders by keyword across all lists |
| `reminders_create` | Create a new reminder (with optional priority) |
| `reminders_update` | Update an existing reminder |
| `reminders_complete` | Mark a reminder as complete or incomplete |
| `reminders_delete` | Delete a reminder |

### Priority

`reminders_create` and `reminders_update` accept a `priority` parameter:

| Value | Meaning |
|-------|---------|
| `0` | None (default) |
| `1` | High |
| `5` | Medium |
| `9` | Low |

Priority is returned by `reminders_list`, `reminders_get`, and `reminders_search`.

## Examples

```
"Show my lists"                  → reminders_get_lists
"Create a list"                  → reminders_create_list { name: "Shopping" }
"Add a reminder"                 → reminders_create { list: "Shopping", name: "Buy milk", priority: 1 }
"List reminders"                 → reminders_list { list: "Shopping" }
"Mark as done"                   → reminders_complete { id: "x-apple-reminder://..." }
"Search for task"                → reminders_search { query: "milk" }
"Delete a list"                  → reminders_delete_list { name: "Shopping" }
```

## Limitations

- macOS only (uses AppleScript via `osascript`)
- Reminders.app must be running

## License

MIT
