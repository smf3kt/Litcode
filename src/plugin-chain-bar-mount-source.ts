// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-tvdq3hrk.js sha256 d425ee99ec3ed8d974bc6559b8483cf045cb98a23309866d96ed43e41cf433c5
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The two reads the bar's pane-hold effect makes off the panes store (W45-38): `YAt` finds the open
// pane a surface is showing, and `gro` asks whether that pane's placements hold the toasts. Both are
// the source's bodies verbatim; the state they read arrives as a parameter, because the subscription
// that selects them (`Re(Ri(), gro)` in the bar component) belongs to the host's React layer.

// chunk-tvdq3hrk.js declares YAt, the open pane whose id is the shown one [7622,7670) 48 units sha256 fd342ab8523e60d73591585b2af6c7ecf104b08d3d136245884d2a017bd81792
var YAt=(e)=>e.open.find((r)=>r.id===e.shownId);

// chunk-tvdq3hrk.js declares gro, whether that pane's placements hold toasts [7670,7723) 53 units sha256 ac7340b080cb5b096146e406ad0906dbba05221e4945ccff68631c0565f70c3e
var gro=(e)=>e.placements>0&&YAt(e)?.holdToasts===!0;


export { YAt, gro };
