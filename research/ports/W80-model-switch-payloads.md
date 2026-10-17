# W80 — model-switch hook payloads

## Source position

`oXr` (chunk-sfn1dbxq.js, UTF-16 [2937531,2939081)) builds the PreModelSwitch
input as:

```
{...$d(e,se()), hook_event_name:"PreModelSwitch",
 from_model:n.fromModel, to_model:n.toModel, requested_model:n.requestedModel,
 source:n.source, ...zWe(n.toModel)}
```

`sXr` [2939454,2940852) builds the PostModelSwitch input with the same fields
and the same `...zWe(toModel)` spread. Both run the matcher against
`g4e(to_model)` only when `zIt` accepts the normalized alias.

The product previously sent `{model, previous_model}` for PreModelSwitch and
`{model, permission_mode, thinking}` for PostModelSwitch.

## Port

- PreModelSwitch sends `{from_model: config.model, to_model: model,
  requested_model: model}` before the configuration changes.
- PostModelSwitch sends `{from_model: previousModel, to_model: config.model,
  requested_model: config.model}`; `previousModel` is captured at the start
  of `applyConfig`, before the branch and session replacement.
- ConfigChange keeps its product payload on the non-model branch.
- `hookMatcherValue` for Pre/PostModelSwitch now reads `to_model` only.

## Adaptation

The model-alias normalization used by the recovered selector (`g4e`/zIt,
chunk-bk5ct2gw.js offsets 383071 and 383141) has no product counterpart, so the
selector uses the raw `to_model` text. `source` and the `zWe` model-flag
spread stay absent because the product's model command has no recovered source
value or flag set to report.

## Verification

`interactive` 7/7 captures real PreModelSwitch and PostModelSwitch hook stdin
around `/model second-model`: `from_model` is the prior model,
`to_model`/`requested_model` the new one. `hooks` 48/48 asserts the selector
takes `to_model` and ignores the old `model` field. tsc 0; build 0; full
2,107/2,107; chain 767/767; notices 0; source index unchanged; identity
`560f098a…`.
