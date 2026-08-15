# Architecture

## Components

- `src/mcp-server.mjs`: MCP tool definitions and stdio transport.
- `src/dify-core.mjs`: serialized Playwright session and Dify console operations.
- `src/workflow-ir.mjs`: strict intermediate representation and YAML renderer.
- `src/dsl-validator.mjs`: static graph, selector, and canvas-safety checks.
- `src/difyctl.mjs`: command-line access for local development.
- `skills/`, `rules/`, and `examples/`: generation guidance and reusable artifacts.

## Why Browser Automation

Dify's documented Service API runs published apps, but does not cover every console-level operation needed here. This project uses the same authenticated web console available to the operator. It does not access the Dify database or require backend source access.

The tradeoff is version sensitivity: console routes and payloads can change. The project therefore separates local validation, import acceptance, draft readback, canvas inspection, and runtime testing.

## Session Model

One persistent browser context is shared by all tools in a server process. Operations are queued to avoid profile locks and racing page actions. The profile defaults to `~/.dify-workflow-mcp/browser-profile`; it is outside the repository and must remain private.

## Trust Boundary

The MCP client can supply local file paths, YAML, and Dify resource identifiers. Run the server only for trusted clients and review destructive operations. The server never intentionally returns cookies or authentication tokens.
