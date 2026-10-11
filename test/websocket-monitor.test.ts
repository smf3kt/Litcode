import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import { test } from "node:test";

import WebSocket, { WebSocketServer } from "ws";

import {
  BackgroundRegistry,
  createBackgroundTools,
  type BackgroundEvent,
  type BackgroundRegistryOptions,
} from "../src/background.js";
import type { ToolContext } from "../src/tools.js";

const signal = () => new AbortController().signal;
const context = (overrides: Partial<ToolContext> = {}): ToolContext => ({
  workspace: os.tmpdir(), signal: signal(), allowShell: false, maxOutputBytes: 100_000,
  ...overrides,
});
const registry = (overrides: Partial<BackgroundRegistryOptions> = {}) =>
  new BackgroundRegistry({ workspace: os.tmpdir(), ...overrides });
const done = (jobs: BackgroundRegistry, id: string) => jobs.waitFor(id, 5000, signal());
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
async function until(check: () => boolean): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!check()) {
    assert.ok(Date.now() < deadline, "condition timed out");
    await pause(10);
  }
}

async function server(handler: (socket: WebSocket) => void = () => {}) {
  const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  wss.on("connection", (socket) => {
    socket.on("error", () => {});
    handler(socket);
  });
  await once(wss, "listening");
  const address = wss.address();
  assert.ok(address && typeof address !== "string");
  return {
    wss,
    url: `ws://127.0.0.1:${address.port}`,
    async close() {
      for (const client of wss.clients) client.terminate();
      await new Promise<void>((resolve, reject) => wss.close((error) => error ? reject(error) : resolve()));
    },
  };
}

// HTTP peers can deliberately hold a handshake open or reject its upgrade.
async function httpPeer(status?: number, headers: Record<string, string> = {}) {
  const sockets = new Set<net.Socket>();
  const app = http.createServer();
  let upgrades = 0;
  app.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.once("end", () => socket.destroy());
    socket.once("close", () => sockets.delete(socket));
  });
  app.on("upgrade", (_request, socket) => {
    upgrades += 1;
    if (status !== undefined) {
      const fields = Object.entries(headers).map(([key, value]) => `${key}: ${value}\r\n`).join("");
      socket.write(`HTTP/1.1 ${status} Rejected\r\n${fields}Content-Length: 999999\r\n\r\n`);
    }
  });
  app.listen(0, "127.0.0.1");
  await once(app, "listening");
  const address = app.address();
  assert.ok(address && typeof address !== "string");
  return {
    url: `ws://127.0.0.1:${address.port}`,
    sockets,
    get upgrades() { return upgrades; },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) => app.close((error) => error ? reject(error) : resolve()));
    },
  };
}

function monitor(jobs: BackgroundRegistry, websocket?: boolean) {
  return createBackgroundTools(jobs, websocket === undefined ? {} : { websocket })
    .find((tool) => tool.schema.name === "monitor")!;
}

function messages(events: BackgroundEvent[]) {
  return events.filter((event) => event.kind === "line" && event.stream === "stdout");
}

test("WebSocket offers subprotocols, preserves multiline/blank messages and reports binary size", async () => {
  let protocol = "";
  let extensions = "";
  const peer = await server((socket) => {
    protocol = socket.protocol;
    extensions = socket.extensions;
    socket.send("first\nsecond\n");
    socket.send("");
    socket.send(Buffer.from([0, 1, 2]));
    socket.close(1000, "finished");
  });
  const jobs = registry();
  try {
    const job = jobs.startWebSocket({ url: peer.url, protocols: ["events.v1", "events.v2"] }, "events", 5000);
    assert.equal(job.source, "websocket");
    assert.equal(job.kind, "monitor");
    assert.equal(job.pid, undefined);
    assert.deepEqual(job.ws?.protocols, ["events.v1", "events.v2"]);
    const view = await done(jobs, job.id);
    assert.equal(protocol, "events.v1");
    assert.equal(extensions, "");
    assert.equal(view.state, "completed");
    assert.equal(view.pid, null);
    assert.equal(view.exit_code, null);
    assert.equal(view.close_code, 1000);
    assert.equal(view.close_reason, "finished");
    assert.equal(view.stdout, "first\nsecond\n\n\n[binary frame, 3 bytes]\n");
    const events = jobs.drainNotifications(1000).events;
    assert.deepEqual(messages(events).map((event) => event.text), ["first\nsecond\n", "", "[binary frame, 3 bytes]"]);
    assert.deepEqual(messages(events)[0]?.lines, ["first\nsecond\n"]);
    const exits = events.filter((event) => event.kind === "exit");
    assert.equal(exits.length, 1);
    assert.equal(exits[0]?.close_code, 1000);
    assert.equal(exits[0]?.close_reason, "finished");
    assert.match(exits[0]!.text, /1000.*finished/);
  } finally {
    await jobs.close();
    await peer.close();
  }
});

