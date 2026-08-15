import assert from "node:assert/strict";
import test from "node:test";
import { validateDslObject } from "../../src/dsl-validator.mjs";

test("reports missing graph nodes and edges", () => {
  const result = validateDslObject({ kind: "app", app: { name: "Broken", mode: "workflow" }, workflow: { graph: {} } });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === "workflow.graph.nodes"));
  assert.ok(result.issues.some((issue) => issue.path === "workflow.graph.edges"));
});

test("warns about unsafe canvas wrappers", () => {
  const result = validateDslObject({
    kind: "app", version: "0.3.1", app: { name: "Unsafe", mode: "workflow" },
    workflow: { graph: {
      nodes: [{ id: "1", data: { type: "start", variables: [] } }, { id: "2", data: { type: "end", outputs: [] } }],
      edges: [{ id: "1-2", source: "1", target: "2" }],
    } },
  });
  assert.equal(result.ok, true);
  assert.ok(result.warnings > 0);
  assert.ok(result.issues.some((issue) => issue.message.includes("type: custom")));
});
