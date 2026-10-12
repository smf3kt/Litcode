# W19 - a credential shape is redacted from text the harness passes on

## Recovered surface

`chunk-gyf58rwf.js`, sha256
`7a6a01732760c89b5d434cc5ba98faf72b10917d85b771671f8201e9e3d8d2ad`, 82836 bytes, read as
inert data. Coordinates are zero-based UTF-16, left-closed/end-exclusive over the decoded
module text.

| Symbol | Range | What it is |
| --- | --- | --- |
| `qr=["sk","ant","api"].join("-")` | [23233, 23265) | the Anthropic prefix, joined rather than spelled |
| `M="[\\w=-]"`, `U=\`${M}{20,}(?:\\.[0-9a-z]{9})?\`` | [23265, 23310) | the GitLab token body and its character class |
| `mn=[{id:"url-userinfo"…}]` | [24001, 30608) | the table: 64 entries, 12 low confidence and 52 high |
| `function is()` | [31548, 31915) | compiles the table for scanning, prefix-anchoring the high-confidence entries |
| `function he(e)` | [31915, 32344) | compiles it again for replacement, with the `displayRun` boundary form |
| `function ke(e,n)` | [32405, 32616) | the substitution: a matched value becomes `[REDACTED]`, keeping surrounding quotes |

The table's entries are `{ id, source, flags?, confidence, prefilter?, displayRun?, redactOnly? }`.The high-confidence half is prefix-anchored provider formats (`AKIA…`, `AIza…`, `GOCSPX-…`,
`dop_v1_…`, `ghp_…`, `glpat-…`, `xoxb-…`, `SG.…`, `npm_…`, `PMAK-…`, `sk-ant-api03-…` and the
rest); the low-confidence half is contextual - URL userinfo, an authorization header value, a
loose JWT behind an `eyJ` prefilter, an assignment to a field named like a secret, a loose
Anthropic prefix, a cloud service-account mailbox - and some of those entries are `redactOnly`.

## Ported invariant

Text the harness passes on has two ways a credential can be found in it: the session can know
the string, or the string can have a shape the provider published. A span of the second kind
is replaced with the redaction token, keeping the text around it.

Classification: copy of the precise half of the recovered table, and of the substitution, onto the redaction helper this runtime already runs over text it re-emits. The table is transcribed with the recovered spellings and the recovered prefix anchoring kept implicit in each pattern; the twelve contextual entries and the prefilter/`redactOnly`/confidence machinery are not carried, because this surface drops a citation whose URL changes under redaction and a broad pattern would discard legitimate results. Recognising a credential by shape is the rule; the token and the entry set are this runtime's own.

## What the local runtime had

`src/web-search.ts:58` already redacts, but only the first way: for every secret in this
session's own configuration it replaces the raw and URL-encoded spellings with `[redacted]`,
on the query, each citation's title and snippet, and each citation URL - where a URL that
changes under redaction is dropped rather than rewritten (`src/web-search.ts:151`). A provider
token the session was never configured with went through untouched.

## What landed

| File | Change |
| --- | --- |
| `src/credential-shapes.ts` | new: the 52-entry shape table, the compiled patterns, `redactCredentialShapes` and `credentialShapeIds` |
| `src/web-search.ts` | the existing `redact` helper returns through the shape pass |
| `test/credential-shapes.test.ts` | new: 5 cases |
| `test/web-search.test.ts` | one case driving the wiring end to end |

## Owned decisions

- **Only the precise half of the table is carried.** The twelve low-confidence entries are
  absent. The reason is this surface's own behaviour: a citation whose URL changes under
  redaction is dropped, so a pattern that matches an ordinary `user:password@host` URL, the
  word before an `=`, or a 20-character header value would silently discard legitimate search
  results. Shape recognition here has to be a credential rather than a guess. The test asserts
  the absence, so re-adding one is a deliberate act.
- **The local token, not the recovered one.** The recovered substitution is `[REDACTED]`; this
  surface already writes `[redacted]`, and a string can carry known-secret and shape
  redactions together, so one spelling is kept rather than two tokens in one output.
- **The captured span is replaced, not the whole match.** Several recovered patterns carry
  trailing context (`(?:[\x60'"\s;]|\\[nr]|$)`) so the token is found at a boundary. Replacing
  the whole match would eat the delimiter; group 1 when present, the whole match otherwise,
  which is what the recovered substitution does.
- **The `displayRun` boundary form is folded into the plain patterns.** The recovered compiler
  builds a lookbehind from a `displayRun` prefix for the GitLab family. Here each of those
  patterns already spells its prefix (`glpat-`, `gldt-`, …), so a partial match inside a longer
  token is impossible without the extra machinery; the patterns are carried as the table spells
  them and the compiler stays small.
- **The table is compiled once and re-used.** The recovered code strips a caller's `g` and
  re-adds it, because a table entry can be compiled once and looped over. The same care is
  needed on the local side against `lastIndex` carrying between calls, and a case asserts a
  second occurrence in the same string is still redacted.
- **`credentialShapeIds` is exported for diagnosis.** Redaction does not need to know which
  rule fired; an operator asking why a sentence changed does.

## Not ported

- The twelve low-confidence entries, listed above, with the reason.
- The `prefilter` and `redactOnly` machinery: no carried entry uses a prefilter (the loose JWT
  that needed one is not carried), and `redactOnly` distinguishes an entry that redacts without
  counting as a finding, which has no meaning on a surface that only redacts.
- The confidence grading as a runtime value: it existed to decide which entries get prefix
  anchoring. The carried entries are all anchored by their own format, so the field would be
  carried without being read.
- The other consumers of the same module: this port lands on the one local surface that
  re-emits text, and none of the recovered module's `markdown link rewriting` half is in scope.

## Verification

- `npm test` - 1116 pass, 0 fail. `test/credential-shapes.test.ts` holds 5 cases: every family
  has a sample and every sample matches its own id; a span is replaced with its surroundings
  intact and several spans in one string are all replaced; ordinary text and near-misses
  (a prefix with too few characters, a documented prefix on its own) are untouched; the
  ambiguous entries are absent and the shapes they would have caught are left alone; and the
  compiled table carries no state between calls.
- `test/web-search.test.ts` gains the end-to-end case: a result whose snippet carries a GitHub
  PAT and a Slack token the session was never configured with comes back redacted, a citation
  whose URL carries one is dropped, and an unrelated citation is unchanged.
- `npx tsc --noEmit` clean; `npm run build` exit 0; `npm run smoke:package` passed, 70 files,
  0 upstream requests.
- No CLI driver was added: the shape table is a pure function of its input, and the existing
  web-search fixture already drives the surface the rule lands on.

Regressions: none. The existing known-secret case is unchanged, and the shape pass is a no-op
on every string that carries no provider-shaped token.
