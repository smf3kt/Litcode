# W06 exercised skill and hook consumers

Date: 2026-10-11. Status: verified finite existing consumer slice; full source
equivalence remains Partial. This package audits existing implementations,
without relabeling rewritten components as direct source ports.

Argument expansion provenance is carried by
[skill-argument-expansion.md](skill-argument-expansion.md): original uHe/i5r
and shell-parser dependencies have exact module hashes and function ranges.
The target algorithm is a rewrite with pinned argument-policy differences.

Actual source CLI commands passed, each with 9 owned loopback model requests:

```
node scripts/smoke-skill-inline-cli.mjs --quoted --fallback --named --aliases
node scripts/smoke-skill-agent-cli.mjs
```

The inline receipt establishes whole-group permission preflight, literal
injected directives, named/quoted/fallback arguments, aliases, managed override,
pinned resume and lock cleanup. The agent receipt establishes foreground,
background and worktree skill routing, actual reads, model/effort selection,
tool intersection and owned worktree cleanup. Receipt filenames produced by
the reader were interchanged; evidence is identified by the actual receipt
fields, not by the filename's informal label.

HookLifecycle once behavior is a local rewrite: claims are journaled before
Target SHA-256: skill-runtime.ts
`14ef05db58604d2855265435a576f8ad677ef9fe7c9bfc67de229dd84d0e4fe0`;
hooks.ts `4013a6be69540907dcbd2ce7b92688826443e9ce67ea556c2eebbda21e365d27`;
async-hooks.ts `3de4a1e67d62e4fe928b0517776b6d5427f73b62c039d32b0bc8e8d40220ee61`.

effects and restored in the same session; a crash after a claim consumes the
attempt. It does not guarantee effect completion. Existing hook transports,
child terminal forwarding and consumer contracts are recorded in HOOKS.md;
their previous source anchors remain at their previous evidence level.

No original once-function body or complete original shell AST consumer was
established in this bounded pass. They remain explicit provenance gaps.
The finite package is complete for the actual usage chains above, while
historical full skills/hooks equivalence and cross-process shell effects
remain unverified.
