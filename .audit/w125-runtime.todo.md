# W125 runtime trail

## W125-01 acceptance (2026-10-17)

- [x] **Parser.** First pure-literal `meta` export, reserved keys, phase
  filtering, 524,288-byte cap and acorn caret errors.
- [x] **Transform.** Strict async wrapper, reserved identifiers, `with`,
  `import()`, `await using`, and await/return/yield/for-await rewriting.
- [x] **Compiler.** Async-iterator bridge, `workflow.js` script with dynamic
  import rejected.
- [x] **Sandbox.** Date/Math.random disabled, intrinsics frozen, code
  generation disabled, `process`/`require` absent, host errors projected.
- [x] **Hooks.** agent through the registry, parallel/pipeline failure
  semantics, phase/log/console/budget/timers/args, bounded copies.
- [x] **Contracts.** Function results rejected; failed children log and return
  null; result shape and output cap.
- [x] **Gates.** Workflow family 42/42, tsc 0, build 0, full 2,203/2,203,
  chain 768/768, notices 0, index unchanged, identity `3f771f63…`.
- [ ] Remaining C-8: journal/resume, scriptPath/named workflows, reattachment,
  automatic effect replay, structured output.
