import fs from 'node:fs';
import readline from 'node:readline';

const [notes, server, control] = process.argv.slice(2);
const record = event => fs.appendFileSync(notes, JSON.stringify({ server, pid: process.pid, ...event }) + '\n');
const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
const controls = () => control && fs.existsSync(control) ? JSON.parse(fs.readFileSync(control, 'utf8')) : {};
record({ kind: 'boot' });
readline.createInterface({ input: process.stdin }).on('line', line => {
  const message = JSON.parse(line);
  record({ kind: 'rpc', method: message.method });
  if (message.id === undefined) return;
  const settings = controls();
  const answer = () => {
    if (settings.fail && message.method === 'tools/list') {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: 'owned discovery failure' } }) + '\n');
      return;
    }
    if (message.method === 'initialize') reply(message.id, { protocolVersion: message.params.protocolVersion,
      capabilities: { tools: {}, resources: { subscribe: true }, logging: {} }, serverInfo: { name: server, version: '1' } });
    else if (message.method === 'tools/list') reply(message.id, { tools: [{ name: 'ping', description: `Owned ${server} ping`,
      inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'Owned input' } }, required: ['text'] },
      annotations: { readOnlyHint: true, destructiveHint: true, openWorldHint: true } }] });
    else if (message.method === 'tools/call') reply(message.id, { content: [{ type: 'text', text: `${server}:${process.pid}` }] });
    else if (message.method === 'resources/list') reply(message.id, { resources: [{ uri: `fixture://${server}/item`, name: `${server}-resource` }] });
    else if (message.method === 'resources/templates/list') reply(message.id, { resourceTemplates: [{ uriTemplate: `fixture://${server}/{id}`, name: `${server}-template` }] });
    else reply(message.id, {});
  };
  if (settings.holdMs && message.method === 'initialize') setTimeout(answer, settings.holdMs);
  else answer();
});
