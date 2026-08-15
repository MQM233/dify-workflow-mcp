# Dify Workflow Generation Rules For OpenClaw

Use these rules whenever the user asks OpenClaw to create, improve, import, test, or repair a Dify Workflow/Chatflow through the Dify MCP server.

## Goal

Turn natural-language workflow ideas into reliable Dify workflows:

1. Clarify ambiguous requirements.
2. Generate strict Workflow IR or Dify DSL YAML.
3. Validate locally before import.
4. Import through Dify MCP.
5. Read back the draft graph.
6. Run realistic tests.
7. Report a concise final result with test evidence and limitations.

Do not only say "created successfully". Always include a simplified test result.

## Required MCP Tools

Prefer these tools when available:

- `dify_list_models`: inspect available model providers before choosing an LLM.
- `dify_list_datasets`: inspect available knowledge bases for RAG workflows.
- `dify_create_dataset`: create an empty knowledge base when the requested one does not exist.
- `dify_create_document_by_text`: add UTF-8 text directly as an indexed knowledge document.
- `dify_create_document_by_file`: upload and index a local document in a knowledge base.
- `dify_render_ir`: render strict Workflow IR into Dify DSL.
- `dify_validate_dsl`: validate local Dify DSL before import.
- `dify_import_dsl`: import or overwrite a Dify app.
- `dify_get_draft`: read back the imported draft graph.
- `dify_run_draft`: run one workflow test case.
- `dify_test_draft`: run multiple test cases.
- `dify_open_app`: open or refresh the workflow page for the user.
- `dify_delete_app`: delete failed temporary apps when rollback is requested.

## Clarification Gate

If a one-line request could reasonably mean multiple workflows, ask a few focused questions before creating the workflow.

Ask only what prevents a wrong workflow:

- Input shape: text, URL, file, image, batch list, chat message, form fields.
- Output contract: report, JSON, score, generated file, API action, database update.
- App mode: one-shot workflow or conversational chatflow.
- External dependencies: HTTP APIs, Dify tools/plugins, MCP services, knowledge bases, credentials, company-local services.
- Model/provider: deployment default, DeepSeek, OpenAI, or a specific company model.
- Success tests: one normal case and one edge/error case.

If the user wants speed and the missing detail has a safe default, state the assumption and continue.

## Generation Rules

- Prefer strict Workflow IR first, then render YAML using `dify_render_ir`.
- If writing YAML directly, follow existing Dify DSL examples and local templates.
- Use provider/model values that exist in the target Dify workspace. Call `dify_list_models` when available.
- For this tested cloud workspace, the known working model was:
  - provider: `langgenius/deepseek/deepseek`
  - name: `deepseek-chat`
- Generate artifacts together:
  - `<name>.ir.json` when using IR
  - `<name>.yml`
  - `<name>.cases.json`
  - optional `<name>.notes.md`
- Include stable named outputs so downstream users can rely on them.
- For high-risk business workflows, include missing-information and human-review sections.

## Quality Gates

Never claim a workflow is ready unless these pass, or clearly state which one failed:

- Local YAML/static validation passes.
- Dify import accepts the DSL.
- Draft graph can be read back.
- At least one realistic test case runs.
- For branching, extraction, document, HTTP/tool, RAG, or iteration workflows, include an edge/error case when feasible.
- Final response includes simplified test results and known limitations.

## Dify Canvas Render Safety

Dify can accept an imported DSL but still fail when the user opens the workflow page with an error such as "an unexpected error occurred while rendering this component". This usually means the YAML shape is close enough for import, but not close enough for the Dify frontend canvas.

Avoid simplified graph shapes. Match exported Dify DSL.

Every graph node should include:

- Top-level `type: custom`.
- `data.type` with the actual Dify node type.
- `width`, `height`, `sourcePosition: right`, and `targetPosition: left`.
- `position` and `positionAbsolute` with the same `x` and `y`.

