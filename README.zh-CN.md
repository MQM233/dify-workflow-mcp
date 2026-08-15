# Dify Workflow MCP

[![CI](https://github.com/MQM233/dify-workflow-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/MQM233/dify-workflow-mcp/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

把一句自然语言需求变成可验证、可导入、可测试的 Dify Workflow 或 Chatflow。项目向支持 MCP 的智能体提供 16 个工具，覆盖 DSL 生成、画布安全校验、模型发现、工作流导入与测试、知识库创建及文档索引。

简体中文 | [English](README.md)

> 当前为 Beta。Dify Web 控制台接口并非稳定的公开接口，生产使用前请固定版本并在目标 Dify 部署上验证。

## 解决什么问题

只生成 YAML 不难，难的是保证它能被 Dify 接受、能正常渲染画布、选到当前工作区已有的模型、跑过真实测试，并在网页抓取受阻时如实说明。本项目把这些步骤连成一个完整闭环。

## 主要能力

- 由严格 Workflow IR 生成 Dify DSL YAML。
- 导入前检查节点、连线、变量引用、模型配置和画布渲染风险。
- 复用一个已登录的 Chrome、Edge 或 Chromium profile，减少反复开关浏览器。
- 查询当前工作区的应用、模型和知识库。
- 创建知识库，并用文本或本地文件建立索引。
- 导入或覆盖工作流、回读草稿、执行单条或批量测试、删除临时测试应用。
- 自带适用于 Codex、OpenClaw、Claude Code、WorkBuddy 等 MCP 客户端的规则、模板和示例。
- 区分“工作流运行成功”和“业务内容真正获取成功”，避免把反爬页面误报为测试通过。

## 快速开始

需要 Node.js 18+，以及 Chrome、Edge 或 Chromium。

```bash
git clone https://github.com/MQM233/dify-workflow-mcp.git
cd dify-workflow-mcp
npm install
```

设置 Dify 地址：

```powershell
$env:DIFY_BASE_URL="https://cloud.dify.ai"
```

在 MCP 客户端中添加：

```json
{
  "mcpServers": {
    "dify-workflow": {
      "command": "node",
      "args": ["D:/absolute/path/dify-workflow-mcp/src/mcp-server.mjs"],
      "env": { "DIFY_BASE_URL": "https://cloud.dify.ai" }
    }
  }
}
```

重启客户端后，首次调用 `dify_login` 并在浏览器完成登录，再调用 `dify_status` 验证。不同客户端的配置见 [客户端配置](docs/client-configuration.md)。

Codex 用户还可以安装随项目提供的生成 skill：

```powershell
.\scripts\install.ps1 -InstallCodexSkill
```

## 安全提示

本服务控制一个保持登录态的浏览器 profile，并能创建或删除 Dify 资源。不要分享 profile 目录；处理敏感业务前先检查生成的 DSL，优先在专用测试工作区验证。仓库不包含 Cookie 或凭据。

## 开发验证

```bash
npm run check
npm test
npm run validate:examples
npm pack --dry-run
```

项目采用 [Apache-2.0](LICENSE) 协议，欢迎通过 Issue 和 Pull Request 参与改进。
