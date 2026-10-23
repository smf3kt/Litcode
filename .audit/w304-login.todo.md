# W304 login and unconfigured start trail

## W304-01 acceptance (2026-10-23)

- [x] **Source read.** Provider construction (`src/provider.ts`), startup credential
  resolution and the one-shot gate in `src/cli.ts`, the loop's provider binding and
  command dispatch in `src/interactive.ts`, and the gateway-inheritance normalizer.
  No recovered body implements DeepSeek, so the S-7 exception is recorded in
  `research/ports/W304-local-login.md`.
- [x] **Provider facts.** DeepSeek publishes an API key (`x-api-key`), base
  `https://api.deepseek.com/anthropic` and models `deepseek-flash` / `deepseek-v4-pro`.
  No authorization server, device flow or token endpoint is published, so DeepSeek
  takes the key flow and OAuth is offered only for a gateway that runs one.
- [x] **Unconfigured start.** An interactive session with no credential and no model
  opens; the missing model becomes the `unconfigured` sentinel, the first turn is
  refused before the prompt is journaled, and `/login` still works mid-turn.
- [x] **Credential store.** `<userDir>/credentials.json` at mode 0600 through
  `atomicWriteFile`, refused for a symlink, oversized or malformed file, and gated by
  `sameGateway` so a credential never travels to another endpoint.
- [x] **Precedence.** Flag > `LLM_*` > settings > inherited client > stored credential
  > default. One-shot runs still fail fast with the sign-in hint.
- [x] **Gates.** `npx tsc --noEmit` 0, `npm run build` 0, `npm run check` 0,
  `git diff --check` clean, `test/login.test.ts` 7/7, related group 50/50,
  compiled driver 17/17, identity `fe83b1aa…`, paid upstream 0.
- [ ] **Independent review.** Dispatched; the first attempt died on an unavailable
  model. Awaiting the retry verdict before the commit.
