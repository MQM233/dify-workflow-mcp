# Compatibility

## Runtime

- Node.js: 18 or newer.
- Windows: Chrome and Edge auto-detection included.
- macOS: Chrome and Edge auto-detection included, including Apple Silicon systems.
- Linux: common Google Chrome and Chromium paths included.

## Dify

The initial beta was developed against current Dify Cloud behavior and workflows shaped like DSL version `0.3.1`. Self-hosted deployments may differ by Dify version, enabled providers, plugins, reverse proxy, and SSO setup.

Because web-console APIs can change, compatibility means each operation must be verified against the target deployment. A successful import alone does not guarantee canvas rendering or runtime success.

## MCP Clients

The server uses standard MCP stdio transport. Codex integration and the bundled skill are the primary tested path. OpenClaw, Claude Code, WorkBuddy, and other stdio-capable clients are configuration targets; exact setup varies by client release and should not be considered tested until confirmed by a maintainer or contributor.
