// Real, genuine end-to-end proof: spawns the actual `aeon-mcp` stdio
// server binary as a child process and talks to it with the MCP SDK's own
// Client, over the real stdio transport — not the tool functions called
// directly in-process (that's what the other test files do). This is the
// one test that proves the server actually starts and speaks MCP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(__dirname, '../bin/aeon-mcp.mjs');

async function withConnectedClient(fn) {
  const client = new Client({ name: 'aeon-mcp-test-client', version: '0.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [binPath] });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

test('aeon-mcp stdio server starts and responds to a real tools/list request', async () => {
  await withConnectedClient(async (client) => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'explain_template',
      'generate_component',
      'generate_route',
      'generate_service',
      'get_conventions',
      'inspect_project',
      'search_docs',
    ]);
    const explain = tools.find((t) => t.name === 'explain_template');
    assert.match(explain.description, /real compiler/);
  });
});

test('aeon-mcp stdio server actually executes explain_template via tools/call and flags ref=', async () => {
  await withConnectedClient(async (client) => {
    const result = await client.callTool({
      name: 'explain_template',
      arguments: { template: '<div ref=${0} @click=${1}></div>' },
    });
    assert.equal(result.isError, undefined);
    const text = result.content[0].text;
    const parsed = JSON.parse(text);
    assert.equal(parsed.bindings[0].kind, 'attribute');
    assert.equal(parsed.bindings[0].name, 'ref');
    assert.match(parsed.bindings[0].warning, /^NOT a real Aeon binding kind/);
    assert.equal(parsed.bindings[1].kind, 'event');
  });
});

test('aeon-mcp stdio server actually executes get_conventions via tools/call', async () => {
  await withConnectedClient(async (client) => {
    const result = await client.callTool({ name: 'get_conventions', arguments: {} });
    const text = result.content[0].text;
    assert.match(text, /no `ref=` binding/);
    assert.match(text, /list\(itemsFn, keyFn, renderFn\)/);
  });
});
