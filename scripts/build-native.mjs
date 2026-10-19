// Builds the peer-identity N-API addon where a compiler and headers exist.
// Other hosts keep the package loadable and report identity as unverifiable.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "native/peer-identity/peer.c");
const target = path.join(root, "native/peer-identity/peer.node");

if (process.platform !== "darwin") {
  console.log(`build-native: skipped (peer identity addon is macOS-only; platform=${process.platform})`);
  process.exit(0);
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
  console.log("build-native: skipped (no node_api.h; set LITCODE_NODE_INCLUDE to build the addon)");
  process.exit(0);
}

execFileSync("clang", ["-dynamiclib", "-undefined", "dynamic_lookup", "-DNAPI_VERSION=8", "-mmacosx-version-min=11.0",
  "-I", include, "-o", target, source], { stdio: "inherit" });
const loaded = require(target);
if (typeof loaded.peer !== "function") throw new Error(`build-native: ${target} does not export peer()`);
console.log(`build-native: built ${path.relative(root, target)} with headers from ${include}`);
