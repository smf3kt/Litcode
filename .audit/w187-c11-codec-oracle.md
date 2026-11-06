# C11 image codec verification oracle (read directly from recovered source)

2026-10-19, peer session `c9c17d97`, read-only. Product files untouched. Written so any
C11 implementer and the verifier share one contract. Coordinates are zero-based UTF-16
half-open over `extracted-v2/modules/chunk-v96accjb.js` (SHA-256
`254872d392ad7917b0f7d66e55a4fcac638af5a0ec459ce30f108f404021c499`). The bodies below were
read in full this session, not summarized from another report.

## Constants

| Name | Value | Source |
|---|---|---|
| `r3` | `8000` | the "more than N pixels wide or tall" decode limit; also the error text |
| `we` | `r3*r3` = 64,000,000 | `Bun.Image` `maxPixels` |
| `ie` | `Set(["png","jpeg","gif","webp"])` | formats that skip the initial re-encode |
| `wZ` | `512000` | the byte budget `mb` enforces with `Xuo` after `WNe` returns |
| decode guard `ee` | `100` | diskless path refuses images whose read cost exceeds this |
| `ye` | `4` | encode concurrency |
| `xH` | `{maxWidth:2000, maxHeight:2000, maxBase64Size:5242880}` | the ordinary API image contract, `chunk-bf3z2ftn.js` (same module as `wZ`) |

`Ac` (`chunk-sfn1dbxq.js`) builds the `imageLimits` object the question consumers pass
into `P3`/`Qet`: `maxWidth`/`maxHeight` and `maxBase64Size` come from the session's
`image_limits` when present and from `xH` otherwise, `rejectMaxWidth`/`rejectMaxHeight` are
`max(configured, dynamic)` through `Arn`, and `targetRawSize` is `maxBase64Size * 3 / 4`
= 3,932,160. So `targetRawSize` (the `WNe` resize trigger) and `wZ` (the `mb` byte budget)
are two different thresholds; an image between them passes `WNe` untouched and is then
squeezed by `Xuo`.

## `Ie`/`q1` [6360,6589)

Decoration over `Bun.Image`: diskless sessions return a stub whose `metadata`/`toBuffer`
reject with `ERR_IMAGE_DECODE_FAILED`; otherwise a real `Bun.Image(bytes,{maxPixels:we})`.
`q1()` is the awaited accessor every other body uses.

## `WNe` [8222,12752) — resize decision order

1. `e.length===0` → throw `ImageResizeError("Image file is empty (0 bytes)")`.
2. `metadata()`; `format ?? mediaType`; `jpg` normalizes to `jpeg`.
3. Format not in `ie`: try direct WebP when both sides are within `maxWidth`/`maxHeight`
   and `directWebpMaxBytes` is defined, else re-encode `.png()`; recompute metadata;
   format becomes `webp` or `png`.
4. Unreadable dimensions: header probe; unknown or over `rejectMax*` → throw the
   `could not verify image dimensions are within the NxN px API limit` error; over
   `targetRawSize` → JPEG q80; else pass through unchanged.
5. Fast path: within `targetRawSize` and both sides within `max*` → return input buffer
   with `dimensions{originalWidth,originalHeight,displayWidth,displayHeight}`.
6. `T` = either side over `max`; `D` = current format is `png`.
7. `!T && size>targetRawSize`: palette PNG (`compressionLevel:9, palette:true`) when `D`,
   else the JPEG ladder **80, 60, 40, 20** — first candidate at or under budget wins.
8. Downscale to fit, `fit:"inside"`, `withoutEnlargement:true`; width first, then height.
9. Output format `C` = `png` when `T && directWebpMaxBytes!==undefined && originals within
   rejectMax && isAnimatedPngCandidate`, else `png` for gif/jpeg fallbacks; WebP attempt
   (`C_r`) only when `C==="png"`.
10. Still over budget after resize: palette PNG retry, then the ladder **80, 60, 40, 20**
    on the resized image, then the last resort `min(b,1000)` wide at JPEG q20 with
    `displayWidth`/`displayHeight` reporting the compressed size.
