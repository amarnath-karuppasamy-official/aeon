#!/usr/bin/env node
// Launches the Aeon MCP server over stdio — the standard way an AI coding
// assistant (Claude Code, etc.) spawns an MCP server from its config, e.g.
//   { "command": "npx", "args": ["-y", "@aeon-framework/mcp"] }
// or, once installed globally / as a project devDependency:
//   { "command": "aeon-mcp" }
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from '../src/index.js';

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
