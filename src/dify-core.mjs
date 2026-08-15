import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

function normalizeBaseUrl(value) {
  return (value || "https://cloud.dify.ai").replace(/\/+$/, "").replace(/\/apps$/, "");
}

export const defaults = {
  baseUrl: normalizeBaseUrl(process.env.DIFY_BASE_URL),
  profileDir:
    process.env.DIFY_PROFILE_DIR ||
    path.join(os.homedir(), ".dify-workflow-mcp", "browser-profile"),
};

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

let sharedContext;
let sharedPage;
let operationQueue = Promise.resolve();

function findExecutablePath() {
  return chromeCandidates.find((candidate) => existsSync(candidate));
}

export function enqueueDifyOperation(fn) {
  const run = operationQueue.then(fn, fn);
  operationQueue = run.catch(() => {});
  return run;
}

export async function launchContext({ headless = process.env.DIFY_HEADLESS === "true" } = {}) {
  const executablePath = findExecutablePath();
  const launchOptions = {
    headless,
    viewport: { width: 1280, height: 800 },
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  return chromium.launchPersistentContext(defaults.profileDir, launchOptions);
}

async function getSharedContext({ headless = process.env.DIFY_HEADLESS === "true" } = {}) {
  if (!sharedContext) {
    sharedContext = await launchContext({ headless });
    sharedContext.on("close", () => {
      sharedContext = undefined;
      sharedPage = undefined;
    });
  }
  return sharedContext;
}

async function selectSharedPage(context) {
  const pages = context.pages().filter((page) => !page.isClosed());
  const difyPage = pages.find((page) => page.url().startsWith(defaults.baseUrl));
  const nonBlankPage = pages.find((page) => {
    const url = page.url();
    return url && url !== "about:blank" && url !== "chrome://new-tab-page/";
  });
  const sharedPageUrl = sharedPage && !sharedPage.isClosed() ? sharedPage.url() : "";
  const reusableSharedPage =
    sharedPage && !sharedPage.isClosed() && sharedPageUrl !== "about:blank" && sharedPageUrl !== "chrome://new-tab-page/"
      ? sharedPage
      : undefined;
  const selected = difyPage || reusableSharedPage || nonBlankPage || pages[0] || (await context.newPage());

  await Promise.all(
    pages
      .filter((page) => page !== selected)
      .filter((page) => page.url() === "about:blank" || page.url() === "chrome://new-tab-page/")
      .map((page) => page.close().catch(() => {})),
  );

  return selected;
}

async function getSharedPageWithoutLoginCheck({ headless = process.env.DIFY_HEADLESS === "true" } = {}) {
  const context = await getSharedContext({ headless });
  sharedPage = await selectSharedPage(context);

  if (!sharedPage.url().startsWith(defaults.baseUrl)) {
    await gotoWithRetry(sharedPage, `${defaults.baseUrl}/apps`);
  }
  await sharedPage.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  return sharedPage;
}

export async function getSharedPage() {
  const sharedPage = await getSharedPageWithoutLoginCheck();
  await assertLoggedIn(sharedPage);
  return sharedPage;
}

export async function getSharedPageDiagnostics() {
  const context = await getSharedContext();
  sharedPage = await selectSharedPage(context);
  return {
    page_count: context.pages().filter((page) => !page.isClosed()).length,
    pages: context
      .pages()
      .filter((page) => !page.isClosed())
      .map((page) => ({
        url: page.url(),
        is_shared: page === sharedPage,
      })),
  };
}

async function gotoWithRetry(page, url, attempts = 3) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1000 * (index + 1)).catch(() => {});
    }
  }
  throw lastError;
}

export async function closeSharedContext() {
  if (sharedContext) {
    await sharedContext.close();
  }
  sharedContext = undefined;
  sharedPage = undefined;
}

export async function openLoginPage() {
  return enqueueDifyOperation(async () => {
    const page = await getSharedPageWithoutLoginCheck({ headless: false });
    return {
      url: page.url(),
      profileDir: defaults.profileDir,
      reusedSharedContext: true,
      message:
        "Sign in if needed. This browser is the shared MCP session; later Dify tools will reuse it instead of opening another profile.",
    };
  });
}

