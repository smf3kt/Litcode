# W78 — permissive argument names

## Source position

`$oe(e)` (chunk-sfn1dbxq.js, UTF-16 [435233,435431)) reads the frontmatter
`arguments` field:

- falsy input returns `[]`;
- an array keeps every string that is non-empty after trimming and is not
  all digits, silently dropping other values;
- a string splits on whitespace and applies the same filter;
- anything else returns `[]`.

The frontmatter schema accepts `QP() = Ue([lOe(), A(o())])` (a scalar union or
an array of strings, offset 423443), so the filter, not a name regex, defines
what a name may be. Duplicates are kept.

`uHe` (chunk-sfn1dbxq.js [435534,436487)) builds the replacement pattern with
names sorted longest first and each name escaped through `gl`
(chunk-ax7r0qj7.js [677,739)): `value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`.
The per-name replacement uses the escaped name with `(?!\[\w)`, so a name may
contain regex metacharacters without changing the match.

## Port

`argumentNamesFrom` ports `$oe`; `config.ts` uses it for frontmatter names and
`expandSkill` filters its incoming names through it. `escapeRegExp` ports `gl`
and is applied to every name before the alternation is built. The first
occurrence of a duplicate name owns the position, matching the source's
longest-first replacement loop. The session skill schema accepts the same name
form (non-empty, not all digits) instead of the identifier regex.

## Adaptation

The product keeps its existing quote-aware tokenizer and single-pass combined
replacement; only name admission and pattern escaping change. The source's
sentinel handling for escaped dollars is already present in the product pattern
and is unchanged.

## Verification

`config`+`session` 70/70: `argumentNamesFrom` accepts dotted, plus, and non-ASCII
names and drops digits, empties, non-strings and non-list input; expansion
replaces all four permissive names in order; duplicate names use the first
position; the frontmatter test now accepts duplicates and permissive names and
drops an all-digit list, while the malformed-field loop no longer expects those
three headers to throw. tsc 0; build 0; full 2,105/2,105; chain 767/767;
notices 0; source index unchanged; identity `1c2b556a…`.
