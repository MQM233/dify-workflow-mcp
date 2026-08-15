# Universal Dify Workflow MCP Rules

This is the client-neutral rule set for Codex, Claude Code, OpenClaw, WorkBuddy, and other MCP-capable agents.

## Client Setup

- Codex: also install and read `skills/dify-workflow-generation/SKILL.md`.
- OpenClaw: also load `rules/openclaw.md`.
- Other clients: load this document as project rules, memory, or custom instructions when supported.

Do not install files for unrelated clients unless the user asks.

## Environment Detection

Before downloading anything, check `node -v`, `npm -v`, and whether Chrome, Edge, or Chromium is already installed. Node.js 18 or newer is required. Use an existing compatible browser through `CHROME_PATH`; download Playwright Chromium only when no browser is available or an offline bundle is requested.

## Workflow Procedure

1. Clarify only ambiguities that can materially change the workflow.
2. Call `dify_list_models` before selecting an LLM when connected.
3. Call `dify_list_datasets` before generating a knowledge workflow.
4. Prefer strict Workflow IR and render it with `dify_render_ir`.
5. Generate `.ir.json`, `.yml`, and `.cases.json` artifacts as applicable.
6. Run `dify_validate_dsl` before import.
7. Import, read the draft back, and run realistic positive and edge tests.
8. Repair workflow defects and retest.
9. Open or refresh the app for inspection.
10. Report creation, inputs, runtime result, business result, limitations, and artifact paths.

Never report only "created successfully" or treat Dify runtime `succeeded` as proof that external content was obtained.

## Canvas Safety

- Nodes use top-level `type: custom` plus `data.type`.
- Nodes include dimensions, positions, and source/target positions.
- Code input bindings use `data.variables`.
- Code outputs include `children: null`.
- Start variables omit `max_length` or use a positive number.
- Edges use `type: custom`, `zIndex: 0`, and loop metadata under `edge.data`.

## URL Retrieval

For pages protected by authentication, CAPTCHA, or anti-bot systems, report whether real content was retrieved. Include a fallback input for user-pasted content when practical. Do not disguise a blocker page as successful analysis.

## Required Result Summary

```markdown
Created and imported: **<app name>**
App: <URL>
App ID: `<id>`

Inputs: <short list>
Runtime: `<succeeded | failed | not_run>`
Business result: <what was actually obtained or produced>
External dependency: <HTTP/tool/model result>
Known issue: <issue or none>
Artifacts: <paths>
```

If tests cannot run, state the reason, completed validation stages, and remaining risk.

## Generic Install Prompt

```text
Install Dify Workflow MCP for <client> from <repository path or URL>.
Before downloading dependencies, detect Node.js 18+ and an installed Chrome, Edge, or Chromium browser.
Load rules/universal.md. For Codex also install the bundled skill; for OpenClaw also load rules/openclaw.md.
Set DIFY_BASE_URL to my Dify deployment, start the MCP server, then call dify_login and dify_status.
```