export async function openAppPage({ id, name, view = "workflow", refresh = true } = {}) {
  return enqueueDifyOperation(async () => {
    const page = await getSharedPage();
    const appId = await resolveAppId(page, { id, name });
    if (!appId) throw new Error("Missing app id or name.");

    const targetUrl = `${defaults.baseUrl}/app/${appId}/${view}`;
    const currentUrl = page.url().split("?")[0];
    if (currentUrl === targetUrl && refresh) {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    } else if (currentUrl !== targetUrl) {
      await gotoWithRetry(page, targetUrl);
    }
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    return {
      ok: true,
      app_id: appId,
      url: page.url(),
      action: currentUrl === targetUrl && refresh ? "refreshed" : "opened",
    };
  });
}

export async function assertLoggedIn(page) {
  if (page.url().includes("/signin")) {
    throw new Error(`Not logged in. Run login and sign in to ${defaults.baseUrl}.`);
  }
}

export async function api(page, method, pathname, data) {
  return page.evaluate(
    async ({ method, pathname, data }) => {
      const cookieMap = Object.fromEntries(
        document.cookie
          .split(";")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => {
            const index = item.indexOf("=");
            return index === -1 ? [item, ""] : [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
          }),
      );
      const csrfToken = cookieMap["__Host-csrf_token"] || cookieMap.csrf_token;
      const headers = {};
      if (csrfToken) {
        headers["x-csrf-token"] = csrfToken;
      }
      const options = { method, credentials: "include", headers };
      if (data !== undefined) {
        headers["content-type"] = "application/json";
        options.body = JSON.stringify(data);
      }

      const response = await fetch(pathname, options);
      const text = await response.text();
      let body = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        // Keep raw text.
      }
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        contentType: response.headers.get("content-type"),
        body,
      };
    },
    { method, pathname, data },
  );
}

export function normalizeApps(body) {
  const data = body?.data || body?.items || [];
  return data.map((app) => ({
    id: app.id,
    name: app.name,
    mode: app.mode,
    updated_at: app.updated_at,
    created_at: app.created_at,
  }));
}

export function normalizeDatasets(body) {
  const data = body?.data || body?.items || [];
  return data.map((dataset) => ({
    id: dataset.id,
    name: dataset.name,
    description: dataset.description,
    provider: dataset.provider,
    permission: dataset.permission,
    data_source_type: dataset.data_source_type,
    indexing_technique: dataset.indexing_technique,
    document_count: dataset.document_count,
    word_count: dataset.word_count,
    app_count: dataset.app_count,
    created_at: dataset.created_at,
    updated_at: dataset.updated_at,
  }));
}

function summarizeDataset(dataset) {
  if (!dataset) return null;
  return {
    id: dataset.id,
    name: dataset.name,
    description: dataset.description,
    indexing_technique: dataset.indexing_technique,
    embedding_model: dataset.embedding_model,
    embedding_model_provider: dataset.embedding_model_provider,
    doc_form: dataset.doc_form,
    doc_language: dataset.doc_language,
    document_count: dataset.document_count,
  };
}

