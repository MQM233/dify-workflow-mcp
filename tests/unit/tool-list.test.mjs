import assert from "node:assert/strict";
import test from "node:test";
import { MCP_TOOL_NAMES } from "../../src/mcp-server.mjs";

test("registers the public MCP tool set exactly once", () => {
  assert.equal(MCP_TOOL_NAMES.length, 16);
  assert.equal(new Set(MCP_TOOL_NAMES).size, MCP_TOOL_NAMES.length);
  assert.deepEqual(MCP_TOOL_NAMES, [
    "dify_login", "dify_list_apps", "dify_validate_dsl", "dify_render_ir",
    "dify_list_datasets", "dify_create_dataset", "dify_create_document_by_text",
    "dify_create_document_by_file", "dify_list_models", "dify_import_dsl",
    "dify_get_draft", "dify_open_app", "dify_run_draft", "dify_test_draft",
    "dify_delete_app", "dify_status",
  ]);
});
