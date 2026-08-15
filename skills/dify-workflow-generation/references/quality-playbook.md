# Dify Generation Quality Playbook

## How To Improve Beyond Templates

1. Build a local example index from downloaded YAML files: app name, mode, node types, edges, providers, file upload, tools, and prompt snippets.
2. Retrieve 2-5 similar examples before generation and copy only the structure, not deployment-specific secrets/plugins.
3. Generate an intermediate workflow IR, then render YAML from the IR. This makes validation and repair easier.
4. Add a validator that checks graph integrity, selector integrity, model/provider fields, branch handles, and output contracts.
5. Add import/readback diffing: compare intended node list/edges with the draft graph Dify returns after import.
6. Add runtime test cases and repair loops using actual Dify errors.
7. Maintain a company-local provider/tool registry: approved models, plugin IDs, datasets, credentials, and HTTP endpoint conventions.
8. Keep golden workflows exported from company Dify and use them as templates for that deployment version.
9. Add domain prompt packs: HR, contract, invoice, customer service, knowledge QA, report generation.
10. Track failures in a small corpus: broken YAML, Dify error, fix, and final working YAML.

## Suggested Quality Score

Score each generated workflow out of 100:

- 20: requirement completeness and clear output contract
- 20: correct node schema and graph wiring
- 15: deployment-compatible providers/tools/datasets
- 15: prompt quality and evidence discipline
- 15: local validation/import/readback success
- 15: runtime tests and edge cases

Below 80 should trigger repair before user delivery.

## Runtime Result Discipline

- Do not treat `succeeded` as the whole test result. It only means Dify executed the graph.
- Also check whether the workflow obtained the business evidence it needs: webpage正文, comments, API data, retrieved knowledge chunks, extracted document text, or generated file URL.
- For web scraping workflows, a run is a business failure or degraded result if the page returns login, captcha, safety verification, anti-bot HTML, empty shell content, or only generic page chrome.
- When a blocker is external, repair the workflow by adding or verifying fallback inputs and clear limitation reporting instead of pretending the scraper worked.
- Final answers must follow `final-delivery-format.md` and include a simplified test result.