async function resolveDataset(page, { dataset_id, dataset_name }) {
  if (dataset_id) {
    const detail = await api(page, "GET", `/console/api/datasets/${encodeURIComponent(dataset_id)}`);
    if (!detail.ok) {
      throw new Error(`Failed to resolve dataset id ${JSON.stringify(dataset_id)}: ${JSON.stringify(detail, null, 2)}`);
    }
    return detail.body;
  }
  if (!dataset_name) throw new Error("Provide dataset_id or dataset_name.");

  const params = new URLSearchParams({ page: "1", limit: "100", keyword: dataset_name });
  const result = await api(page, "GET", `/console/api/datasets?${params.toString()}`);
  if (!result.ok) {
    throw new Error(`Failed to resolve dataset name: ${JSON.stringify(result, null, 2)}`);
  }
  const matches = (result.body?.data || result.body?.items || []).filter((dataset) => dataset.name === dataset_name);
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one dataset named ${JSON.stringify(dataset_name)}, found ${matches.length}: ${JSON.stringify(
        matches.map(summarizeDataset),
        null,
        2,
      )}`,
    );
  }
  return matches[0];
}

function mimeTypeForFile(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  const types = {
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".csv": "text/csv",
    ".json": "application/json",
    ".html": "text/html",
    ".htm": "text/html",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return types[extension] || "application/octet-stream";
}

function normalizeTextFileName(name) {
  const candidate = (name || `text-${new Date().toISOString().replace(/[:.]/g, "-")}`).trim();
  if (!candidate) throw new Error("Document name cannot be empty.");
  return path.extname(candidate) ? candidate : `${candidate}.txt`;
}

async function uploadDatasetFile(page, { fileName, bytes, mimeType }) {
  const base64 = Buffer.from(bytes).toString("base64");
  return page.evaluate(
    async ({ base64, fileName, mimeType }) => {
      const cookieMap = Object.fromEntries(
        document.cookie
          .split(";")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => {
            const index = item.indexOf("=");
            return index === -1 ? [item, ""] : [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
          }),
      );
      const csrfToken = cookieMap["__Host-csrf_token"] || cookieMap.csrf_token;
      const headers = {};
      if (csrfToken) headers["x-csrf-token"] = csrfToken;

      const binary = atob(base64);
      const content = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) content[index] = binary.charCodeAt(index);
      const formData = new FormData();
      formData.append("file", new File([content], fileName, { type: mimeType }));

      const response = await fetch("/console/api/files/upload?source=datasets", {
        method: "POST",
        credentials: "include",
        headers,
        body: formData,
      });
      const text = await response.text();
      let body = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        // Keep raw text.
      }
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        contentType: response.headers.get("content-type"),
        body,
      };
    },
    { base64, fileName, mimeType },
  );
}

function buildDocumentPayload(dataset, fileId, options = {}) {
  const indexingTechnique = options.indexing_technique || dataset?.indexing_technique || "economy";
  const payload = {
    duplicate: options.duplicate !== false,
    indexing_technique: indexingTechnique,
    doc_form: options.doc_form || dataset?.doc_form || "text_model",
    doc_language: options.doc_language || dataset?.doc_language || "Chinese",
    process_rule: options.process_rule || { mode: "automatic", rules: null },
    data_source: {
      type: "upload_file",
      info_list: {
        data_source_type: "upload_file",
        file_info_list: { file_ids: [fileId] },
      },
    },
  };

  const embeddingModel = options.embedding_model || dataset?.embedding_model;
  const embeddingProvider = options.embedding_model_provider || dataset?.embedding_model_provider;
  if (embeddingModel) payload.embedding_model = embeddingModel;
  if (embeddingProvider) payload.embedding_model_provider = embeddingProvider;
  if (options.retrieval_model) payload.retrieval_model = options.retrieval_model;
  return payload;
}

async function createDocumentFromBytes(page, options, file) {
  const dataset = await resolveDataset(page, options);
  const upload = await uploadDatasetFile(page, file);
  if (!upload.ok || !upload.body?.id) {
    return {
      ok: false,
      stage: "file_upload",
      dataset: summarizeDataset(dataset),
      upload,
    };
  }

  const payload = buildDocumentPayload(dataset, upload.body.id, options);
  const result = await api(
    page,
    "POST",
    `/console/api/datasets/${encodeURIComponent(dataset.id)}/documents`,
    payload,
  );
  return {
    ok: result.ok,
    stage: result.ok ? "document_created" : "document_create",
    status: result.status,
    dataset: summarizeDataset(result.body?.dataset || dataset),
    uploaded_file: {
      id: upload.body.id,
      name: upload.body.name,
      size: upload.body.size,
      extension: upload.body.extension,
      mime_type: upload.body.mime_type,
    },
    batch: result.body?.batch,
    documents: result.body?.documents,
    error: result.ok ? null : result.body,
  };
}

function providerId(provider) {
  return provider?.provider || provider?.provider_name || provider?.id || provider?.name || provider?.value;
}

function providerLabel(provider) {
  if (typeof provider?.label === "string") return provider.label;
  return provider?.label?.en_US || provider?.label?.zh_Hans || provider?.provider_name || providerId(provider);
}

function normalizeProviderModels(provider, modelType) {
  const models = [];
  const provider_id = providerId(provider);
  const provider_label = providerLabel(provider);

  const modelSources = [
    provider?.models,
    provider?.model_list,
    provider?.available_models,
    provider?.custom_configuration?.models,
    provider?.system_configuration?.models,
  ].filter(Array.isArray);

  for (const source of modelSources) {
    for (const model of source) {
      const type = model?.model_type || model?.type || modelType;
      if (modelType && type && type !== modelType) continue;
      models.push({
        provider: provider_id,
        provider_label,
        model: model?.model || model?.name || model?.model_name,
        label:
          typeof model?.label === "string"
            ? model.label
            : model?.label?.en_US || model?.label?.zh_Hans || model?.model || model?.name || model?.model_name,
        model_type: type,
        status: model?.status,
        features: model?.features || model?.model_properties?.features,
        fetch_source: "provider_payload",
      });
    }
  }

  return models.filter((model) => model.model);
}

function normalizeModelsFromEndpoint(body, provider, modelType, fetchSource) {
  const list = Array.isArray(body) ? body : body?.data || body?.models || body?.model_list || [];
  if (!Array.isArray(list)) return [];
  return list
    .map((model) => ({
      provider,
      provider_label: provider,
      model: model?.model || model?.name || model?.model_name,
      label:
        typeof model?.label === "string"
          ? model.label
          : model?.label?.en_US || model?.label?.zh_Hans || model?.model || model?.name || model?.model_name,
      model_type: model?.model_type || model?.type || modelType,
      status: model?.status,
      features: model?.features || model?.model_properties?.features,
      fetch_source: fetchSource,
    }))
    .filter((model) => model.model);
}

function dedupeModels(models) {
  const seen = new Set();
  const unique = [];
  for (const model of models) {
    const key = `${model.provider}::${model.model_type || ""}::${model.model}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(model);
  }
  return unique;
}

