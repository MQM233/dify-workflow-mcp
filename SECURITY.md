# Security Policy

## Supported Versions

Security fixes are applied to the latest published beta or stable release.

## Reporting A Vulnerability

Do not open a public issue for vulnerabilities that expose sessions, credentials, or private Dify data. Use GitHub's private vulnerability reporting for this repository. Include impact, reproduction steps, affected version, and a suggested mitigation when available.

## Operator Guidance

- Protect `DIFY_PROFILE_DIR`; it contains an authenticated browser profile.
- Use a dedicated Dify test workspace for generated workflows.
- Review generated DSL and file paths before invoking write or delete tools.
- Never commit `.env`, browser profiles, cookies, or internal deployment URLs.
- Restrict filesystem and process permissions of the MCP client when handling untrusted prompts.
