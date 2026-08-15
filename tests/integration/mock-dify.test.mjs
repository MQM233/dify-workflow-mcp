import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("connects to a mock Dify console through the shared browser", async (t) => {
  const server = http.createServer((request, response) => {
    if (request.url?.startsWith("/console/api/apps")) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ total: 1, data: [{ id: "app-1", name: "Mock workflow", mode: "workflow" }] }));
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><title>Mock Dify</title><main>apps</main>");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const profileDir = await mkdtemp(path.join(os.tmpdir(), "dify-workflow-mcp-"));
  const address = server.address();
  process.env.DIFY_BASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.DIFY_PROFILE_DIR = profileDir;
  process.env.DIFY_HEADLESS = "true";

  const core = await import(`../../src/dify-core.mjs?integration=${Date.now()}`);
  t.after(async () => {
    await core.closeSharedContext().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
    await rm(profileDir, { recursive: true, force: true });
  });

  const status = await core.getConnectionStatus();
  assert.equal(status.ok, true);
  assert.equal(status.authenticated, true);

  const apps = await core.listApps();
  assert.equal(apps.ok, true);
  assert.equal(apps.apps[0].name, "Mock workflow");
});