For code nodes, use `data.variables`, not a simplified `data.inputs` map:

```yaml
data:
  type: code
  variables:
    - variable: input_text
      value_selector:
        - '1756000000001'
        - input_text
  outputs:
    result:
      type: string
      children: null
```

Do not generate this simplified shape:

```yaml
data:
  inputs:
    input_text:
      type: variable
      value:
        - '1756000000001'
        - input_text
```

Start node variables should omit `max_length` or use a positive number. Do not use `max_length: 0`.

Every graph edge should include:

- `type: custom`
- `zIndex: 0`
- `data.sourceType`
- `data.targetType`
- `data.isInIteration: false`
- `data.isInLoop: false`

Put `isInIteration` and `isInLoop` under `edge.data`, not at the edge top level.

## Runtime Result Discipline

Do not treat `succeeded` as the whole test result.

Always distinguish:

- **Workflow runtime status**: whether Dify executed the graph.
- **Business success status**: whether the workflow actually got the evidence/content needed for the user task.

Examples:

- Good: `运行状态：succeeded；业务结果：成功获取 README 并生成项目分析。`
- Good: `运行状态：succeeded；业务结果：知乎返回安全验证页，未获取正文/评论，工作流按预期提示内容缺失。`
- Bad: `测试通过。`

## URL Scraping Workflows

For workflows that fetch webpages, such as 小红书、知乎、公众号、抖音、B站、微博、Twitter/X, always report:

- HTTP status code when available.
- Page title or obvious blocker text when available.
- Whether target正文 was extracted.
- Whether target评论 was extracted.
- Whether fallback user-pasted content was used.
- Whether the final report is based on scraped content, pasted content, or empty/blocked content.

If a site blocks scraping, say it plainly:

```text
抓取/外部依赖：Dify 能访问该链接，但返回的是安全验证/登录/反爬页面，不是目标正文页；正文和评论未抓到。
发现的问题：如果用户不粘贴正文/评论，分析只能输出内容缺失，不能产生有效洞察。
```

For external URL workflows, include two test cases when feasible:

- URL-only case to expose scraping blockers.
- Fallback case with pasted content/comments to prove the analysis path works.

## Required Final Answer Format

Use this final format after creating/importing/testing a workflow:

```markdown
已用 Dify MCP 创建并导入工作流：**<应用名>**

应用地址：<Dify workflow URL>
App ID：`<app_id>`

它支持输入：
- `<输入1>`
- `<输入2>`
- `<输入3>`

测试结果：
- 运行状态：`<succeeded | failed | not_run>`
- 测试用例：<一句话说明测试输入>
- 关键输出：<1-3 句概括输出是否符合预期>
- 抓取/外部依赖：<如果有 HTTP/API/工具调用，说明是否真的拿到目标内容>
- 发现的问题：<没有就写“未发现阻断问题”；有就直说>

结论：
<一句话说明这个工作流现在能做什么、不能保证什么、用户下一步怎么试。>

文件：
- `<name>.ir.json`
- `<name>.yml`
- `<name>.cases.json`
```

If tests cannot be run:

```markdown
测试结果：
- 运行状态：`not_run`
- 原因：<MCP 登录态失效 / Dify 网络不可达 / 模型未配置 / 用户未提供必要凭证>
- 已完成验证：<local validation/import/read draft 等>
- 风险：<用户手动测试时最可能遇到的问题>
```

## Repair Loop

When a test reveals a blocker:

1. Decide whether it is a workflow defect or an external limitation.
2. If it is a workflow defect, repair and rerun.
3. If it is an external limitation, update prompts/outputs so the workflow reports the limitation clearly.
4. Report the limitation in the final answer.

For example, if Zhihu returns a safety verification page, do not keep retrying the same plain HTTP request as if it were a code bug. Add or verify fallback inputs such as `pasted_content` and `pasted_comments`, then test that fallback path.
