import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "harness-package-")));
const artifacts = path.join(temporary, "artifacts"), install = path.join(temporary, "install");
const run = (command, args, cwd) => execFileSync(command, args, { cwd, encoding: "utf8", timeout: 60000,
  maxBuffer: 4 * 1024 * 1024, env: { ...process.env, npm_config_audit: "false", npm_config_fund: "false" } });
try {
  fs.mkdirSync(artifacts); fs.mkdirSync(install);
  run("npm", ["run", "build"], root);
  const [packed] = JSON.parse(run("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", artifacts], root));
  assert.ok(packed.files.some(file => file.path === "dist/cli.js"));
  assert.ok(packed.files.some(file => file.path === "bin/personal-harness.mjs"));
  assert.ok(packed.files.some(file => file.path === "bin/litcode.mjs"));
  assert.ok(packed.files.some(file => file.path === "NOTICE.md"));
  assert.ok(packed.files.some(file => file.path === "THIRD_PARTY_NOTICES.txt"));
  assert.equal(packed.files.some(file => /^(?:extracted[^/]*|research|test|scripts|\.agent|\.harness|src)\//.test(file.path)), false);
  const archive = path.join(artifacts, packed.filename);
  fs.writeFileSync(path.join(install, "package.json"), JSON.stringify({ private: true }));
  run("npm", ["install", "--offline", "--ignore-scripts", "--omit=dev", archive], install);
  const executable = path.join(install, "node_modules/.bin/litcode");
  const help = run(executable, ["--help"], install);
  assert.match(help, /--interactive/); assert.match(help, /LLM_API_KEY/);
  assert.match(help, /^LiTcode/);
  assert.equal(run(path.join(install, "node_modules/.bin/personal-harness"), ["--help"], install), help);
  const demo = spawnSync(executable, ["--demo"], { cwd: install, encoding: "utf8", timeout: 60000 });
  assert.equal(demo.status, 0, demo.stderr);
  assert.match(demo.stdout, /Offline demo passed/);
  const directory = /^workspace: (.+)$/m.exec(demo.stderr)?.[1];
  assert.ok(directory); assert.ok(directory.startsWith(fs.realpathSync(os.tmpdir()) + path.sep));
  assert.match(path.basename(directory), /^personal-agent-demo-/);
  assert.equal(fs.readFileSync(path.join(directory, "hello.txt"), "utf8"), "Hello from the independent agent.\n");
  assert.equal(fs.readdirSync(path.join(directory, ".agent")).some(name => name.endsWith(".lock")), false);
  fs.rmSync(directory, { recursive: true, force: true });
  assert.equal(fs.existsSync(path.join(install, "node_modules/tsx")), false);
  console.log(JSON.stringify({ package: "passed", compiledCLI: true, binHelp: true, offlineInstall: true,
    packagedDemo: true, devRuntimeAbsent: true, extractedSamplesExcluded: true, files: packed.files.length, upstreamRequests: 0 }));
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
