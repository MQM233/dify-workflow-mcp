#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { validateDslFile } from "./dsl-validator.mjs";
import { renderIrToFile } from "./workflow-ir.mjs";
import {
  closeSharedContext,
  defaults,
  deleteApp,
  getDraft,
  importDsl,
  listApps,
  openLoginPage,
  runDraft,
  testDraft,
} from "./dify-core.mjs";

function usage() {
  console.log(`Usage:
  npm run dify -- login
  npm run dify -- list [--name <text>] [--mode workflow|all]
  npm run dify -- validate <file.yml>
  npm run dify -- render-ir <ir.json> <out.yml>
  npm run dify -- import <file.yml> [--name <app-name>] [--id <app-id>]
  npm run dify -- draft --id <app-id>
  npm run dify -- draft --name <exact-app-name>
  npm run dify -- run-draft --id <app-id> --inputs '{"query":"hello"}'
  npm run dify -- run-draft --name <exact-app-name> --input.query "hello"
  npm run dify -- test --name <exact-app-name> --cases cases.json
  npm run dify -- delete --id <app-id>
  npm run dify -- delete --name <exact-app-name>

Environment:
  DIFY_BASE_URL      Default: ${defaults.baseUrl}
  DIFY_PROFILE_DIR   Default: ${defaults.profileDir}
  DIFY_HEADLESS      true/false
  CHROME_PATH        Optional explicit Chrome/Edge executable
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item.startsWith("--")) {
      const key = item.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(item);
    }
  }
  return args;
}

function parseInputs(args) {
  if (args.inputs) return JSON.parse(args.inputs);
  const inputs = {};
  for (const [key, value] of Object.entries(args)) {
    if (key.startsWith("input.")) inputs[key.slice("input.".length)] = value;
  }
  return inputs;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  if (command === "login") {
    console.log(JSON.stringify(await openLoginPage(), null, 2));
    await new Promise(() => {});
  } else if (command === "list") {
    console.log(JSON.stringify(await listApps(args), null, 2));
  } else if (command === "validate") {
    const filePath = args._[1];
    if (!filePath) return usage();
    const result = await validateDslFile(filePath);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } else if (command === "render-ir") {
    const irPath = args._[1];
    const outPath = args._[2];
    if (!irPath || !outPath) return usage();
    const ir = JSON.parse(await readFile(irPath, "utf8"));
    const result = await renderIrToFile({ ir, filePath: outPath });
    console.log(
      JSON.stringify(
        {
          filePath: result.filePath,
          id_map: result.id_map,
          static_validation: result.static_validation,
        },
        null,
        2,
      ),
    );
    if (!result.static_validation.ok) process.exitCode = 1;
  } else if (command === "import") {
    const filePath = args._[1];
    if (!filePath) return usage();
    console.log(JSON.stringify(await importDsl({ filePath, name: args.name, id: args.id }), null, 2));
  } else if (command === "draft") {
    console.log(JSON.stringify(await getDraft({ id: args.id, name: args.name, raw: Boolean(args.raw) }), null, 2));
  } else if (command === "run-draft") {
    console.log(
      JSON.stringify(
        await runDraft({ id: args.id, name: args.name, inputs: parseInputs(args), raw: Boolean(args.raw) }),
        null,
        2,
      ),
    );
  } else if (command === "test") {
    if (!args.cases) return usage();
    const cases = JSON.parse(await readFile(args.cases, "utf8"));
    console.log(JSON.stringify(await testDraft({ id: args.id, name: args.name, cases }), null, 2));
  } else if (command === "delete") {
    console.log(JSON.stringify(await deleteApp({ id: args.id, name: args.name }), null, 2));
  } else {
    usage();
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(/cookie: .*/gi, "cookie: [redacted]"));
  process.exitCode = 1;
} finally {
  if (process.argv[2] !== "login") {
    await closeSharedContext();
  }
}
