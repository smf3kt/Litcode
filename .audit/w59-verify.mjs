import assert from "node:assert/strict"
import fs from "node:fs"
import {createRequire} from "node:module"
const root = "/Users/mant1ssa/Projects/cc-base-2188"
const require = createRequire(`${root}/package.json`)
const {LoggerProvider, BatchLogRecordProcessor} = require("@opentelemetry/sdk-logs")
let records = []
const exporter = {export(batch, done) {records.push(...batch); done({code:0})}, shutdown: async()=>{}}
const provider = new LoggerProvider({processors:[new BatchLogRecordProcessor({exporter, scheduledDelayMillis:60000})]})
provider.getLogger("fixture").emit({body:"w59-owned-fixture"})
await provider.forceFlush()
assert.equal(records.length,1)
assert.equal(records[0].body,"w59-owned-fixture")
await provider.shutdown()
const shell = require("shell-quote")
assert.deepEqual(shell.parse("a && b | c").filter(x=>typeof x === "object").map(x=>x.op),["&&","|"])
const entries = await fs.promises.readdir(root,{withFileTypes:true})
assert.ok(entries.length>0)
assert.ok(entries.every(entry=>typeof entry.name === "string"))
console.log("PASS installed log exporter flush, shell operator tokens, filesystem string names")
