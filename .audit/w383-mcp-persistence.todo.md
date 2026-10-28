# W383 MCP persistence acceptance

- [x] Reproduce the compiled fork failure and identify both output streams and branch ownership.
- [x] Bind the recovered fork bodies and document the driver-only adapter before editing.
- [x] Update the existing acceptance driver, retaining its persistence and cleanup assertions.
- [x] Run the compiled chain including SIGKILL recovery and relevant MCP regressions at a recorded identity; explicitly observe the active parent via `/status`.
- [x] Independent static reviews found fork observation, duplicate-history and request-window gaps; repairs and compiled SIGKILL chain pass.
- [x] Obtain an independent scoped static review of the final assertions and record its limits.
- [x] Update the current and MCP feature records and prepare exact-path local delivery.
