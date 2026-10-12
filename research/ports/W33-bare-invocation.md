# W33 Bare invocation, version and install

Status: verified locally on macOS with Node v26.10.0, including a global install from the packed
tarball. Date: 2026-10-12.
Task: install once, then running `litcode` with no arguments at a terminal must open the interactive
session; `--version` must report the package version; a bare invocation without a terminal must print
the usage and exit 0; the README must describe that install.
Entry: `litcode` (the shipped bin, which imports the compiled `dist/cli.js`).
Targets: `src/cli.ts`, `test/cli.test.ts`, `README.md`. No recovered sample module is involved: this
record documents local product surface, not a port.

## What was wrong

The shipped bin always needed a task or an explicit `--interactive`, so a fresh install could not be
driven the way a harness normally is. Two guards also read the flag literally: `--mcp-elicitation` and
`--watch-config` refused to run unless `--interactive` had been typed, even when the process was
attached to a terminal. There was no `--version`, and a bare invocation with no terminal printed the
usage and exited 1 like any other argument error.

## Behaviour now

1. A bare invocation decides by terminal, not by a flag: with a terminal present it starts the
   interactive session (`impliedInteractive`), and without one it prints the usage and exits 0. The
   options that mean "this is already a specific command" are excluded from the implication:
   `--demo`, `--continue`, `--resume`, `--list-sessions`, `--approve-mcp-server`,
   `--reject-mcp-server`, and any positional task.
2. `--version` / `-v` print the package version and return before any credential check. `cliVersion()`
   reads `package.json` beside the compiled entry and falls back to the working directory, so both the
   source run and the installed layout answer `0.1.0` without a network or a model call.
3. The two terminal-dependent flags accept the implied interaction: they still refuse when no terminal
   is attached, and no longer require the flag to have been spelled out.
4. A missing credential reports what to set and points at `--demo`, instead of failing as an argument
   error.
5. The usage header reads as `litcode` rather than the legacy command name.

## Validation

- `npx tsc --noEmit`: clean. `npm run build`: clean.
- `test/cli.test.ts`: 10/10 pass. The three new cases are `--version` (exit 0, output equal to
  `package.json`'s version, `-v` agreeing), a bare invocation with a piped stdin (exit 0, usage
  printed, and `--mcp-elicitation` still refused without a terminal), and a bare invocation at a real
  terminal (the session banner, a `workspace:` line, and no model call spent).
- The terminal case needs a PTY. `script` refuses to start when its own standard input is a socket,
  which is what Node hands a spawned child, so the child runs behind a shell pipeline where stdin is
  an ordinary pipe; a host without `script`, or one that still refuses, skips the assertion.
- `npm test`: 1133/1133 pass (1130 before this package).
- `npm install -g <packed tarball>`: `litcode`, `litcode-magpie` and `personal-harness` all resolve on
  `PATH`. `litcode --version` prints `0.1.0`; `litcode --help` exits 0; a bare `litcode` on a PTY
  prints `session:`, `workspace:` and `Personal harness. /help for commands.` and exits on `/exit`
  without spending a model call; `litcode --demo` completes its offline demonstration.
- `npm run smoke:package`: `files 73, upstreamRequests 0`, every gate true.
- `npm run identity`: `b9210f5873ce2390e40f6f5aca1348c84cba376e651806b8a90754ba70d4d1f6`
  (inputs 125, validation 92, build 65). `src/cli.ts` and `README.md` are inputs and
  `test/cli.test.ts` is a validation input, so both digests move while the build file count does not.

## Notes

- The interactive banner still says `Personal harness.`, which is the legacy name carried by the
  session prompt. Renaming it is a separate change with its own test churn (23 occurrences across 19
  files) and was not part of this package.
- `node bin/litcode.mjs` and `npx tsx src/cli.ts` behave the same way; the compiled bin is what an
  installation runs.
