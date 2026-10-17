# W69 — the HTML preview fragment gate

## Source position

The recovered validator is `Ae` in `chunk-ktr9sak2.js` (UTF-16 code units
[19624,20102), 478 units). Its AskUserQuestion `validateInput` caller is [16528,16776), 248 units:

```js
async validateInput({questions:e}){if(uPr()!=="html")return{result:!0};
  for(let t of e)for(let n of t.options){let r=Ae(n.preview);
    if(r)return{result:!1,message:`Option "${n.label}" in question "${t.question}": ${r}`,errorCode:1}}
  return{result:!0}}
```

The gate `uPr` (`chunk-4bw62nzm.js` [98437,98515), 78 units) reads the host launch option
`questionPreviewFormat()`; its setter is `pPr`. `Ae` checks, in this order:

1. `undefined` preview — no error.
2. `/<\s*(html|body|!doctype)\b/i` — `preview must be an HTML fragment, not a full document
   (no <html>, <body>, or <!DOCTYPE>)`.
3. `/<\s*(script|style)\b/i` — `preview must not contain <script> or <style> tags. Use inline
   styles via the style attribute if needed.`
4. no `/<[a-z][^>]*>/i` — `preview must contain HTML (previewFormat is set to "html"). Wrap
   content in a tag like <div> or <pre>.`

## Port

`src/interaction-tools.ts` adds `previewFragmentError`, a direct port of `Ae` whose three
messages are copied verbatim, and `InteractionToolOptions.previewFormat?: 'html'`. When the host
declares HTML previews, `ask_user_question` walks every question option before dispatch and throws
the source's message shape with the product's tool-name prefix:

`ask_user_question: Option "<label>" in question "<question>": <message>`

The host launch option is represented by the product's explicit `previewFormat` factory option
instead of reading a live client setting, which is the recorded local adaptation: this harness has
no launch-options store, and the option makes the gate testable without a host. Omission keeps
previews opaque (length-checked only), matching the source's non-`"html"` path.

## Deliberate omissions

- The client setting storage and its setter (`pPr`), the launch-option plumbing and the
  tool-input error envelope (`result`/`errorCode`) are not ported; the product throws its usual
  tool error, and every other tool reports errors the same way.
- Annotation admission (`V`), extended question kinds and notes are separate C-11 work.

## Verification

`interaction-tools` 23/23 including two new cases (the three messages and their order; the gate
rejecting before any host call and accepting a fragment, with the opaque path unchanged). tsc 0;
build 0; full 2,094/2,094; chain 767/767; notices 0; source index unchanged (75 chunks, 323,525
units); identity `dc4f6cce…`.