11. Failure path: non-`eO` errors classify by code (`ERR_IMAGE_DECODE_FAILED`=10,
    `ERR_IMAGE_UNKNOWN_FORMAT`=2, `ERR_IMAGE_TOO_MANY_PIXELS`=4,
    `ERR_IMAGE_FORMAT_UNSUPPORTED`=9, `EACCES|EPERM`=8, `ENOMEM`=5, else 3); when the raw
    base64 size fits `maxBase64Size` and dimensions fit, the **original bytes** are
    returned unchanged; otherwise a precise `Unable to resize image …` `eO` is thrown.

## `Xuo` [12879,13222) — byte-budget JPEG search

If the media type is not JPEG, encode q90 and take it when smaller; set the upper bound to
89. Then at most **5** rounds of bisection between bounds `1` and `a`, always keeping the
smallest buffer seen, returning the best at-or-under budget `y` else the smallest `s`.

## `mb` [13222,14061) — entry point

`{data, mediaType, limits, timings, allowWebp=true}` → buffer (or base64) → `WNe`; a thrown
`eO` becomes the degraded block `O(message,"resize_error")` rather than an exception. Above
`wZ` the buffer goes through `Xuo`; a `Xuo` failure logs and passes the buffer through
unbudgeted. Final bytes come from `Juo`, and the result is
`{block:{type:"image",source:{type:"base64",media_type:P6(bytes),data:base64}},dimensions}`.
`P6` sniffs the media type from the bytes, so a JPEG written under a PNG request reports
`image/jpeg`.

## `Juo` [14061,16572), `C_r`, `de`, `Ae`, `J`, `F`

WebP mode comes from `Y()`: `off` unless the `ze`-named gate returns `lossless` or `all`.
`de` accepts a lossless WebP only when re-decoding it to PNG is byte-identical to the
source PNG; `Ae` requires a lossless result at most half the budget, and in `all` mode a
lossy q90 candidate that is under budget and smaller than the JPEG q90 yardstick. `Juo`
only attempts WebP when the caller allowed it, the resized bytes are PNG, and the produced
buffer is smaller than the alternative. `epo(o)` is the lossless check inside `J`.

## `O` [17299,17435) — degraded result

`{block:{type:"text",text:"[Image could not be processed: <message>]"}}`. `mb` may therefore
return a text block where a caller expected an image; consumers must not treat
`contentBlocks` as images only.

## Buffer-level adapters that are not the codec

`T_r`/`Me`/`je`/`ve`/`Oe`/`mys`/`gys`/`W` and `JJ` belong to the large-file upload path
(scale ladder 1/.75/.5/.25, 800x800 palette PNG 64 colours, 600x600 q50, 400x400 q20,
`[Image: …]`/`[Image source: …]` annotations). They are a different contract from `mb` and
must not be reported as the question-image codec.

## What an independent acceptance can and cannot claim

Exact byte parity with `Bun.Image` is not observable on this host, so a port is verified
against the decision procedure above plus invariants: empty input degrades instead of
throwing; output at or under 512000 bytes whenever `Xuo` succeeds; both sides at or under
2000 after resize, and never above the 8000 decode cap; `media_type` matching the emitted
bytes; PNG-in/PNG-out pixel identity for inputs already within budget; the degraded text
block on decode failure. Claims about Bun's encoder internals stay out of the record.

A host with no encoder cannot run the palette/JPEG/WebP steps at all. The source's own
diskless stub fails those steps with `ERR_IMAGE_DECODE_FAILED` and lands on the recovery
path, which returns the original bytes when they already satisfy `maxBase64Size` and the
pixel bounds, and otherwise raises an `eO` whose message names the pixel limit or the byte
limit — so a port may legitimately refuse instead of resizing, provided it keeps those two
branch messages distinct:
"could not verify image dimensions are within" belongs to the case where dimensions were
never readable, while a readable image over the bound takes the
"dimensions exceed the NxNpx limit and image processing failed" wording.
