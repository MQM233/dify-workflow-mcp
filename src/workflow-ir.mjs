import { writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { validateDslObject } from "./dsl-validator.mjs";

const InputSchema = z.object({
  name: z.string().min(1),
  label: z.string().optional(),
  type: z.enum(["text-input", "paragraph", "select", "number", "file", "file-list"]).default("text-input"),
  required: z.boolean().default(true),
  max_length: z.number().int().positive().optional(),
  options: z.array(z.string()).default([]),
  default: z.any().optional(),
});

const SelectorSchema = z.union([z.string(), z.array(z.string())]);

const BaseNodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  desc: z.string().default(""),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});

const CodeNodeSchema = BaseNodeSchema.extend({
  type: z.literal("code"),
  language: z.enum(["python3", "javascript"]).default("python3"),
  code: z.string(),
  inputs: z
    .array(
      z.object({
        name: z.string().min(1),
        selector: SelectorSchema,
      }),
    )
    .default([]),
  outputs: z.record(z.string(), z.enum(["string", "number", "object", "array", "boolean"])).default({ result: "string" }),
});

const HttpNodeSchema = BaseNodeSchema.extend({
  type: z.literal("http-request"),
  method: z.enum(["get", "post", "put", "patch", "delete", "head"]).default("get"),
  url: z.string().min(1),
  headers: z.string().default(""),
  params: z.string().default(""),
  bodyType: z.enum(["none", "json", "raw-text", "form-data", "x-www-form-urlencoded", "binary"]).default("none"),
  body: z.string().default(""),
  inputs: z
    .array(
      z.object({
        name: z.string().min(1),
        selector: SelectorSchema,
      }),
    )
    .default([]),
});

const LlmNodeSchema = BaseNodeSchema.extend({
  type: z.literal("llm"),
  systemPrompt: z.string().default(""),
  userPrompt: z.string().default(""),
  model: z
    .object({
      provider: z.string().optional(),
      name: z.string().optional(),
      mode: z.string().default("chat"),
      temperature: z.number().default(0.2),
    })
    .default({}),
  contextSelector: SelectorSchema.optional(),
});

const KnowledgeNodeSchema = BaseNodeSchema.extend({
  type: z.literal("knowledge-retrieval"),
  querySelector: SelectorSchema,
  datasetIds: z.array(z.string()).min(1),
  retrievalMode: z.enum(["multiple", "single"]).default("multiple"),
  topK: z.number().int().positive().default(4),
  scoreThreshold: z.number().nullable().default(null),
  rerankingEnable: z.boolean().default(false),
});

const EndNodeSchema = BaseNodeSchema.extend({
  type: z.literal("end"),
  outputs: z.array(
    z.object({
      name: z.string().min(1),
      selector: SelectorSchema,
      valueType: z.enum(["string", "number", "object", "array", "boolean"]).default("string"),
    }),
  ),
});

const AnswerNodeSchema = BaseNodeSchema.extend({
  type: z.literal("answer"),
  answer: z.string(),
});

const NodeSchema = z.discriminatedUnion("type", [
  CodeNodeSchema,
  HttpNodeSchema,
  LlmNodeSchema,
  KnowledgeNodeSchema,
  EndNodeSchema,
  AnswerNodeSchema,
]);

const IrSchema = z.object({
  app: z.object({
    name: z.string().min(1),
    mode: z.enum(["workflow", "advanced-chat"]).default("workflow"),
    description: z.string().default(""),
    icon: z.string().default("🤖"),
    icon_background: z.string().default("#FFEAD5"),
  }),
  modelDefaults: z
    .object({
      provider: z.string().default("langgenius/deepseek/deepseek"),
      name: z.string().default("deepseek-chat"),
      temperature: z.number().default(0.2),
    })
    .default({}),
  inputs: z.array(InputSchema).default([]),
  nodes: z.array(NodeSchema).default([]),
  edges: z
    .array(
      z.object({
        source: z.string().min(1),
        target: z.string().min(1),
        sourceHandle: z.string().default("source"),
        targetHandle: z.string().default("target"),
      }),
    )
    .default([]),
  outputs: z
    .array(
      z.object({
        name: z.string().min(1),
        selector: SelectorSchema,
        valueType: z.enum(["string", "number", "object", "array", "boolean"]).default("string"),
      }),
    )
    .default([]),
});

function numericId(index) {
  return String(1757000000001 + index).padStart(13, "0");
}

function normalizeSelector(selector) {
  if (Array.isArray(selector)) return selector;
  const parts = selector.split(".");
  if (parts.length < 2) throw new Error(`Invalid selector ${selector}. Use "node.variable" or ["node","variable"].`);
  return [parts[0], ...parts.slice(1)];
}