for (const code of [1001, 1011, 4001]) {
  test(`WebSocket close ${code} reports its terminal state and reason`, async () => {
    const peer = await server((socket) => socket.close(code, "peer reason"));
    const jobs = registry();
    try {
      const job = jobs.startWebSocket({ url: peer.url }, "close", 5000);
      const view = await done(jobs, job.id);
      assert.equal(view.state, code === 1001 ? "completed" : "failed");
      assert.equal(view.close_code, code);
      assert.equal(view.close_reason, "peer reason");
      const exit = jobs.drainNotifications().events.find((event) => event.kind === "exit")!;
      assert.equal(exit.state, view.state);
      assert.match(exit.text, new RegExp(`${code}.*peer reason`));
    } finally {
      await jobs.close();
      await peer.close();
    }
  });
}

test("abrupt WebSocket termination surfaces abnormal close 1006", async () => {
  const peer = await server((socket) => socket.terminate());
  const jobs = registry();
  try {
    const job = jobs.startWebSocket({ url: peer.url }, "abrupt", 5000);
    const view = await done(jobs, job.id);
    assert.equal(view.state, "failed");
    assert.equal(view.close_code, 1006);
    const exit = jobs.drainNotifications().events.find((event) => event.kind === "exit")!;
    assert.match(exit.text, /failed.*1006/);
  } finally {
    await jobs.close();
    await peer.close();
  }
});

test("failed HTTP upgrade reports status, terminates and disposes a hanging response", async () => {
  const peer = await httpPeer(403);
  const jobs = registry();
  try {
    const job = jobs.startWebSocket({ url: peer.url }, "upgrade", 5000);
    const view = await done(jobs, job.id);
    assert.equal(view.state, "failed");
    assert.match(view.error!, /HTTP 403/);
    assert.match(view.stderr, /HTTP 403/);
    assert.equal(view.close_code, 1006);
    assert.ok(jobs.drainNotifications().events.some((event) => /HTTP 403/.test(event.text)));
    await until(() => peer.sockets.size === 0);
  } finally {
    await jobs.close();
    await peer.close();
  }
});

test("WebSocket redirects fail without contacting the redirect destination", async () => {
  const target = await httpPeer();
  const redirect = await httpPeer(302, { Location: target.url });
  const jobs = registry();
  try {
    const job = jobs.startWebSocket({ url: redirect.url }, "redirect", 5000);
    const view = await done(jobs, job.id);
    assert.equal(view.state, "failed");
    assert.match(view.error!, /HTTP 302/);
    assert.equal(target.upgrades, 0);
  } finally {
    await jobs.close();
    await redirect.close();
    await target.close();
  }
});

test("connection errors are notifications with a failed terminal event", async () => {
  const peer = await server();
  const url = peer.url;
  await peer.close();
  const jobs = registry();
  try {
    const job = jobs.startWebSocket({ url }, "connection error", 5000);
    const view = await done(jobs, job.id);
    assert.equal(view.state, "failed");
    assert.match(view.error!, /ECONNREFUSED/);
    const events = jobs.drainNotifications().events;
    assert.ok(events.some((event) => /ECONNREFUSED/.test(event.text)));
    assert.equal(events.filter((event) => event.kind === "exit").length, 1);
    assert.equal(events.at(-1)?.close_code, 1006);
  } finally {
    await jobs.close();
  }
});

