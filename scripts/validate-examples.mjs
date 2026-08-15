import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDslFile } from "../src/dsl-validator.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const examplesDir = path.join(projectRoot, "examples");
const files = (await readdir(examplesDir)).filter((name) => /\.ya?ml$/i.test(name)).sort();

let failed = false;
for (const name of files) {
  try {
    const result = await validateDslFile(path.join(examplesDir, name));
    const label = result.ok ? "PASS" : "FAIL";
    console.log(`${label} ${name}: ${result.errors} error(s), ${result.warnings} warning(s)`);
    if (!result.ok) {
      failed = true;
      for (const issue of result.issues.filter((item) => item.level === "error")) {
        console.error(`  ${issue.path}: ${issue.message}`);
      }
    }
  } catch (error) {
    failed = true;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

if (!files.length) throw new Error("No YAML examples found.");
if (failed) process.exitCode = 1;