function replaceRefs(value, idMap) {
  if (typeof value !== "string") return value;
  return value.replace(/\{\{\{?#([^.#{}]+)\.([^\s#{}]+)#\}?\}\}/g, (match, nodeId, variable) => {
    const mapped = nodeId === "sys" ? "sys" : idMap.get(nodeId) || nodeId;
    return match.replace(`#${nodeId}.${variable}#`, `#${mapped}.${variable}#`);
  });
}

function mapSelector(selector, idMap) {
  const normalized = normalizeSelector(selector);
  const [first, ...rest] = normalized;
  return [first === "sys" ? "sys" : idMap.get(first) || first, ...rest];
}

function mapVariables(inputs, idMap) {
  return inputs.map((input) => ({
    variable: input.name,
    value_selector: mapSelector(input.selector, idMap),
  }));
}

function commonWrapper(node, id, index) {
  const position = node.position || { x: 80 + (index + 1) * 340, y: 260 };
  return {
    id,
    type: "custom",
    sourcePosition: "right",
    targetPosition: "left",
    position,
    positionAbsolute: position,
    width: 244,
    height: 98,
  };
}

function renderStartNode(ir, id) {
  return {
    id,
    type: "custom",
    sourcePosition: "right",
    targetPosition: "left",
    position: { x: 80, y: 260 },
    positionAbsolute: { x: 80, y: 260 },
    width: 244,
    height: 98,
    data: {
      title: "Start",
      type: "start",
      variables: ir.inputs.map((input) => ({
        variable: input.name,
        label: input.label || input.name,
        type: input.type,
        required: input.required,
        max_length: input.max_length,
        options: input.options,
        default: input.default,
      })),
    },
  };
}

function renderNode(node, id, index, ir, idMap) {
  const wrapper = commonWrapper(node, id, index);
  if (node.type === "code") {
    return {
      ...wrapper,
      data: {
        title: node.title || "Code",
        desc: node.desc,
        type: "code",
        code_language: node.language,
        code: node.code,
        variables: mapVariables(node.inputs, idMap),
        outputs: Object.fromEntries(
          Object.entries(node.outputs).map(([name, type]) => [name, { type, children: null }]),
        ),
      },
    };
  }

  if (node.type === "http-request") {
    return {
      ...wrapper,
      data: {
        title: node.title || "HTTP Request",
        desc: node.desc,
        type: "http-request",
        method: node.method,
        url: replaceRefs(node.url, idMap),
        headers: replaceRefs(node.headers, idMap),
        params: replaceRefs(node.params, idMap),
        body: {
          type: node.bodyType,
          data: node.bodyType === "none" ? [] : [{ id: `${id}-body`, key: "", type: "text", value: replaceRefs(node.body, idMap) }],
        },
        authorization: { type: "no-auth", config: null },
        timeout: { max_connect_timeout: 0, max_read_timeout: 0, max_write_timeout: 0 },
        variables: mapVariables(node.inputs, idMap),
      },
    };
  }

  if (node.type === "knowledge-retrieval") {
    return {
      ...wrapper,
      data: {
        title: node.title || "Knowledge Retrieval",
        desc: node.desc,
        type: "knowledge-retrieval",
        query_variable_selector: mapSelector(node.querySelector, idMap),
        dataset_ids: node.datasetIds,
        retrieval_mode: node.retrievalMode,
        multiple_retrieval_config: {
          top_k: node.topK,
          score_threshold: node.scoreThreshold,
          reranking_enable: node.rerankingEnable,
        },
        metadata_filtering_mode: "disabled",
      },
    };
  }

  if (node.type === "llm") {
    const model = {
      provider: node.model.provider || ir.modelDefaults.provider,
      name: node.model.name || ir.modelDefaults.name,
      mode: node.model.mode || "chat",
      completion_params: { temperature: node.model.temperature ?? ir.modelDefaults.temperature },
    };
    return {
      ...wrapper,
      data: {
        title: node.title || "LLM",
        desc: node.desc,
        type: "llm",
        model,
        prompt_template: [
          ...(node.systemPrompt ? [{ role: "system", text: replaceRefs(node.systemPrompt, idMap) }] : []),
          ...(node.userPrompt ? [{ role: "user", text: replaceRefs(node.userPrompt, idMap) }] : []),
        ],
        variables: [],
        context: node.contextSelector
          ? { enabled: true, variable_selector: mapSelector(node.contextSelector, idMap) }
          : { enabled: false, variable_selector: [] },
        vision: { enabled: false },
        ...(ir.app.mode === "advanced-chat" ? { memory: { query_prompt_template: "{{#sys.query#}}", window: { enabled: false, size: 10 } } } : {}),
      },
    };
  }

  if (node.type === "end") {
    return {
      ...wrapper,
      data: {
        title: node.title || "End",
        desc: node.desc,
        type: "end",
        outputs: node.outputs.map((output) => ({
          variable: output.name,
          value_selector: mapSelector(output.selector, idMap),
          value_type: output.valueType,
        })),
      },
    };
  }

  if (node.type === "answer") {
    return {
      ...wrapper,
      data: {
        title: node.title || "Answer",
        desc: node.desc,
        type: "answer",
        answer: replaceRefs(node.answer, idMap),
        variables: [],
      },
    };
  }

  throw new Error(`Unsupported node type ${node.type}`);
}

function inferNodeType(id, nodes) {
  const node = nodes.find((item) => item.id === id);
  if (id === "start") return "start";
  return node?.type || "unknown";
}

export function validateWorkflowIr(input) {
  const parsed = IrSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  }
  const ir = parsed.data;
  const ids = new Set(["start"]);
  const errors = [];
  for (const node of ir.nodes) {
    if (ids.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
    ids.add(node.id);
  }
  for (const edge of ir.edges) {
    if (!ids.has(edge.source)) errors.push(`Edge source does not exist: ${edge.source}`);
    if (!ids.has(edge.target)) errors.push(`Edge target does not exist: ${edge.target}`);
  }
  if (ir.app.mode === "workflow" && !ir.outputs.length && !ir.nodes.some((node) => node.type === "end")) {
    errors.push("Workflow mode needs outputs or an explicit end node.");
  }
  if (ir.app.mode === "advanced-chat" && !ir.nodes.some((node) => node.type === "answer")) {
    errors.push("Advanced-chat mode needs an answer node.");
  }
  return { ok: errors.length === 0, errors, ir };
}

export function renderDifyDslFromIr(input) {
  const validation = validateWorkflowIr(input);
  if (!validation.ok) {
    throw new Error(`Invalid workflow IR:\n${validation.errors.join("\n")}`);
  }
  const ir = validation.ir;
  const idMap = new Map([["start", numericId(0)]]);
  ir.nodes.forEach((node, index) => idMap.set(node.id, /^[0-9]{13}$/.test(node.id) ? node.id : numericId(index + 1)));

  const renderedNodes = [renderStartNode(ir, idMap.get("start"))];
  ir.nodes.forEach((node, index) => renderedNodes.push(renderNode(node, idMap.get(node.id), index, ir, idMap)));

  if (ir.app.mode === "workflow" && ir.outputs.length && !ir.nodes.some((node) => node.type === "end")) {
    const endId = numericId(ir.nodes.length + 1);
    idMap.set("end", endId);
    renderedNodes.push(
      renderNode({ id: "end", type: "end", outputs: ir.outputs, title: "End", desc: "" }, endId, ir.nodes.length, ir, idMap),
    );
  }

  const edges = ir.edges.map((edge) => ({
    id: `${idMap.get(edge.source) || edge.source}-${edge.sourceHandle}-${idMap.get(edge.target) || edge.target}-${edge.targetHandle}`,
    source: idMap.get(edge.source) || edge.source,
    sourceHandle: edge.sourceHandle,
    target: idMap.get(edge.target) || edge.target,
    targetHandle: edge.targetHandle,
    type: "custom",
    data: {
      sourceType: inferNodeType(edge.source, ir.nodes),
      targetType: inferNodeType(edge.target, ir.nodes),
      isInIteration: false,
      isInLoop: false,
    },
    zIndex: 0,
  }));

  if (ir.app.mode === "workflow" && ir.outputs.length && !ir.nodes.some((node) => node.type === "end")) {
    const lastSource = ir.edges.at(-1)?.target || ir.nodes.at(-1)?.id;
    if (lastSource) {
      edges.push({
        id: `${idMap.get(lastSource)}-source-${idMap.get("end")}-target`,
        source: idMap.get(lastSource),
        sourceHandle: "source",
        target: idMap.get("end"),
        targetHandle: "target",
        type: "custom",
        data: { sourceType: inferNodeType(lastSource, ir.nodes), targetType: "end", isInIteration: false, isInLoop: false },
        zIndex: 0,
      });
    }
  }

  const dsl = {
    app: {
      description: ir.app.description,
      icon: ir.app.icon,
      icon_background: ir.app.icon_background,
      mode: ir.app.mode,
      name: ir.app.name,
      use_icon_as_answer_icon: false,
    },
    dependencies: [],
    kind: "app",
    version: "0.3.1",
    workflow: {
      conversation_variables: [],
      environment_variables: [],
      features: {
        file_upload: { enabled: false },
        opening_statement: "",
        retriever_resource: { enabled: true },
        sensitive_word_avoidance: { enabled: false },
        speech_to_text: { enabled: false },
        suggested_questions: [],
        suggested_questions_after_answer: { enabled: false },
        text_to_speech: { enabled: false, language: "", voice: "" },
      },
      graph: {
        edges,
        nodes: renderedNodes,
        viewport: { x: 0, y: 0, zoom: 0.7 },
      },
    },
  };

  const staticValidation = validateDslObject(dsl);
  return { dsl, yaml: YAML.stringify(dsl), id_map: Object.fromEntries(idMap), static_validation: staticValidation };
}

export async function renderIrToFile({ ir, filePath }) {
  const rendered = renderDifyDslFromIr(ir);
  const absolutePath = path.resolve(filePath);
  await writeFile(absolutePath, rendered.yaml, "utf8");
  return { filePath: absolutePath, ...rendered };
}
