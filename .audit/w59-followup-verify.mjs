import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import {createRequire} from "node:module"
import ts from "/tmp/w47-tools/node_modules/typescript/lib/typescript.js"
const root = "/Users/mant1ssa/Projects/cc-base-2188"
const require = createRequire(`${root}/package.json`)
const {z} = require("zod/v4")
const source = fs.readFileSync(`${root}/entrypoints/sdk/coreSchemas.ts`,"utf8")
const sf = ts.createSourceFile("coreSchemas.ts",source,ts.ScriptTarget.Latest,true)
const names = new Set(["PermissionModeSchema","PermissionUpdateSchema","PermissionBehaviorSchema","PermissionUpdateDestinationSchema","PermissionRuleValueSchema"])
const parts = sf.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>names.has(d.name.getText(sf)))).map(n=>n.getText(sf).replace(/^export /,""))
const context = {z,lazySchema:fn=>{let value;return()=>value??=fn()}}
const schema = vm.runInNewContext(`${parts.join("\n")}; PermissionUpdateSchema()`,context)
assert.equal(schema.parse({type:"setMode",mode:"plan",destination:"session"}).mode,"plan")
assert.equal(schema.safeParse({type:"setMode",destination:"session"}).success,false)
assert.equal(schema.safeParse({type:"setMode",mode:"invalid",destination:"session"}).success,false)
const generatorSource = fs.readFileSync(`${root}/utils/generators.ts`,"utf8")
const exports = {}
vm.runInNewContext(ts.transpile(generatorSource,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}),{exports,Symbol,Set,Promise})
async function* values(items){for(const x of items)yield x}
const output=[]
for await(const x of exports.all([values([1,2]),values([3])],1)) output.push(x)
assert.deepEqual(output,[1,2,3])
const relay = fs.readFileSync(`${root}/upstreamproxy/relay.ts`,"utf8")
const relaySf=ts.createSourceFile("relay.ts",relay,ts.ScriptTarget.Latest,true)
const funcs=relaySf.statements.filter(n=>ts.isFunctionDeclaration(n)&&["encodeChunk","decodeChunk"].includes(n.name?.text)).map(n=>n.getText(relaySf).replace(/^export /,""))
const codec=vm.runInNewContext(ts.transpile(`${funcs.join("\n")}; ({encodeChunk,decodeChunk})`,{target:ts.ScriptTarget.ES2022}),{Uint8Array})
for(const length of [0,1,128,16384]) {const bytes=new Uint8Array(length).fill(73);assert.deepEqual(codec.decodeChunk(codec.encodeChunk(bytes)),bytes)}
const {Diagnostic}=require("vscode-languageserver-protocol")
assert.equal(Diagnostic.getMessageString({message:{kind:"markdown",value:"fixture"}}),"fixture")
console.log("PASS permission validation, generator ordering/completion, binary framing boundaries, installed LSP text conversion")
