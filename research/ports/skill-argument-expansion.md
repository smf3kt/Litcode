# Skill argument expansion source ledger

Status: source-mapped and finite local usage verified; independent extraction/index accepted by W02. Date: 2026-10-11.

This audits an existing implementation, rather than claiming a newly copied source port. Target classification: **rewrite**.

Artifact SHA-256: `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
Module `chunk-sfn1dbxq.js`: `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`.
All ranges below are left-closed/end-exclusive UTF-16 source indices. For these specific ASCII source functions, the corresponding UTF-8 byte offsets are equal.

| Source symbol | Module and range | Target / disposition |
| --- | --- | --- |
| uHe | chunk-sfn1dbxq.js [435534,436487) | src/config.ts expandSkill; rewrite |
| i5r | chunk-sfn1dbxq.js [435128,435233) | src/config.ts quotedSkillArguments plus whitespace fallback; rewrite |
| zH/rY | chunk-sfn1dbxq.js [435104,435115), [435116,435127) | Original reserved sentinel handling; no direct copy |
| SE | chunk-m00pavz3.js [4697,4822) | Original shell parser adapter; local finite text parser replaces it |
| gl | chunk-ax7r0qj7.js [677,739) | Original regular-expression escaping helper; local strict name validation avoids this dependency |

Dependency module SHA-256: chunk-m00pavz3.js `e4dcdda42fdf15ff719179977326a414b62ad13d5992832859839c9203c16a62`; chunk-ax7r0qj7.js `8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e`.
Target source ranges: quotedSkillArguments [52035,53087) and export expandSkill [53173,55473), UTF-16; corresponding UTF-8 byte offsets [52037,53089) and [53175,55475). Target src/config.ts SHA-256: `8a67a0772c3545234b746f38f5c1436d345cbbf1ff8eb8e39609080c460c6245`; all three source-module digests match accepted research-module-index-v4.json.

Why rewrite: recovered uHe uses protected sentinels and ordered replacement passes with an optional transform callback. Existing local code instead uses one regex replacement pass and compatibility feature gates. Original SE requires shell AST consumers (vS/nde/DKe) whose complete behavior remains unresolved here; a finite text tokenizer serves the existing explicitly scoped contract. This is behavioral migration, not copy/adapt of the implementation body.

Intentional differences: legacy local positions are one-based unless skillExtendedArguments is true; quote grouping/fallback are pinned feature choices; argument names use128 unique ASCII identifiers up to128 chars; empty bodies return empty; callback transformation and reserved-sentinel equivalence are absent. Inserted arguments stay literal. Unknown original parser/callback/consumer semantics remain explicit.

Consumers: src/skill-runtime.ts expandedBody performs whole-group inline command preflight, then expansion; main user/model/child paths share expansion and pinned config. Host dependencies are local config/session/permissions/process/provider interfaces. Effects from inline commands belong to separate skill recovery obligations.

Actual compiled CLI: named+quoted+fallback+aliases and extended+quoted+fallback each passed9 owned loopback requests, with invocation, model skill call, pinned resume, managed override, inline preflight, literal injected directives, interactive use and lock cleanup. Combining named+extended smoke flags triggers an incompatible fixture assertion at line72 because its body chooses the named escape; this attempt failed and establishes no product incompatibility.
Historical whole skills/source precedence/fork/crash-recovery coverage remains Partial; this ledger covers argument expansion and its exercised consumers only.
