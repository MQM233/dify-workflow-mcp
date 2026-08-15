# Dify Workflow Clarification Guide

Use this guide when the user asks for a Dify workflow with only a short idea, title, or vague process.

## Goal

Ask just enough questions to avoid generating the wrong workflow. The aim is not to make the user write a full spec; the aim is to convert a fuzzy request into a reliable workflow brief.

## When To Ask

Ask clarification questions when any missing detail would change the workflow graph, importability, or runtime behavior.

High-impact missing details:

- Input: text, file, URL, multiple files, batch list, chat query, form fields.
- Output: natural-language answer, Markdown report, JSON, file, API/database write, routing decision.
- Mode: one-shot workflow or advanced-chat.
- External calls: HTTP endpoint, plugin/tool, MCP service, knowledge base, company proxy.
- Credentials: API key, bearer token, Dify dataset id, internal service URL.
- Error behavior: fail fast, return controlled error report, retry, manual review.
- Test data: at least one positive example; one edge case for HTTP/file/branch workflows.

## When Not To Ask

Do not ask when a safe default is obvious and reversible:

- Use workflow mode for one-shot business automation.
- Use advanced-chat for open-ended assistant/chatbot behavior.
- Use the deployment default model when the user did not care about model choice.
- Use Markdown report plus JSON summary for analysis/scoring/report tasks.
- Use Start -> LLM -> End as a minimum viable flow for pure text transformation.

State assumptions briefly and continue when speed matters.

## Question Budget

Ask at most 5 questions. Prefer 2-4. Group related choices in one question.

Good question shape:

- "输入是什么：文本、文件、URL，还是批量列表？"
- "输出希望是什么：Markdown 报告、JSON、文件，还是写入某个系统？"
- "是否需要调用外部 API/知识库/公司内部服务？如果需要，地址或名称是什么？"
- "这是一次性运行的 workflow，还是要做成可连续对话的 chatflow？"
- "给我一个最小测试样例，包含输入和你期望的大致输出。"

Avoid asking:

- Long questionnaires.
- Questions whose answers can be inferred from the app name.
- UI/layout questions before the functional graph is clear.

## Clarification-To-Brief Template

After the user answers, convert to this brief before YAML:

```text
App name:
Mode:
Inputs:
Outputs:
Node plan:
External dependencies:
Model/provider:
Success tests:
Assumptions:
```

## Examples

### Short Request

User: "做一个简历筛选 Dify 工作流"

Ask:

1. 简历输入是纯文本、PDF/DOCX 文件，还是批量文件？
2. 岗位 JD 是每次输入，还是固定在提示词里？
3. 输出只要评分报告，还是要 JSON 字段方便 HR 系统读取？

### Ambiguous Tool Request

User: "做一个生成 Word 的工作流"

Ask:

1. Word 内容来自用户文本、LLM 生成、网页/文件解析，还是固定模板填充？
2. 你希望 Dify 直接返回下载链接，还是写入公司文件系统/对象存储？
3. 是否已有内网 Word 生成服务，还是需要我建议一个 HTTP bridge 服务？

### Integration Request

User: "做一个同步客户信息的工作流"

Ask:

1. 客户信息从哪里来，输入字段有哪些？
2. 要同步到哪个系统/API？是否有接口文档或示例请求？
3. 失败时要停止、重试，还是输出人工处理清单？
