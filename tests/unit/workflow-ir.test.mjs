import assert from "node:assert/strict";
import test from "node:test";
import { renderDifyDslFromIr, validateWorkflowIr } from "../../src/workflow-ir.mjs";

const ir = {
  app: { name: "Test workflow", mode: "workflow" },
  modelDefaults: { provider: "example/provider", name: "example-model", temperature: 0.1 },
  inputs: [{ name: "topic", type: "text-input", required: true }],
  nodes: [{ id: "writer", type: "llm", systemPrompt: "Answer briefly.", userPrompt: "Topic: {{#start.topic#}}" }],
  edges: [{ source: "start", target: "writer" }],
  outputs: [{ name: "answer", selector: "writer.text", valueType: "string" }],
};

test("renders valid canvas-safe DSL from workflow IR", () => {
  const result = renderDifyDslFromIr(ir);
  assert.equal(result.static_validation.ok, true);
  assert.equal(result.dsl.workflow.graph.nodes.length, 3);
  assert.equal(result.dsl.workflow.graph.edges.length, 2);
  assert.match(result.yaml, /name: Test workflow/);
  for (const node of result.dsl.workflow.graph.nodes) assert.equal(node.type, "custom");
  for (const edge of result.dsl.workflow.graph.edges) {
    assert.equal(edge.type, "custom");
    assert.equal(edge.zIndex, 0);
  }
});

test("rejects edges that reference missing nodes", () => {
  const result = validateWorkflowIr({ ...ir, edges: [{ source: "start", target: "missing" }] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Edge target does not exist/);
});
