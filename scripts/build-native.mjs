// Build native addons for the current installation host.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "native/peer-identity/peer.c");
const target = path.join(root, "native/peer-identity/peer.node");

if (process.platform !== "darwin" && process.platform !== "linux") {
  throw new Error(`build-native: skill effect locking unsupported on ${process.platform}`);
}

const require = createRequire(import.meta.url);
const headerCandidates = [
  process.env.LITCODE_NODE_INCLUDE,
  path.join(path.dirname(process.execPath), "../include/node"),
  "/opt/homebrew/include/node",
  "/usr/local/include/node",
  "/usr/include/node",
].filter(value => typeof value === "string" && value.length > 0);
const include = headerCandidates.find(directory => fs.existsSync(path.join(directory, "node_api.h")));
if (include === undefined) {
  throw new Error("build-native: no node_api.h; install Node headers or set LITCODE_NODE_INCLUDE");
}

const flags = process.platform === "darwin"
  ? ["-dynamiclib", "-undefined", "dynamic_lookup", "-mmacosx-version-min=11.0"]
  : ["-shared", "-fPIC"];
function build(input, output, symbol) {
  execFileSync("cc", [...flags, "-DNAPI_VERSION=8", "-I", include, "-o", output, input], { stdio: "inherit" });
  if (typeof require(output)[symbol] !== "function") throw new Error(`build-native: ${output} does not export ${symbol}()`);
  console.log(`build-native: built ${path.relative(root, output)} with headers from ${include}`);
}
if (process.platform === "darwin") build(source, target, "peer");
build(path.join(root, "native/file-lock/lock.c"), path.join(root, "native/file-lock/lock.node"), "lock");
execFileSync("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-O2", "-o",
  path.join(root, "native/shell-supervisor/supervisor"), path.join(root, "native/shell-supervisor/supervisor.c")], { stdio: "inherit" });
execFileSync("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-O2", "-o",
  path.join(root, "native/directory-read/read"), path.join(root, "native/directory-read/read.c")], { stdio: "inherit" });
execFileSync("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-O2", "-o",
  path.join(root, "native/directory-write/write"), path.join(root, "native/directory-write/write.c")], { stdio: "inherit" });
