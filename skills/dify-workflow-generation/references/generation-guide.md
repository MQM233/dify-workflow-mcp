# Dify DSL Generation Guide

## Stable Structure

Use `kind: app`. For normal one-shot business automation, prefer `app.mode: workflow` with `start -> ... -> end`. For conversational apps, use `advanced-chat` with `start -> ... -> answer`.

Recommended top-level skeleton:

```yaml
version: 0.3.1
kind: app
app:
  name: App Name
  mode: workflow
  icon: 🤖
  icon_background: "#FFEAD5"
  use_icon_as_answer_icon: false
dependencies: []
workflow:
  conversation_variables: []
  environment_variables: []
  features:
    file_upload:
      enabled: false
    opening_statement: ""
    retriever_resource:
      enabled: true
    sensitive_word_avoidance:
      enabled: false
    speech_to_text:
      enabled: false
    suggested_questions: []
    suggested_questions_after_answer:
      enabled: false
    text_to_speech:
      enabled: false
  graph:
    nodes: []
    edges: []
    viewport:
      x: 0
      y: 0
      zoom: 0.7
```

The Dify Cloud test accepted `0.3.1` with warnings and converted internally. Use exported local DSL as the truth when company Dify differs.

## IDs And References

- Use quoted 13-digit string node IDs: `'1756000000001'`.
- Avoid custom IDs like `smart-start`; they can break prompt interpolation in some imports.
- Use Dify variable references exactly: `{{#1756000000001.input_name#}}`.
- In prompt code fences, triple braces are acceptable when you want raw content: `{{{#1756000000001.resume_text#}}}`.
- Every selector must reference an existing node and output/input variable.

## Node Shapes

Common nodes:

- `start`: defines input variables.
- `llm`: model call with `model`, `prompt_template`, `context`, `vision`, `variables`.
- `end`: workflow outputs. Shape is a list of `{variable, value_selector, value_type}`.
- `answer`: chatflow response.
- `document-extractor`: uses singular `variable_selector`.
- `code`: outputs are a map keyed by variable name.
- `template-transform`: good for final report assembly.
- `if-else` / `question-classifier`: route branches; branch handles must match generated case IDs.
- `parameter-extractor`: structured extraction before API/tool calls.
- `http-request` / `tool`: external action nodes; document credentials and plugin dependencies.
- `iteration`: batch processing; inner nodes need iteration metadata.

## Canvas Render Safety

Dify may accept an imported DSL but still show "an unexpected error occurred while rendering this component" when opening the workflow canvas. Avoid simplified node/edge shapes that differ from exported Dify DSL.

Every graph node should include:

- Top-level `type: custom`.
- `data.type` with the real Dify node type, such as `start`, `code`, `llm`, or `end`.
- `width`, `height`, `sourcePosition: right`, and `targetPosition: left`.
- `position` and `positionAbsolute` with matching `x` and `y`.

Code node bindings must use Dify's exported shape:

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

Do not use this simplified shape for code nodes:

```yaml
data:
  inputs:
    input_text:
      type: variable
      value:
        - '1756000000001'
        - input_text
```

Start variables should omit `max_length` or use a positive number. Avoid `max_length: 0`.

Every graph edge should include:

- `type: custom`
- `zIndex: 0`
- `data.sourceType`
- `data.targetType`
- `data.isInIteration: false`
- `data.isInLoop: false`

Put `isInIteration` and `isInLoop` under `edge.data`, not at the edge top level.

Read exact node docs from:

- Bundled templates under `../templates/`
- Bundled examples under `../../../examples/`

## Edges And Layout

- Edge id: `<source>-<sourceHandle>-<target>-<targetHandle>`.
- Common source handle: `source`.
- Common target handle: `target`.
- Include `data.sourceType`, `data.targetType`, `isInIteration: false`, `isInLoop: false`.
- Left-to-right layout: start around `x: 80, y: 260`; add about `340` x per column.
- Keep `positionAbsolute` consistent with `position` when present.

## Prompt Quality

Business workflows should produce structured, auditable output:

- State role and task.
- Tell the model what evidence is allowed.
- Define scoring/routing/extraction criteria.
- Define exact output sections.
- Include JSON summary when downstream automation may consume the result.
- Add missing-information and human-review sections for high-risk domains.
- Avoid unsupported claims and sensitive-attribute inference.

## Artifact Contract

Each generated workflow should have:

- YAML DSL.
- Test cases JSON.
- Named output variables.
- Assumption/dependency notes for model providers, tools, knowledge bases, and credentials.
