# Final Delivery Format

Use this format after creating, importing, and testing a Dify workflow. The goal is to make the result understandable without requiring the user to manually open Dify to discover runtime problems.

## Required Final Answer

Keep the final answer concise, but include all sections below.

```markdown
已用 Dify MCP 创建并导入工作流：**<应用名>**

应用地址：<Dify workflow URL>
App ID：`<app_id>`

它支持输入：
- `<input_1_label>`
- `<input_2_label>`
- `<input_3_label>`

测试结果：
- 运行状态：`<succeeded | failed | not_run>`
- 测试用例：<一句话说明输入是什么>
- 关键输出：<1-3 句概括最终输出是否符合预期>
- 抓取/外部依赖：<如果有 HTTP/API/工具调用，说明是否真的拿到目标内容>
- 发现的问题：<没有就写“未发现阻断问题”；有就直说>

结论：
<一句话说明这个工作流现在能做什么、不能保证什么、用户下一步怎么试。>

文件：
- `<name>.ir.json`
- `<name>.yml`
- `<name>.cases.json`
```

## Simplified Test Result Rules

Always distinguish these two layers:

- **Workflow runtime status**: whether Dify executed the graph successfully.
- **Business success status**: whether the workflow got the real business content needed for the task.

Examples:

- Good: "运行状态：`succeeded`；业务结果：成功获取 README 并生成项目分析。"
- Good: "运行状态：`succeeded`；业务结果：知乎返回安全验证页，没有获取正文/评论，工作流按预期提示缺失。"
- Bad: "测试通过。" This hides whether the content was actually useful.

## URL Scraping Workflows

For workflows that fetch webpages such as 小红书、知乎、公众号、抖音、B站、微博、Twitter/X, always report:

- HTTP status code when available.
- Page title or obvious blocker text when available.
- Whether target正文 was extracted.
- Whether target评论 was extracted.
- Whether fallback user-pasted content was used.
- Whether the final LLM report is based on real scraped content, pasted content, or empty/blocked content.

Use simple language. If the site blocks scraping, say it clearly:

```markdown
抓取/外部依赖：Dify 能访问该链接，但返回的是知乎安全验证/登录页面，不是正文页；正文和评论均未抓到。
发现的问题：如果用户不粘贴正文/评论，分析只能输出“内容缺失”，不能产生有效内容洞察。
```

## When Tests Cannot Be Run

If a test cannot be run, do not imply success. Use:

```markdown
测试结果：
- 运行状态：`not_run`
- 原因：<MCP 登录态失效 / Dify 网络不可达 / 模型未配置 / 用户未提供必要凭证>
- 已完成验证：<local validation/import/read draft 等>
- 风险：<用户手动测试时最可能遇到的问题>
```

## Recommended Test Cases

Every generated workflow should include at least one realistic test case. For external URL workflows, include:

- One URL-only case to expose scraping blockers.
- One fallback case with pasted content to prove the analysis path works.

If time is limited, run at least one case and state which case was not run.

## Repair Loop Guidance

When a test reveals a blocker:

1. Decide whether it is a workflow defect or an external limitation.
2. If it is a workflow defect, repair and rerun.
3. If it is an external limitation, update prompts/outputs so the workflow reports the limitation clearly.
4. Report the limitation in the final answer.

For example, if Zhihu returns a security verification page, do not keep trying the same plain HTTP request as if it were a code bug. Add or verify fallback inputs such as `pasted_content` and `pasted_comments`, then test that fallback path.
