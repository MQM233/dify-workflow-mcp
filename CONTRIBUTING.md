# Contributing

Thanks for helping make Dify workflow automation more reliable.

## Before Opening A Pull Request

1. Open an issue for behavior changes or new Dify-version assumptions.
2. Keep changes focused and do not commit browser profiles, cookies, credentials, internal URLs, or generated runtime bundles.
3. Add or update tests and examples for changed DSL behavior.
4. Run `npm run check`, `npm test`, and `npm run validate:examples`.
5. Explain which Dify edition/version and browser you tested.

## Design Principles

- Prefer target-version Dify exports over guessed YAML shapes.
- Treat import, canvas rendering, and runtime behavior as separate quality gates.
- Keep browser operations serialized and reuse one profile/context.
- Return structured, actionable errors without secrets.
- Do not add third-party templates unless their license permits redistribution and attribution is included.

By contributing, you agree that your contribution is licensed under Apache-2.0.
