# Dify Template Catalog

Use only templates shipped in this repository unless the user provides another licensed source.

## Minimal LLM Workflow

Flow: `start -> llm -> end`

Use for summarization, scoring, rewriting, classification, HR review, contract review, and structured reports.

Bundled references:

- `templates/minimal-llm-workflow.yml`
- `../../../examples/strict-minimal.ir.json`
- `../../../examples/strict-minimal.generated.yml`
- `../../../examples/smart-resume-screening.yml`

## URL Analysis

Flow: `start(url, fallback_text) -> http-request -> code/llm -> end`

Use for public GitHub pages or other URLs. Always distinguish graph execution from successful content retrieval. Anti-bot pages, login pages, and empty HTML are business failures even if Dify reports `succeeded`.

Bundled references:

- `../../../examples/analysis-github-project.yml`
- `../../../examples/xhs-link-content-analysis.yml`

## Document Review

Flow: `start(file) -> document-extractor -> llm -> end`

Use for resumes, contracts, invoices, papers, and translation. Start from `../templates/document-review-workflow.yml` and verify the exact file-variable shape against an export from the target Dify version.

## Knowledge Retrieval

Flow: `start -> knowledge-retrieval -> llm -> end`

Use for internal policy Q&A, support, and grounded answers. Start from `../templates/rag-chatflow.yml`, call `dify_list_datasets`, and replace dataset IDs before import.

## Routing And Extraction

Routing and extraction node types vary more across Dify versions. Start from a fresh export made by the target Dify version, then use the rules in `generation-guide.md`; import/readback testing is mandatory.

## File Generation Bridge

Flow: `start -> llm/code -> http-request(file service) -> end`

Dify should orchestrate content. A separate approved service should generate binary files and return a stable contract such as `{file_url, file_name, mime_type}`.

## Batch Processing

Flow: `start(array) -> iteration -> aggregate -> end`

Use for multi-document review, batch translation, and repeated API calls. Iteration graph metadata is version-sensitive; validate against a target-version export.
