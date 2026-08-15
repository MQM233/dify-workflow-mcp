---
name: dify-workflow-generation
description: Generate, improve, validate, import, test, and repair Dify Workflow/Chatflow DSL YAML from natural language requirements using local templates, example cases, and the Dify MCP automation tool.
---

# Dify Workflow Generation

Use this skill when a user asks to turn an idea into a Dify workflow, improve generated Dify YAML, import/test a DSL in Dify, or repair a Dify workflow after import/runtime errors.

## Operating Flow

1. Run the clarification gate. If the request is too short or ambiguous, ask focused questions before writing YAML. See `references/clarification-guide.md`.
2. Convert the requirement into a short workflow brief: app mode, input schema, output contract, node list, edges, model/tool dependencies, and test cases.
3. Select the closest pattern from `references/template-catalog.md`.
4. For common patterns, read `references/general-template-library.md`; for RAG/knowledge-base work, also read `references/knowledge-base-guide.md`.
5. Load exact node/schema guidance from `references/generation-guide.md` before writing YAML.
6. Before starting implementation, read `references/final-delivery-format.md` so the final answer includes the required creation, input, test, limitation, and artifact summary.
7. Generate these artifacts together:
   - `<name>.yml`
   - `<name>.cases.json`
   - optional `<name>.notes.md` for behavior, assumptions, and deployment dependencies
8. Run local validation with `npm run dify -- validate <file.yml>`.
9. Import with MCP/CLI, read draft, run test cases, and repair until validation/import/runtime results are acceptable.
10. In the final response, use the fixed delivery format from `references/final-delivery-format.md`. Always include a simplified test result; do not only say "created successfully".

## Clarification Gate

Proceed directly only when the request clearly defines the workflow goal, input, output, and any external dependency. If a one-line request could reasonably map to multiple workflows, ask up to 5 concise questions before generating.

Ask questions when these are unclear:

- Input shape: text, file, URL, batch array, chat message, form fields.
- Output contract: answer text, structured JSON, document/file, database/API action, score/report.
- App mode: one-shot workflow vs conversational chatflow.
- External dependencies: HTTP APIs, Dify tools/plugins, MCP services, knowledge bases, credentials, company-local services.
- Model/provider: use deployment default, DeepSeek, OpenAI, or a specific company model.
- Success tests: one normal case and one edge/error case.

Do not ask about everything. Ask only the few questions that prevent a wrong workflow. If the user wants speed and the missing detail has a safe default, state the assumption and continue.

Example:

User: "做一个 GitHub 项目解读工作流"

Good clarification:

1. 用户输入是 GitHub URL 还是仓库名 owner/repo？
2. 需要只读 README，还是还要读取目录结构/语言/星标等仓库元数据？
3. 输出要普通中文报告，还是同时要 JSON 摘要字段？
4. Dify 是否能直接访问 GitHub，还是要走公司内网代理？

## Quality Gates

Never claim a workflow is ready unless these pass or the limitation is stated:

- Local YAML/static validation passes.
- Dify import accepts the DSL.
- Draft graph can be read back.
- At least one positive test case runs.
- The final response includes a simplified test result with runtime status, key output summary, and known content/tool limitations.
- For URL/content scraping workflows, separately report whether the HTTP/tool step actually obtained useful target content. If a site returned login, captcha, safety verification, empty shell HTML, or blocked content, say that plainly even when the workflow status is `succeeded`.
- For branching, extraction, document, HTTP/tool, or iteration workflows, include a negative or edge case.
- Generated output has a stable contract that downstream HR/ops/business users can rely on.

## Source Material

Use local references first:

- `references/clarification-guide.md`: when and how to ask requirement questions.
- `references/generation-guide.md`: core DSL generation rules.
- `references/final-delivery-format.md`: required final answer format after creating/importing/testing a workflow.
- `references/general-template-library.md`: common workflow patterns and local template files.
- `references/knowledge-base-guide.md`: Dify dataset/knowledge base retrieval and API patterns.
- `references/template-catalog.md`: reusable workflow patterns.
- `references/quality-playbook.md`: validation and repair ideas.

Important: do not blindly copy example YAML. Many examples use older DSL versions, old plugin identifiers, or deployment-specific tools.

## Dify Local Deployment Defaults

Prefer provider/config values that the target deployment actually has. Before generating LLM, embedding, or rerank nodes, call `dify_list_models` when available and choose a model from the current workspace. If model listing is unavailable, use the deployment default or placeholders in the brief and keep the YAML structurally valid.

For this workspace, the verified cloud test model was:

- provider: `langgenius/deepseek/deepseek`
- name: `deepseek-chat`

## When Improving Generation Quality

Prioritize:

- Pattern retrieval from local examples before writing new node structures.
- A workflow IR before YAML.
- Static validation before browser automation.
- Import/readback/runtime testing before calling it done.
- Repair loops that use concrete Dify error text and draft graph output.
