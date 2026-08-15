# Client Configuration

## Common MCP Entry

Use an absolute path and set the Dify console URL in the MCP server environment:

```json
{
  "command": "node",
  "args": ["/absolute/path/dify-workflow-mcp/src/mcp-server.mjs"],
  "env": {
    "DIFY_BASE_URL": "https://cloud.dify.ai"
  }
}
```

Set `CHROME_PATH` only when automatic Chrome/Edge/Chromium detection fails. Set `DIFY_PROFILE_DIR` to isolate accounts or workspaces.

## Codex

Add the common entry using Codex MCP configuration, then run the platform install script with the Codex skill flag. Restart Codex so it reloads both the MCP server and skill.

## OpenClaw

Add the common entry to OpenClaw's MCP configuration and load `rules/universal.md` plus `rules/openclaw.md` as project/global rules. Do not copy the Codex skill directory into OpenClaw.

## Claude Code, WorkBuddy, And Other Clients

Add the common MCP entry using the client's MCP settings. Load `rules/universal.md` through the client's project rules, memory, or custom-instruction mechanism when available. Configuration file names differ by client version, so consult that client's current MCP documentation.

## First Connection

1. Restart the client after changing MCP configuration.
2. Call `dify_login`.
3. Complete login in the browser window and leave that profile managed by the MCP server.
4. Call `dify_status`.
5. Call `dify_list_models` before generating an LLM workflow.