test("messages larger than maxPayload fail visibly with bounded retained output", async () => {
  const peer = await server((socket) => socket.send("a".repeat(1024 * 1024 + 1)));
  const jobs = registry({ maxOutputBytes: 64 });
  try {
    const job = jobs.startWebSocket({ url: peer.url }, "payload", 5000);
    const view = await done(jobs, job.id);
    assert.equal(view.state, "failed");
    assert.match(view.error!, /payload/i);
    assert.equal(view.stdout_bytes, 0);
    assert.ok(Buffer.byteLength(view.stderr) <= 64);
    assert.ok(jobs.drainNotifications().events.some((event) => /payload/i.test(event.text)));
    await until(() => peer.wss.clients.size === 0);
  } finally {
    await jobs.close();
    await peer.close();
  }
});

for (const cap of [5, 4096, 10_000]) {
  test(`WebSocket events use UTF-8 safe cuts with event budget ${cap}`, async () => {
    const text = "你".repeat(2000);
    const seen: BackgroundEvent[] = [];
    const peer = await server((socket) => { socket.send(text); socket.close(1000, "done"); });
    const jobs = registry({ maxEventBytes: cap, maxOutputBytes: 64, onNotification: (event) => seen.push(event) });
    try {
      const job = jobs.startWebSocket({ url: peer.url }, "utf8", 5000);
      const view = await done(jobs, job.id);
      const frame = messages(seen)[0]!;
      assert.equal(frame.truncated, true);
      assert.equal(frame.original_bytes, 6000);
      assert.ok(Buffer.byteLength(frame.text) <= Math.min(4096, cap));
      assert.equal(frame.text.includes("�"), false);
      assert.equal(frame.text, "你".repeat(Math.floor(Math.min(4096, cap) / 3)));
      assert.equal(view.stdout_truncated, true);
      assert.equal(view.stdout.includes("�"), false);
      assert.ok(Buffer.byteLength(view.stdout) <= 64);
      assert.equal(view.stdout_bytes, 6001);
      assert.ok(view.truncated_lines >= 1);
      const drained = jobs.drainNotifications(1000);
      assert.ok(drained.events.reduce((sum, event) => sum + Buffer.byteLength(event.text), 0) <= cap);
      if (cap < 10_000) assert.ok(drained.dropped > 0);
    } finally {
      await jobs.close();
      await peer.close();
    }
  });
}

test("notification event cap evicts frames with counted drops", async () => {
  const peer = await server((socket) => {
    for (let index = 0; index < 8; index += 1) socket.send(String(index));
    socket.close(1000);
  });
  const jobs = registry({ maxEvents: 3 });
  try {
    const job = jobs.startWebSocket({ url: peer.url }, "count cap", 5000);
    await done(jobs, job.id);
    const drained = jobs.drainNotifications(1000);
    assert.equal(drained.events.length, 3);
    assert.equal(drained.dropped, 6);
    assert.deepEqual(messages(drained.events).map((event) => event.text), ["6", "7"]);
  } finally {
    await jobs.close();
    await peer.close();
  }
});

test("single oversized shell event also respects the shared queue byte budget", async () => {
  const jobs = registry({ maxEventBytes: 4 });
  try {
    const job = jobs.start("printf 'abcdef\\n'", "queue", 5000, "monitor");
    assert.equal((await done(jobs, job.id)).state, "completed");
    const drained = jobs.drainNotifications();
    assert.ok(drained.events.reduce((sum, event) => sum + Buffer.byteLength(event.text), 0) <= 4);
    assert.equal(drained.dropped, 1);
  } finally {
    await jobs.close();
  }
});

test("WebSocket flood fails instead of coalescing or silently suppressing messages", async () => {
  const peer = await server((socket) => {
    for (let index = 0; index < 300; index += 1) socket.send(String(index));
  });
  const seen: BackgroundEvent[] = [];
  const jobs = registry({ onNotification: (event) => seen.push(event) });
  try {
    const job = jobs.startWebSocket({ url: peer.url }, "flood", 5000);
    const view = await done(jobs, job.id);
    assert.equal(view.state, "failed");
    assert.match(view.error!, /flood/);
    assert.equal(messages(seen).length, 199);
    assert.ok(messages(seen).every((event) => event.lines.length === 1));
    assert.ok(seen.some((event) => /flood/.test(event.text)));
    assert.equal(seen.filter((event) => event.kind === "exit").length, 1);
    await until(() => peer.wss.clients.size === 0);
  } finally {
    await jobs.close();
    await peer.close();
  }
});

