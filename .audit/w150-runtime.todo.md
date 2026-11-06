# W150 runtime trail

## W150-01 acceptance (2026-10-18)

- [x] **Source read.** `fpr`/`QT` (101 units), `k0`/`C0`/`nK`/`rK`/`sK`/`lK`/`Ene`/`Nne`/`uK`
  (4,534), `kNo` (73), `Ihe` (40), `fd`/`kd`/`Md` (284); 16 blocks, 5,032 units.
- [x] **Port.** Generated `src/plugin-chain-above-prompt-select-keys-source.ts`; the typed seam
  exposes the two field hooks, the keys-ahead handler, the select hook, the two terminal
  dispatches, the classifiers and the controlled-state hook.
- [x] **Scan.** unresolved 0 after adding W149's `qAt`/`KAt` to the generated import.
- [x] **Tests.** 12 cases cover key classification (including the source's `undefined`
  short-circuits), optionText, handler mapping, focusableAt, controlled state, input edit/submit,
  closed and open select intercepts, the pre-dispatch handler, and the quiet select dispatch.
- [x] **Gates.** Focused 14/14, full 2330/2330, tsc 0, build 0, notices 0, identity
  `40f60975bacd50dae8eb0bddbf4b47598c80e65c1bc4e7cc64d578cfae5cc474`.
- [ ] Next: `NFe` component, then fast mode, diff, attachments/footer.
