import fs from "node:fs"
import crypto from "node:crypto"
import {execFileSync} from "node:child_process"
const root="/Users/mant1ssa/Projects/cc-base-2188"
const audit="/Users/mant1ssa/Projects/cc_reverse/.audit"
const hash=s=>crypto.createHash("sha256").update(s).digest("hex")
const log=fs.readFileSync(`${audit}/w59-tsc-final.txt`,"utf8")
const diagnostics=[...log.matchAll(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/gm)].map(m=>({file:m[1],line:+m[2],column:+m[3],code:m[4],message:m[5]}))
const files=execFileSync("git",["-C",root,"diff","--name-only"],{encoding:"utf8"}).trim().split("\n")
const identities=Object.fromEntries([...files,"package.json","package-lock.json","tsconfig.json"].map(f=>[f,hash(fs.readFileSync(`${root}/${f}`))]))
const sources=[]
const sourceCommit="bd958088195aefbb4bce96ba966447e5e09b1312"
const baselineCommit=execFileSync("git",["-C",root,"rev-parse","HEAD"],{encoding:"utf8"}).trim()
for(const file of files){
  let text
  try {text=execFileSync("git",["-C",root,"show",`bd958088195aefbb4bce96ba966447e5e09b1312:${file}`],{encoding:"utf8",maxBuffer:32*1024*1024,stdio:["ignore","pipe","pipe"]})} catch {sources.push({file,status:"absent-in-original-commit",authority:"existing reconstruction"});continue}
  const diff=execFileSync("git",["-C",root,"diff",sourceCommit,"--unified=0","--",file],{encoding:"utf8",maxBuffer:32*1024*1024})
  sources.push({file,commit:sourceCommit,sha256:hash(text),coordinates:"one-based-lines",range_semantics:"old ranges address source commit; new ranges address working tree; each is start,count",changed_hunks:[...diff.matchAll(/^@@ (.*?) @@/gm)].map(m=>m[1])})
}
for(const [file,ranges] of [["chunk-4bw62nzm.js",[[3034,3042],[7612,7617]]],["chunk-xveb52av.js",[[1347,1359]]]]){sources.push({file:`/Users/mant1ssa/Projects/cc_reverse/recovered/${file}`,sha256:hash(fs.readFileSync(`/Users/mant1ssa/Projects/cc_reverse/recovered/${file}`)),coordinates:"one-based-lines-inclusive",ranges})}
const result={status:"partial-unfinished",head:execFileSync("git",["-C",root,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),compiler:"7.0.2",baseline_errors:136,errors:diagnostics.length,files:new Set(diagnostics.map(d=>d.file)).size,diagnostics,identities,sources,log_sha256:hash(log),checks:[{command:"tsc --noEmit --pretty false",exit:1},{command:"w58-verify.mjs",exit:0},{command:"w59-verify.mjs",exit:0},{command:"w59-followup-verify.mjs",exit:0},{command:"git diff --check (both repositories)",exit:0}],incidents:["Initial AST matcher compared quoted token to bare text; zero edits; historical evidence retained.","Original gated module bodies differ from already folded null calls; source AST ranges used.","Assistant/normalized message tightening created new consumer errors; those experimental edits withdrawn.","Compilation cleanup remains incomplete; remaining diagnostics are not all source-absence blockers."],limitations:["No full build or application CLI validation","Control schema variants require further source recovery","Tungsten exports remain absent in searched recovered tree","Live USER_TYPE null module branches preserved","Full build remains blocked by four unresolved runtime implementation diagnostics"]}
result.head=baselineCommit
const evidencePath=process.argv[2] ?? `${audit}/w59-checkpoint-final.json`
fs.writeFileSync(evidencePath,JSON.stringify(result,null,2)+"\n",{flag:"wx"})
console.log(JSON.stringify({errors:result.errors,files:result.files,changed_files:files,log_sha256:result.log_sha256}))