for (const pending of [false, true]) {
  test(`task_stop cancels ${pending ? "CONNECTING" : "OPEN"} WebSocket and resolves waiters once`, async () => {
    const peer = pending ? await httpPeer() : await server();
    const jobs = registry();
    try {
      const job = jobs.startWebSocket({ url: peer.url }, "stop", 5000);
      if (pending) await until(() => "upgrades" in peer && peer.upgrades === 1);
      else await until(() => "wss" in peer && peer.wss.clients.size === 1);
      const waiting = done(jobs, job.id);
      jobs.stop(job.id);
      const view = await waiting;
      assert.equal(view.state, "cancelled");
      assert.equal(view.error, null);
      assert.equal(view.stderr, "");
      assert.equal(jobs.stop(job.id).state, "cancelled");
      const events = jobs.drainNotifications(1000).events;
      assert.equal(events.filter((event) => event.kind === "exit").length, 1);
      assert.equal(events.filter((event) => event.stream === "stderr").length, 0);
      if (pending) await until(() => "sockets" in peer && peer.sockets.size === 0);
      else await until(() => "wss" in peer && peer.wss.clients.size === 0);
    } finally {
      await jobs.close();
      await peer.close();
    }
  });
}

test("immediate stop before handshake disposes CONNECTING socket without synthetic errors", async () => {
  const peer = await httpPeer();
  const jobs = registry();
  try {
    const job = jobs.startWebSocket({ url: peer.url }, "immediate stop", 5000);
    jobs.stop(job.id);
    const view = await done(jobs, job.id);
    assert.equal(view.state, "cancelled");
    assert.equal(view.error, null);
    assert.equal(peer.upgrades, 0);
    assert.equal(jobs.drainNotifications().events.length, 1);
  } finally {
    await jobs.close();
    await peer.close();
  }
});

for (const pending of [false, true]) {
  test(`deadline terminates ${pending ? "pending handshake" : "open connection"} as timed_out`, async () => {
    const peer = pending ? await httpPeer() : await server();
    const jobs = registry();
    try {
      const job = jobs.startWebSocket({ url: peer.url }, "deadline", 500);
      const view = await done(jobs, job.id);
      assert.equal(view.state, "timed_out");
      assert.equal(view.error, null);
      assert.equal(view.stderr, "");
      assert.equal(jobs.runningCount, 0);
      const events = jobs.drainNotifications().events;
      assert.equal(events.filter((event) => event.kind === "exit").length, 1);
      assert.equal(events.at(-1)?.state, "timed_out");
      if (pending) await until(() => "sockets" in peer && peer.sockets.size === 0);
      else await until(() => "wss" in peer && peer.wss.clients.size === 0);
    } finally {
      await jobs.close();
      await peer.close();
    }
  });
}

for (const abort of [false, true]) {
  test(`registry ${abort ? "owner abort" : "close"} cleans open and connecting sockets and waiter state`, async () => {
    const peer = await server();
    const pending = await httpPeer();
    const owner = new AbortController();
    const jobs = registry({ signal: owner.signal });
    try {
      const opened = jobs.startWebSocket({ url: peer.url }, "open", 5000);
      const connecting = jobs.startWebSocket({ url: pending.url }, "connecting", 5000);
      await until(() => peer.wss.clients.size === 1 && pending.upgrades === 1);
      const waiting = [done(jobs, opened.id), done(jobs, connecting.id)];
      if (abort) owner.abort();
      const closing = jobs.close();
      assert.equal(jobs.close(), closing);
      const views = await Promise.all(waiting);
      await closing;
      assert.ok(views.every((view) => view.state === "cancelled" && view.error === null));
      assert.equal(jobs.runningCount, 0);
      assert.equal(jobs.drainNotifications().events.length, 0);
      assert.throws(() => jobs.snapshot(opened.id), /unknown background task/);
      assert.throws(() => jobs.startWebSocket({ url: peer.url }, "closed", 5000), /aborted/);
      await until(() => peer.wss.clients.size === 0 && pending.sockets.size === 0);
    } finally {
      await jobs.close();
      await peer.close();
      await pending.close();
    }
  });
}

