import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

const KNOWN_NODE_TYPES = new Set([
  "answer",
  "code",
  "document-extractor",
  "end",
  "http-request",
  "if-else",
  "iteration",
  "iteration-start",
  "knowledge-retrieval",
  "llm",
  "parameter-extractor",
  "question-classifier",
  "start",
  "template-transform",
  "tool",
  "variable-aggregator",
]);

function add(list, level, message, pathName) {
  list.push({ level, message, path: pathName });
}

function collectSelectors(value, selectors = [], trail = []) {
  if (Array.isArray(value)) {
    if (
      value.length >= 2 &&
      value.every((item) => typeof item === "string") &&
      /selector$/i.test(trail.at(-1) || "")
    ) {
      selectors.push({ selector: value, path: trail.join(".") });
    }
    value.forEach((item, index) => collectSelectors(item, selectors, [...trail, String(index)]));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      collectSelectors(item, selectors, [...trail, key]);
    }
  }
  return selectors;
}

function collectPromptRefs(value, refs = [], trail = []) {
  if (typeof value === "string") {
    for (const match of value.matchAll(/\{\{\{?#([^.#{}]+)\.([^\s#{}]+)#\}?\}\}/g)) {
      refs.push({ selector: [match[1], match[2]], path: trail.join("."), raw: match[0] });
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collectPromptRefs(item, refs, [...trail, String(index)]));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      collectPromptRefs(item, refs, [...trail, key]);
    }
  }
  return refs;
}

function nodeOutputNames(node) {
  const type = node.data?.type;
  if (type === "start") return new Set((node.data?.variables || []).map((item) => item.variable).filter(Boolean));
  if (type === "llm") return new Set(["text", "usage"]);
  if (type === "document-extractor") return new Set(["text"]);
  if (type === "knowledge-retrieval") return new Set(["result"]);
  if (type === "template-transform") return new Set(["output"]);
  if (type === "parameter-extractor") return new Set(["output", ...(node.data?.parameters || []).map((item) => item.name)]);
  if (type === "code") return new Set(Object.keys(node.data?.outputs || {}));
  if (type === "http-request") return new Set(["body", "status_code", "headers"]);
  if (type === "tool") return new Set(["text", "files", "json"]);
  if (type === "variable-aggregator") return new Set(["output"]);
  return new Set(["output", "text"]);
}

export function validateDslObject(doc) {
  const issues = [];
  if (!doc || typeof doc !== "object") {
    add(issues, "error", "DSL is not a YAML object.", "$");
    return { ok: false, issues };
  }

  if (doc.kind !== "app") add(issues, "error", "Only kind: app is currently supported by this validator.", "kind");
  if (!doc.app?.name) add(issues, "error", "Missing app.name.", "app.name");
  if (!["workflow", "advanced-chat"].includes(doc.app?.mode)) {
    add(issues, "error", "app.mode should be workflow or advanced-chat.", "app.mode");
  }

  const nodes = doc.workflow?.graph?.nodes;
  const edges = doc.workflow?.graph?.edges;
  if (!Array.isArray(nodes)) add(issues, "error", "workflow.graph.nodes must be an array.", "workflow.graph.nodes");
  if (!Array.isArray(edges)) add(issues, "error", "workflow.graph.edges must be an array.", "workflow.graph.edges");
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return { ok: false, issues };

  const nodeById = new Map();
  for (const [index, node] of nodes.entries()) {
    const nodePath = `workflow.graph.nodes.${index}`;
    if (!node.id) {
      add(issues, "error", "Node is missing id.", nodePath);
      continue;
    }
    if (typeof node.id !== "string") add(issues, "error", "Node id must be a quoted string in YAML.", `${nodePath}.id`);
    if (nodeById.has(node.id)) add(issues, "error", `Duplicate node id ${node.id}.`, `${nodePath}.id`);
    nodeById.set(node.id, node);

    const type = node.data?.type;
    if (!type) add(issues, "error", "Node is missing data.type.", `${nodePath}.data.type`);
    else if (!KNOWN_NODE_TYPES.has(type)) add(issues, "warning", `Unknown node type ${type}.`, `${nodePath}.data.type`);

    if (node.type !== "custom") {
      add(
        issues,
        "warning",
        "Node missing top-level type: custom. Dify may import the DSL but the workflow canvas can fail to render.",
        `${nodePath}.type`,
      );
    }
    for (const key of ["width", "height", "sourcePosition", "targetPosition"]) {
      if (node[key] === undefined) {
        add(issues, "warning", `Node missing ${key}; exported Dify canvas nodes normally include it.`, `${nodePath}.${key}`);
      }
    }
    if (node.position && node.positionAbsolute) {
      const sameX = node.position.x === node.positionAbsolute.x;
      const sameY = node.position.y === node.positionAbsolute.y;
      if (!sameX || !sameY) {
        add(issues, "warning", "positionAbsolute differs from position; this can cause confusing canvas layout.", `${nodePath}.positionAbsolute`);
      }
    }

    if (type === "llm") {
      if (!node.data?.model?.provider) add(issues, "error", "LLM node missing model.provider.", `${nodePath}.data.model.provider`);
      if (!node.data?.model?.name) add(issues, "error", "LLM node missing model.name.", `${nodePath}.data.model.name`);
      if (!Array.isArray(node.data?.prompt_template) || node.data.prompt_template.length === 0) {
        add(issues, "error", "LLM node needs prompt_template.", `${nodePath}.data.prompt_template`);
      }
    }

    if (type === "start" && !Array.isArray(node.data?.variables)) {
      add(issues, "error", "Start node needs variables array.", `${nodePath}.data.variables`);
    }
    if (type === "start" && Array.isArray(node.data?.variables)) {
      for (const [variableIndex, variable] of node.data.variables.entries()) {
        if (variable.max_length !== undefined && Number(variable.max_length) <= 0) {
          add(
            issues,
            "warning",
            "Start variable max_length should be a positive number or omitted; 0 can break or confuse Dify form rendering.",
            `${nodePath}.data.variables.${variableIndex}.max_length`,
          );
        }
      }
    }

    if (type === "code") {
      if (node.data?.inputs && !node.data?.variables) {
        add(
          issues,
          "warning",
          "Code node uses data.inputs but Dify exports/imports code node variable bindings as data.variables; this may break canvas rendering.",
          `${nodePath}.data.inputs`,
        );
      }
      if (!node.data?.outputs || typeof node.data.outputs !== "object") {
        add(issues, "error", "Code node needs outputs map.", `${nodePath}.data.outputs`);
      }
      for (const [outputName, output] of Object.entries(node.data?.outputs || {})) {
        if (output && typeof output === "object" && !("children" in output)) {
          add(
            issues,
            "warning",
            `Code output ${outputName} missing children: null; exported Dify code outputs normally include it.`,
            `${nodePath}.data.outputs.${outputName}.children`,
          );
        }
      }
    }

    if (type === "end" && !Array.isArray(node.data?.outputs)) {
      add(issues, "error", "End node needs outputs array.", `${nodePath}.data.outputs`);
    }
  }

  const types = nodes.map((node) => node.data?.type);
  const startCount = types.filter((type) => type === "start").length;
  const endCount = types.filter((type) => type === "end").length;
  const answerCount = types.filter((type) => type === "answer").length;
  if (startCount !== 1) add(issues, "error", `Expected exactly one start node, found ${startCount}.`, "workflow.graph.nodes");
  if (doc.app?.mode === "workflow" && endCount < 1) add(issues, "error", "Workflow mode needs at least one end node.", "workflow.graph.nodes");
  if (doc.app?.mode === "advanced-chat" && answerCount < 1) {
    add(issues, "error", "Advanced-chat mode needs at least one answer node.", "workflow.graph.nodes");
  }

  for (const [index, edge] of edges.entries()) {
    const edgePath = `workflow.graph.edges.${index}`;
    if (!nodeById.has(edge.source)) add(issues, "error", `Edge source ${edge.source} does not exist.`, `${edgePath}.source`);
    if (!nodeById.has(edge.target)) add(issues, "error", `Edge target ${edge.target} does not exist.`, `${edgePath}.target`);
    if (!edge.sourceHandle) add(issues, "warning", "Edge missing sourceHandle.", `${edgePath}.sourceHandle`);
    if (!edge.targetHandle) add(issues, "warning", "Edge missing targetHandle.", `${edgePath}.targetHandle`);
    if (edge.type !== "custom") {
      add(issues, "warning", "Edge missing type: custom; exported Dify workflow edges normally include it.", `${edgePath}.type`);
    }
    if (edge.zIndex === undefined) {
      add(issues, "warning", "Edge missing zIndex: 0; exported Dify workflow edges normally include it.", `${edgePath}.zIndex`);
    }
    if (edge.isInIteration !== undefined || edge.isInLoop !== undefined) {
      add(
        issues,
        "warning",
        "Edge has isInIteration/isInLoop at top level. Dify exports these under edge.data; top-level placement may cause canvas/render issues.",
        edgePath,
      );
    }
    if (edge.data && (edge.data.isInIteration === undefined || edge.data.isInLoop === undefined)) {
      add(issues, "warning", "Edge data should include isInIteration and isInLoop.", `${edgePath}.data`);
    }
  }

  const selectors = [...collectSelectors(doc), ...collectPromptRefs(doc)];
  for (const ref of selectors) {
    const [nodeId, variable] = ref.selector;
    if (nodeId === "sys") continue;
    const node = nodeById.get(nodeId);
    if (!node) {
      add(issues, "error", `Selector references missing node ${nodeId}.`, ref.path);
      continue;
    }
    const outputs = nodeOutputNames(node);
    if (variable && !outputs.has(variable)) {
      add(issues, "warning", `Selector references ${nodeId}.${variable}; known outputs are ${[...outputs].join(", ")}.`, ref.path);
    }
  }

  return {
    ok: !issues.some((issue) => issue.level === "error"),
    issue_count: issues.length,
    errors: issues.filter((issue) => issue.level === "error").length,
    warnings: issues.filter((issue) => issue.level === "warning").length,
    app: {
      name: doc.app?.name,
      mode: doc.app?.mode,
      version: doc.version,
    },
    graph: {
      nodes: nodes.length,
      edges: edges.length,
      node_types: Object.fromEntries(
        [...new Set(types.filter(Boolean))].sort().map((type) => [type, types.filter((item) => item === type).length]),
      ),
    },
    issues,
  };
}

export async function validateDslFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const content = await readFile(absolutePath, "utf8");
  const doc = YAML.parse(content);
  return { filePath: absolutePath, ...validateDslObject(doc) };
}
