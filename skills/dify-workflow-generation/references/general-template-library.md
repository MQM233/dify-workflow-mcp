# General Dify Workflow Template Library

Use this as a first-pass selector for common workflow generation requests.

## 1. Minimal Text Processor

Flow: `start -> llm -> end`

Use for: summarization, rewriting, scoring, classification, analysis, extraction when no external dependency is needed.

Required inputs: text or form fields.

Default output: Markdown plus JSON summary when useful.

Template: `templates/minimal-llm-workflow.yml`

## 2. RAG Chat Assistant

Flow: `start -> knowledge-retrieval -> llm -> answer`

Use for: internal knowledge assistant, product/document QA, policy chatbot.

Required inputs: dataset ID(s), query source.

Template: `templates/rag-chatflow.yml`

## 3. Knowledge Report Workflow

Flow: `start -> knowledge-retrieval -> llm -> end`

Use for: one-shot policy answer, support answer, internal document report, compliance lookup.

Required inputs: dataset ID(s), query/form fields, output contract.

Template: `templates/knowledge-report-workflow.yml`

## 4. Document Review Workflow

Flow: `start(file) -> document-extractor -> llm -> end`

Use for: contract review, resume screening, document summary, paper analysis.

Required inputs: file variable, review criteria.

Template: `templates/document-review-workflow.yml`

## 5. HTTP Analysis Workflow

Flow: `start(url/form fields) -> code/parameter-extractor -> http-request -> code -> llm -> end`

Use for: GitHub analysis, webpage reader, API-backed lookup, data enrichment.

Required inputs: endpoint behavior, auth, response shape, error behavior.

Template: `templates/http-analysis-workflow.yml`

## 6. Routed Workflow

Flow: `start -> question-classifier/if-else -> branch nodes -> variable-aggregator/template -> end`

Use for: customer service routing, department routing, risk levels, multi-policy domains.

Required inputs: categories and branch behavior.

Template source: use node docs and fixtures until a concrete local template is added.

## 7. Batch Iteration Workflow

Flow: `start(array/files) -> iteration(children) -> aggregate/report -> end`

Use for: batch resume screening, batch file summary, batch API calls, multi-item scoring.

Required inputs: item type, output aggregation format, error behavior per item.

Template source: use iteration fixtures until a concrete local template is added.

## 8. File Generation Bridge

Flow: `start -> llm/template/code -> http-request(internal file service) -> answer/end`

Use for: Word, PPT, Excel, PDF, ZIP, image package generation.

Required inputs: file service URL, request schema, returned file URL/path.

Template: `templates/file-generation-bridge.yml`

## 9. Knowledge Maintenance Via API

Flow: `start -> code/parameter-extractor -> http-request(Dify Dataset API) -> end`

Use for: create knowledge base, create document by text/file, list documents, update chunks.

Required inputs: API base, API key, dataset ID, operation type.

Important: do not expose API keys in public YAML.

## Template Selection Rules

- Prefer the simplest template that satisfies the user's workflow.
- If the request mentions "knowledge base", "dataset", "RAG", "policy docs", or "internal docs", read `knowledge-base-guide.md`.
- If the request mentions "file output", choose File Generation Bridge.
- If the request mentions "batch", choose Batch Iteration.
- If the request mentions "different categories/departments/intents", choose Routed Workflow.
- If external dependencies are missing, ask clarification questions before writing YAML.