test("waiting may abort without cancelling its WebSocket job", async () => {
  const peer = await server();
  const jobs = registry();
  try {
    const job = jobs.startWebSocket({ url: peer.url }, "wait", 5000);
    assert.equal((await jobs.waitFor(job.id, 10, signal())).state, "running");
    const caller = new AbortController();
    const waiting = jobs.waitFor(job.id, 5000, caller.signal);
    caller.abort();
    await assert.rejects(waiting, /aborted/);
    assert.equal(jobs.snapshot(job.id).state, "running");
    jobs.stop(job.id);
    assert.equal((await done(jobs, job.id)).state, "cancelled");
  } finally {
    await jobs.close();
    await peer.close();
  }
});

test("shell and WebSocket jobs share concurrency cap and free slots on settlement", async () => {
  const peer = await server();
  const jobs = registry({ maxRunningJobs: 1 });
  try {
    const ws = jobs.startWebSocket({ url: peer.url }, "ws", 5000);
    assert.throws(() => jobs.start("true", "shell", 5000, "run"), /too many running jobs/);
    assert.throws(() => jobs.startWebSocket({ url: peer.url }, "ws2", 5000), /too many running jobs/);
    jobs.stop(ws.id);
    await done(jobs, ws.id);
    const shell = jobs.start("true", "shell", 5000, "run");
    assert.throws(() => jobs.startWebSocket({ url: peer.url }, "ws3", 5000), /too many running jobs/);
    const view = await done(jobs, shell.id);
    assert.equal(view.state, "completed");
    assert.equal("source" in view, false);
    assert.equal("ws" in view, false);
    assert.equal("close_code" in view, false);
    const again = jobs.startWebSocket({ url: peer.url }, "ws4", 5000);
    jobs.stop(again.id);
    await done(jobs, again.id);
  } finally {
    await jobs.close();
    await peer.close();
  }
});

test("WebSocket finished jobs obey bounded history and isolate returned metadata", async () => {
  const peer = await server((socket) => socket.close(1000));
  const jobs = registry({ maxFinishedJobs: 1 });
  try {
    const options = { url: peer.url, protocols: ["events"] };
    const first = jobs.startWebSocket(options, "first", 5000);
    options.protocols.push("later");
    first.ws!.protocols!.push("descriptor edit");
    const view = await done(jobs, first.id);
    assert.deepEqual(view.ws?.protocols, ["events"]);
    view.ws!.protocols!.push("view edit");
    assert.deepEqual(jobs.snapshot(first.id).ws?.protocols, ["events"]);
    const second = jobs.startWebSocket({ url: peer.url }, "second", 5000);
    await done(jobs, second.id);
    assert.throws(() => jobs.snapshot(first.id), /unknown background task/);
    assert.equal(jobs.snapshot(second.id).state, "completed");
  } finally {
    await jobs.close();
    await peer.close();
  }
});

test("WS primitive and monitor validate URL, unique protocol tokens, deadline and strict XOR", async () => {
  const jobs = registry();
  try {
    const tool = monitor(jobs);
    for (const url of ["http://127.0.0.1", "ftp://127.0.0.1", "invalid", "ws://user:pass@127.0.0.1", "ws://@127.0.0.1", "ws://127.0.0.1/#", "ws://127.0.0.1/#fragment", " ws://127.0.0.1", "ws://127.0.0.1/\n", "ws://127.0.0.1/你"]) {
      assert.throws(() => jobs.startWebSocket({ url }, "bad", 5000));
      await assert.rejects(tool.execute({ ws: { url } }, context()));
    }
    for (const protocols of [[""], ["a b"], ["a,b"], ["a", "a"], ["你"], ["a\r\n"]]) {
      assert.throws(() => jobs.startWebSocket({ url: "ws://127.0.0.1", protocols }, "bad", 5000), /protocols/);
      await assert.rejects(tool.execute({ ws: { url: "ws://127.0.0.1", protocols } }, context()));
    }
    for (const deadline of [0, -1, NaN, Infinity, 1_800_001]) {
      assert.throws(() => jobs.startWebSocket({ url: "ws://127.0.0.1" }, "bad", deadline), /deadline/);
    }
    for (const input of [
      {}, { command: "true", ws: { url: "ws://127.0.0.1" } },
      { ws: { url: "ws://127.0.0.1", extra: true } },
      { ws: { url: "ws://127.0.0.1" }, extra: true },
      { ws: { url: "ws://127.0.0.1" }, timeout_ms: 1.1 },
      { ws: { url: "ws://127.0.0.1" }, description: "" },
    ]) await assert.rejects(tool.execute(input, context()));
    assert.equal(jobs.runningCount, 0);
  } finally {
    await jobs.close();
  }
});

