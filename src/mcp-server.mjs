#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { validateDslFile } from "./dsl-validator.mjs";
import { renderIrToFile } from "./workflow-ir.mjs";
import {
  closeSharedContext,
  createDataset,
  createDocumentByFile,
  createDocumentByText,
  deleteApp,
  getConnectionStatus,
  getDraft,
  importDsl,
  listDatasets,
  listApps,
  listModels,
  openAppPage,
  openLoginPage,
  runDraft,
  testDraft,
} from "./dify-core.mjs";

export const server = new McpServer({
  name: "dify-workflow-mcp",
  version: "0.2.0-beta.1",
});

export const MCP_TOOL_NAMES = [];

function registerTool(...args) {
  MCP_TOOL_NAMES.push(args[0]);
  return server.tool(...args);
}

function asText(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

const datasetTargetShape = {
  dataset_id: z.string().uuid().optional().describe("Target Dify dataset id."),
  dataset_name: z.string().optional().describe("Exact dataset name, used when dataset_id is not provided."),
};

const documentIndexingShape = {
  indexing_technique: z
    .enum(["high_quality", "economy"])
    .optional()
    .describe("Defaults to the dataset setting, or economy for an uninitialized dataset."),
  doc_form: z.enum(["text_model", "hierarchical_model", "qa_model"]).default("text_model"),
  doc_language: z.string().default("Chinese"),
  duplicate: z.boolean().default(true).describe("Allow duplicate document content."),
  process_rule: z
    .record(z.string(), z.any())
    .optional()
    .describe("Optional Dify process_rule. Defaults to automatic chunking."),
  retrieval_model: z.record(z.string(), z.any()).optional().describe("Optional Dify retrieval model settings."),
  embedding_model: z.string().optional().describe("Embedding model for a new high-quality dataset."),
  embedding_model_provider: z.string().optional().describe("Embedding provider for a new high-quality dataset."),
};

registerTool(
  "dify_login",
  "Open a persistent browser profile for signing in to Dify. Use this once per machine or when the session expires.",
  {},
  async () => asText(await openLoginPage()),
);

registerTool(
  "dify_list_apps",
  "List Dify apps visible in the current workspace.",
  {
    name: z.string().optional().describe("Optional fuzzy name filter."),
    mode: z.string().default("all").describe("App mode filter, such as all or workflow."),
    limit: z.number().int().positive().max(100).default(20),
  },
  async (args) => asText(await listApps(args)),
);

registerTool(
  "dify_validate_dsl",
  "Validate a local Dify DSL YAML file before importing it.",
  {
    filePath: z.string().describe("Path to a local .yml/.yaml DSL file."),
  },
  async (args) => asText(await validateDslFile(args.filePath)),
);

registerTool(
  "dify_render_ir",
  "Render a strict Workflow IR JSON object into a Dify DSL YAML file and run local static validation.",
  {
    ir: z.record(z.string(), z.any()).describe("Workflow IR object."),
    filePath: z.string().describe("Output .yml/.yaml file path."),
  },
  async (args) => {
    const result = await renderIrToFile(args);
    return asText({
      filePath: result.filePath,
      id_map: result.id_map,
      static_validation: result.static_validation,
    });
  },
);

registerTool(
  "dify_list_datasets",
  "List Dify knowledge bases/datasets visible in the current workspace.",
  {
    keyword: z.string().optional().describe("Optional fuzzy keyword filter."),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
  },
  async (args) => asText(await listDatasets(args)),
);

registerTool(
  "dify_create_dataset",
  "Create an empty Dify knowledge base and return its dataset id.",
  {
    name: z.string().min(1).max(40).describe("Knowledge base name."),
    description: z.string().max(400).default(""),
    indexing_technique: z
      .enum(["high_quality", "economy"])
      .optional()
      .describe("Leave unset to choose indexing when the first document is added."),
    permission: z.enum(["only_me", "all_team_members"]).default("only_me"),
  },
  async (args) => asText(await createDataset(args)),
);

registerTool(
  "dify_create_document_by_text",
  "Create and index a Dify knowledge-base document directly from UTF-8 text.",
  {
    ...datasetTargetShape,
    text: z.string().min(1).describe("Document text content."),
    document_name: z.string().optional().describe("Document name; .txt is appended when no extension is provided."),
    ...documentIndexingShape,
  },
  async (args) => asText(await createDocumentByText(args)),
);

registerTool(
  "dify_create_document_by_file",
  "Upload a local document and index it in an existing Dify knowledge base.",
  {
    ...datasetTargetShape,
    filePath: z.string().describe("Absolute or current-working-directory-relative local file path."),
    document_name: z.string().optional().describe("Optional uploaded document name; defaults to the local file name."),
    ...documentIndexingShape,
  },
  async (args) => asText(await createDocumentByFile(args)),
);

registerTool(
  "dify_list_models",
  "List model providers and available models in the current Dify workspace.",
  {
    model_type: z
      .enum(["llm", "text-embedding", "rerank", "speech2text", "tts", "moderation"])
      .default("llm")
      .describe("Dify model type to list."),
    raw: z.boolean().default(false).describe("Include raw provider payload for endpoint adaptation/debugging."),
  },
  async (args) => asText(await listModels(args)),
);

registerTool(
  "dify_import_dsl",
  "Import a Dify DSL YAML file, optionally overwriting an existing app by app id.",
  {
    filePath: z.string().describe("Path to a local .yml/.yaml DSL file."),
    name: z.string().optional().describe("App name to use during import."),
    id: z.string().optional().describe("Existing app id to overwrite."),
  },
  async (args) => asText(await importDsl(args)),
);

registerTool(
  "dify_get_draft",
  "Read the draft workflow graph for an app.",
  {
    id: z.string().optional().describe("Dify app id."),
    name: z.string().optional().describe("Exact Dify app name. Used when id is not provided."),
    raw: z.boolean().default(false).describe("Return raw workflow draft instead of a node summary."),
  },
  async (args) => asText(await getDraft(args)),
);

registerTool(
  "dify_open_app",
  "Open or refresh a Dify app page in the shared browser so the user can inspect/use it.",
  {
    id: z.string().optional().describe("Dify app id."),
    name: z.string().optional().describe("Exact Dify app name. Used when id is not provided."),
    view: z
      .enum(["workflow", "overview", "develop", "monitoring", "logs", "api-access"])
      .default("workflow")
      .describe("App page view to open."),
    refresh: z.boolean().default(true).describe("Reload the page when already on the target app view."),
  },
  async (args) => asText(await openAppPage(args)),
);

registerTool(
  "dify_run_draft",
  "Run a draft workflow with input variables and return parsed workflow events and outputs.",
  {
    id: z.string().optional().describe("Dify app id."),
    name: z.string().optional().describe("Exact Dify app name. Used when id is not provided."),
    inputs: z.record(z.string(), z.any()).default({}).describe("Workflow start inputs."),
    raw: z.boolean().default(false).describe("Include raw SSE response."),
  },
  async (args) => asText(await runDraft(args)),
);

registerTool(
  "dify_test_draft",
  "Run multiple draft workflow test cases and evaluate expected status/outputs.",
  {
    id: z.string().optional().describe("Dify app id."),
    name: z.string().optional().describe("Exact Dify app name. Used when id is not provided."),
    cases: z
      .array(
        z.object({
          name: z.string().optional(),
          inputs: z.record(z.string(), z.any()).default({}),
          expect: z
            .object({
              status: z.string().optional(),
              outputs: z.record(z.string(), z.any()).optional(),
              error: z.any().optional(),
            })
            .default({}),
        }),
      )
      .describe("Test cases."),
  },
  async (args) => asText(await testDraft(args)),
);

registerTool(
  "dify_delete_app",
  "Delete a Dify app by id or exact name.",
  {
    id: z.string().optional().describe("Dify app id."),
    name: z.string().optional().describe("Exact Dify app name. Used when id is not provided."),
  },
  async (args) => asText(await deleteApp(args)),
);

registerTool(
  "dify_status",
  "Check whether Dify is reachable and the persistent browser session is authenticated.",
  {},
  async () => asText(await getConnectionStatus()),
);

process.on("SIGINT", async () => {
  await closeSharedContext().catch(() => {});
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeSharedContext().catch(() => {});
  process.exit(0);
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