export function summarizeDraft(body) {
  const nodes = body?.graph?.nodes || [];
  const edges = body?.graph?.edges || [];
  return {
    id: body?.id,
    hash: body?.hash,
    version: body?.version,
    nodes: nodes.map((node) => ({
      id: node.id,
      title: node.data?.title,
      type: node.data?.type,
      variables: node.data?.variables,
      outputs: node.data?.outputs,
    })),
    edge_count: edges.length,
  };
}

export function parseSse(text) {
  if (typeof text !== "string") return null;
  const events = [];
  for (const block of text.split(/\n\n+/)) {
    const dataLine = block.split(/\n/).find((line) => line.startsWith("data: "));
    if (!dataLine) continue;
    try {
      events.push(JSON.parse(dataLine.slice("data: ".length)));
    } catch {
      // Ignore non-JSON keepalive frames.
    }
  }

  const workflowFinished = [...events].reverse().find((event) => event.event === "workflow_finished");
  const failedNode = [...events].reverse().find(
    (event) => event.event === "node_finished" && event.data?.status && event.data.status !== "succeeded",
  );

  return {
    event_count: events.length,
    workflow_run_id: workflowFinished?.workflow_run_id || events.find((event) => event.workflow_run_id)?.workflow_run_id,
    status: workflowFinished?.data?.status,
    outputs: workflowFinished?.data?.outputs,
    error: workflowFinished?.data?.error || failedNode?.data?.error || null,
    total_steps: workflowFinished?.data?.total_steps,
    elapsed_time: workflowFinished?.data?.elapsed_time,
    events: events.map((event) => ({
      event: event.event,
      node_type: event.data?.node_type,
      title: event.data?.title,
      status: event.data?.status,
      outputs: event.data?.outputs,
      error: event.data?.error,
    })),
  };
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function evaluateExpectation(parsed, expect = {}) {
  const failures = [];
  if (expect.status !== undefined && parsed?.status !== expect.status) {
    failures.push(`status expected ${JSON.stringify(expect.status)}, got ${JSON.stringify(parsed?.status)}`);
  }
  if (expect.outputs !== undefined && !deepEqual(parsed?.outputs, expect.outputs)) {
    failures.push(`outputs expected ${JSON.stringify(expect.outputs)}, got ${JSON.stringify(parsed?.outputs)}`);
  }
  if (expect.error !== undefined && parsed?.error !== expect.error) {
    failures.push(`error expected ${JSON.stringify(expect.error)}, got ${JSON.stringify(parsed?.error)}`);
  }
  return failures;
}

export async function resolveAppId(page, { id, name }) {
  if (id) return id;
  if (!name) return null;

  const result = await api(page, "GET", `/console/api/apps?page=1&limit=100&mode=all&name=${encodeURIComponent(name)}`);
  if (!result.ok) {
    throw new Error(`Failed to resolve app name: ${JSON.stringify(result, null, 2)}`);
  }
  const matches = normalizeApps(result.body).filter((app) => app.name === name);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one app named "${name}", found ${matches.length}: ${JSON.stringify(matches, null, 2)}`);
  }
  return matches[0].id;
}

export async function listApps({ name, mode = "all", limit = 20 } = {}) {
  return enqueueDifyOperation(async () => {
    const page = await getSharedPage();
    const params = new URLSearchParams({ page: "1", limit: String(limit), mode });
    if (name) params.set("name", name);
    const result = await api(page, "GET", `/console/api/apps?${params.toString()}`);
    if (!result.ok) return result;
    return {
      ok: true,
      status: result.status,
      total: result.body?.total,
      apps: normalizeApps(result.body),
    };
  });
}

export async function listDatasets({ keyword, page = 1, limit = 20 } = {}) {
  return enqueueDifyOperation(async () => {
    const pageRef = await getSharedPage();
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (keyword) params.set("keyword", keyword);
    const result = await api(pageRef, "GET", `/console/api/datasets?${params.toString()}`);
    if (!result.ok) return result;
    return {
      ok: true,
      status: result.status,
      total: result.body?.total,
      has_more: result.body?.has_more,
      page: result.body?.page,
      limit: result.body?.limit,
      datasets: normalizeDatasets(result.body),
    };
  });
}

export async function getConnectionStatus() {
  return enqueueDifyOperation(async () => {
    let context;
    try {
      context = await getSharedContext();
    } catch (error) {
      return {
        ok: false,
        reachable: false,
        authenticated: false,
        baseUrl: defaults.baseUrl,
        profileDir: defaults.profileDir,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      const response = await context.request.get(`${defaults.baseUrl}/console/api/apps?page=1&limit=1&mode=all`, {
        timeout: 15000,
      });
      const text = await response.text();
      let body = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        // Keep raw text.
      }
      const bodyIsJsonObject = body && typeof body === "object" && !Array.isArray(body);
      const authenticated = response.ok() && bodyIsJsonObject;
      return {
        ok: authenticated,
        reachable: true,
        authenticated,
        status: response.status(),
        statusText: response.statusText(),
        baseUrl: defaults.baseUrl,
        profileDir: defaults.profileDir,
        headless: process.env.DIFY_HEADLESS === "true",
        message: authenticated
          ? "Dify is reachable and the persistent browser session is authenticated."
          : "Dify is reachable, but the persistent browser session is not authenticated or the console API response is invalid.",
        response: authenticated ? undefined : body,
      };
    } catch (error) {
      return {
        ok: false,
        reachable: false,
        authenticated: false,
        baseUrl: defaults.baseUrl,
        profileDir: defaults.profileDir,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

export async function createDataset({
  name,
  description = "",
  indexing_technique,
  permission = "only_me",
} = {}) {
  return enqueueDifyOperation(async () => {
    const page = await getSharedPage();
    const payload = { name, description, permission, provider: "vendor" };
    if (indexing_technique) payload.indexing_technique = indexing_technique;
    const result = await api(page, "POST", "/console/api/datasets", payload);
    return {
      ok: result.ok,
      status: result.status,
      dataset_id: result.body?.id,
      dataset: result.ok ? summarizeDataset(result.body) : null,
      error: result.ok ? null : result.body,
    };
  });
}

export async function createDocumentByText(options = {}) {
  return enqueueDifyOperation(async () => {
    const page = await getSharedPage();
    const text = options.text;
    if (typeof text !== "string" || !text.trim()) throw new Error("Text content cannot be empty.");
    const fileName = normalizeTextFileName(options.document_name);
    return createDocumentFromBytes(page, options, {
      fileName,
      bytes: Buffer.from(text, "utf8"),
      mimeType: "text/plain;charset=utf-8",
    });
  });
}

export async function createDocumentByFile(options = {}) {
  return enqueueDifyOperation(async () => {
    const page = await getSharedPage();
    if (!options.filePath) throw new Error("filePath is required.");
    const absolutePath = path.resolve(options.filePath);
    const bytes = await readFile(absolutePath);
    const fileName = options.document_name || path.basename(absolutePath);
    return createDocumentFromBytes(page, options, {
      fileName,
      bytes,
      mimeType: mimeTypeForFile(fileName),
    });
  });
}

export async function listModels({ model_type = "llm", raw = false } = {}) {
  return enqueueDifyOperation(async () => {
    const page = await getSharedPage();
    const diagnostics = [];
    const models = [];
    const providerResult = await api(page, "GET", "/console/api/workspaces/current/model-providers");
    diagnostics.push({
      path: "/console/api/workspaces/current/model-providers",
      ok: providerResult.ok,
      status: providerResult.status,
    });
    if (!providerResult.ok) return raw ? providerResult : { ...providerResult, diagnostics };

    const providers = providerResult.body?.data || providerResult.body?.providers || providerResult.body || [];
    const providerList = Array.isArray(providers) ? providers : [];
    for (const provider of providerList) {
      const id = providerId(provider);
      if (!id) continue;
      models.push(...normalizeProviderModels(provider, model_type));

      const encoded = encodeURIComponent(id);
      const paths = [
        `/console/api/workspaces/current/model-providers/${encoded}/models?model_type=${encodeURIComponent(model_type)}`,
        `/console/api/workspaces/current/model-providers/${encoded}/models?model-type=${encodeURIComponent(model_type)}`,
      ];
      for (const pathname of paths) {
        const result = await api(page, "GET", pathname);
        diagnostics.push({ path: pathname, ok: result.ok, status: result.status, provider: id });
        if (result.ok) {
          models.push(...normalizeModelsFromEndpoint(result.body, id, model_type, pathname));
          break;
        }
      }
    }

    const typePath = `/console/api/workspaces/current/models/model-types/${encodeURIComponent(model_type)}`;
    const typeResult = await api(page, "GET", typePath);
    diagnostics.push({ path: typePath, ok: typeResult.ok, status: typeResult.status });
    if (typeResult.ok) {
      models.push(...normalizeModelsFromEndpoint(typeResult.body, undefined, model_type, typePath));
    }

    const output = {
      ok: true,
      status: providerResult.status,
      model_type,
      providers: providerList.map((provider) => ({
        provider: providerId(provider),
        label: providerLabel(provider),
        supported_model_types: provider.supported_model_types || provider.model_types || provider.model_type,
        status: provider.status,
      })),
      models: dedupeModels(models),
      diagnostics,
    };
    return raw ? { ...output, raw_providers: providerResult.body } : output;
  });
}

export async function importDsl({ filePath, yamlContent, name, id }) {
  return enqueueDifyOperation(async () => {
    const page = await getSharedPage();
    const content = yamlContent ?? (await readFile(path.resolve(filePath), "utf8"));
    let result = await api(page, "POST", "/console/api/apps/imports", {
      mode: "yaml-content",
      yaml_content: content,
      name,
      app_id: id || undefined,
    });

    if (result.status === 202 && result.body?.id) {
      const confirm = await api(page, "POST", `/console/api/apps/imports/${result.body.id}/confirm`);
      result = { ...confirm, confirmed_from: result.body };
    }

    if (result.ok && result.body?.app_id) {
      const detail = await api(page, "GET", `/console/api/apps/${result.body.app_id}`);
      return { ...result, imported_app: detail.body };
    }
    return result;
  });
}

export async function getDraft({ id, name, raw = false }) {
  return enqueueDifyOperation(async () => {
    const page = await getSharedPage();
    const appId = await resolveAppId(page, { id, name });
    if (!appId) throw new Error("Missing app id or name.");
    const result = await api(page, "GET", `/console/api/apps/${appId}/workflows/draft`);
    if (!result.ok) return result;
    return raw ? result.body : summarizeDraft(result.body);
  });
}

export async function runDraft({ id, name, inputs = {}, raw = false }) {
  return enqueueDifyOperation(async () => {
    const page = await getSharedPage();
    const appId = await resolveAppId(page, { id, name });
    if (!appId) throw new Error("Missing app id or name.");
    const result = await api(page, "POST", `/console/api/apps/${appId}/workflows/draft/run`, { inputs });
    const parsed = parseSse(result.body);
    return raw ? { ...result, parsed } : { ok: result.ok, status: result.status, statusText: result.statusText, parsed };
  });
}

export async function testDraft({ id, name, cases }) {
  return enqueueDifyOperation(async () => {
    const page = await getSharedPage();
    const appId = await resolveAppId(page, { id, name });
    if (!appId) throw new Error("Missing app id or name.");

    const results = [];
    for (const testCase of cases) {
      const result = await api(page, "POST", `/console/api/apps/${appId}/workflows/draft/run`, {
        inputs: testCase.inputs || {},
      });
      const parsed = parseSse(result.body);
      const failures = evaluateExpectation(parsed, testCase.expect || {});
      results.push({
        name: testCase.name || "(unnamed)",
        pass: result.ok && failures.length === 0,
        failures,
        status: result.status,
        parsed,
      });
    }

    const passed = results.filter((result) => result.pass).length;
    return { passed, failed: results.length - passed, total: results.length, results };
  });
}

export async function deleteApp({ id, name }) {
  return enqueueDifyOperation(async () => {
    const page = await getSharedPage();
    const appId = await resolveAppId(page, { id, name });
    if (!appId) throw new Error("Missing app id or name.");
    return api(page, "DELETE", `/console/api/apps/${appId}`);
  });
}
