# Dify Knowledge Base Guide

Use this guide when generating RAG, knowledge QA, document assistant, policy assistant, or dataset maintenance workflows.

## Core Concepts

- Dify calls knowledge bases "datasets" in APIs and DSL fields.
- In workflow DSL, a Knowledge Retrieval node uses `dataset_ids` to bind one or more knowledge bases.
- `dataset_ids` are normally static design-time IDs. Do not assume the user can choose arbitrary dataset IDs at runtime unless the target Dify version explicitly supports that.
- Knowledge Retrieval outputs `result`, an array of retrieved chunks. Downstream LLM nodes usually set `context.enabled: true` and `context.variable_selector` to the retrieval node's `result`.
- Dify Cloud knowledge bases are managed from `/datasets`. In the UI, users create/import documents, configure chunking, indexing, embedding, retrieval settings, metadata, and then link knowledge to apps or workflows.

## Official Behavior Summary

- A knowledge base is created by importing local documents or online data, choosing a chunking mode, configuring indexing/retrieval settings, waiting for embeddings, then linking it to an app.
- Knowledge Retrieval nodes require three design decisions: what query to search for, which knowledge bases to search, and how to process retrieval results.
- When multiple knowledge bases are selected, Dify retrieves from all selected knowledge bases and combines/reranks the results according to node-level settings.
- Node-level retrieval settings include rerank settings, Top K, and score threshold.
- Metadata filtering can restrict retrieval to documents matching metadata fields. Modes include disabled, automatic, and manual.
- The node outputs retrieval results as `result`; LLM nodes should use that output as context.

## Common Workflow Patterns

### RAG Chatflow

Flow: `start -> knowledge-retrieval -> llm -> answer`

Use when the user wants a conversational assistant grounded in one or more Dify knowledge bases.

Ask for:

- Dataset name or dataset ID.
- Whether answer should include citations/sources.
- Retrieval top_k and score threshold if the user has preferences.
- Whether unknown answers should say "I don't know" instead of guessing.

### One-Shot Knowledge Report

Flow: `start(query/form fields) -> knowledge-retrieval -> llm -> end`

Use for policy lookup, product comparison, internal document report, compliance answer, and support answer generation.

Default output: Markdown report plus JSON summary.

### Query Rewrite RAG

Flow: `start -> llm(query rewrite) -> knowledge-retrieval -> llm(answer) -> answer/end`

Use when raw user questions are vague, contain aliases, contain typos, or need retrieval keywords.

### Routed Knowledge QA

Flow: `start -> question-classifier -> knowledge-retrieval branch A/B/C -> llm/template -> answer/end`

Use when multiple departments or domains have separate datasets.

Important: each branch usually has its own static `dataset_ids`.

### Knowledge Maintenance Via API

Flow: `start -> parameter-extractor/code -> http-request(Dify Dataset API) -> end`

Use when the workflow should create a dataset, upload documents, create documents by text/file, list documents, or create chunks.

This requires a Knowledge Base API key and should normally run server-side only.

When the Dify MCP v0.2.0 knowledge tools are available, prefer them for console-session automation:

- `dify_create_dataset`: create an empty knowledge base and return `dataset_id`.
- `dify_create_document_by_text`: turn UTF-8 text into an uploaded `.txt` document and index it.
- `dify_create_document_by_file`: upload and index a local document.

These MCP tools reuse the persistent signed-in Dify console session, so they do not require a separate Knowledge Base API key. The API-key requirement above still applies when generating a Dify workflow that calls the public Knowledge Base API itself.

### External Knowledge Bridge

Flow: `start -> knowledge-retrieval(external dataset) -> llm -> answer/end`

Use when Dify is connected to an external knowledge base API. The external service must expose a retrieval endpoint compatible with Dify's External Knowledge API.

## Knowledge Retrieval Node Checklist

Required fields:

```yaml
type: knowledge-retrieval
query_variable_selector:
  - '1756000000001'
  - query
dataset_ids:
  - REPLACE_WITH_DATASET_ID
retrieval_mode: multiple
multiple_retrieval_config:
  top_k: 4
  score_threshold: null
  reranking_enable: false
```

For chatflow, `query_variable_selector` is often:

```yaml
query_variable_selector:
  - sys
  - query
```

For workflow mode, it usually points to a Start input:

```yaml
query_variable_selector:
  - '1756000000001'
  - question
```

LLM context should reference retrieval output:

```yaml
context:
  enabled: true
  variable_selector:
    - '1756000000002'
    - result
```

## Retrieval Settings

Use conservative defaults unless the user specifies otherwise:

- `retrieval_mode: multiple`
- `top_k: 4`
- `score_threshold: null`
- `reranking_enable: false`
- low LLM temperature such as `0.2` or `0.3`

Use reranking when:

- The knowledge base is large.
- Search results are noisy.
- The deployment has a configured rerank model.

Use metadata filtering when:

- Documents have reliable metadata.
- The user asks for filtering by department, product, region, date, version, or category.

## Clarification Questions For Knowledge Workflows

Ask these before generating if missing:

1. Which knowledge base should be used? Provide dataset name or ID.
2. Should the output cite source chunks/documents?
3. Should the workflow be a chat assistant or a one-shot report workflow?
4. What should happen if no relevant knowledge is found?
5. Can Dify access the knowledge directly, or should it use an external knowledge/API bridge?

## Dataset API Notes

Dify provides Knowledge Base APIs for creating/listing knowledge bases, creating documents by text/file, listing documents, retrieving document details, and managing chunks. API keys should be stored securely and not exposed in public DSL files.

For generated workflows, prefer placeholders:

```text
DIFY_DATASET_API_BASE
DIFY_DATASET_API_KEY
REPLACE_WITH_DATASET_ID
```

## Common Failure Modes

- Missing or deleted `dataset_ids`.
- Dataset exists in one workspace but workflow is imported into another.
- Retrieval settings differ from the knowledge base's successful test settings.
- Reranking is enabled but no rerank model is configured.
- Query selector points to the wrong variable.
- Using chatflow `sys.query` inside workflow mode where it is not available.
- Expecting users to select dataset IDs dynamically at runtime.

## Source URLs

- Knowledge Retrieval node: `https://docs.dify.ai/versions/3-7-x/en/user-guide/workflow/node/knowledge-retrieval`
- Create Knowledge Base: `https://docs.dify.ai/versions/3-0-x/en/user-guide/knowledge-base/knowledge-base-creation/introduction`
- Knowledge Base API index: `https://docs.dify.ai/llms.txt`