test("monitor WebSocket is accessible with allowShell false; command remains gated", async () => {
  const peer = await server((socket) => socket.close(1000));
  const jobs = registry();
  try {
    const tool = monitor(jobs);
    await assert.rejects(tool.execute({ command: "true" }, context()), /allowShell is false/);
    const result = JSON.parse(await tool.execute({ ws: { url: peer.url } }, context()));
    assert.equal(result.source, "websocket");
    assert.equal(result.deadline_ms, 300_000);
    assert.equal((await done(jobs, result.id)).state, "completed");
  } finally {
    await jobs.close();
    await peer.close();
  }
});

test("preaborted caller and registry prevent any WebSocket connection", async () => {
  const peer = await httpPeer();
  const jobs = registry();
  const aborted = new AbortController();
  aborted.abort();
  const closed = registry({ signal: aborted.signal });
  try {
    await assert.rejects(monitor(jobs).execute({ ws: { url: peer.url } }, context({ signal: aborted.signal })), /aborted/);
    assert.throws(() => closed.startWebSocket({ url: peer.url }, "aborted", 5000), /aborted/);
    assert.equal(jobs.runningCount, 0);
    await pause(30);
    assert.equal(peer.upgrades, 0);
    assert.equal(peer.sockets.size, 0);
  } finally {
    await jobs.close();
    await closed.close();
    await peer.close();
  }
});

test("legacy opt-out preserves exact monitor schema/description and other tool definitions", async () => {
  const jobs = registry();
  try {
    const legacy = monitor(jobs, false);
    assert.equal(legacy.schema.description,
      "Start a shell command as a background job and stream its stdout lines " +
      "into the notification queue (read them with `read_notifications`). " +
      "stderr is not streamed; it stays readable as a tail via " +
      "`get_background_task`. Lines are batched and the queue is bounded by both " +
      "event count and bytes; over-long newline-free lines are emitted once with " +
      "a truncation marker, and evicted events are reported as `dropped`, never " +
      "silently. The job runs in its own process group. Deadline defaults to " +
      "300000ms, maximum 1800000ms. Requires `allowShell`.");
    assert.deepEqual(legacy.schema.input_schema, {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command line passed to `/bin/sh -c`." },
        description: { type: "string", description: "Short human label for the job." },
        timeout_ms: { type: "integer", minimum: 1, maximum: 1_800_000, description: "Deadline in milliseconds before the process group is killed." },
      },
      required: ["command"], additionalProperties: false,
    });
    await assert.rejects(legacy.execute({ ws: { url: "ws://127.0.0.1" } }, context({ allowShell: true })));
    await assert.rejects(legacy.execute({ command: "true", ws: { url: "ws://127.0.0.1" } }, context({ allowShell: true })));
    const descriptor = JSON.parse(await legacy.execute({ command: "true" }, context({ allowShell: true })));
    assert.equal((await done(jobs, descriptor.id)).state, "completed");
    const current = createBackgroundTools(jobs);
    const old = createBackgroundTools(jobs, { websocket: false });
    assert.deepEqual(current.filter((tool) => tool.schema.name !== "monitor").map((tool) => tool.schema), old.filter((tool) => tool.schema.name !== "monitor").map((tool) => tool.schema));
    const schema = monitor(jobs).schema.input_schema;
    assert.equal((schema.oneOf as unknown[]).length, 2);
    assert.ok(Object.hasOwn(schema.properties!, "ws"));
  } finally {
    await jobs.close();
  }
});
