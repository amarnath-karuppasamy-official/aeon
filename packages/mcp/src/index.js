// @aeon-framework/mcp — an MCP server exposing Aeon's tooling (real code
// generation, docs search, curated conventions, project inspection, and
// the real-compiler-backed explain_template) to any MCP-speaking AI coding
// assistant. Comparable in spirit to Angular's `ng mcp`.
//
// Every tool's actual logic lives in a small, transport-free module (see
// generate-tools.js / docs-tools.js / conventions.js / inspect-project.js /
// explain-template.js) exported below so it's directly unit-testable
// without going through the MCP protocol at all. createServer() only wires
// those functions to MCP tool registrations + zod input schemas.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { generateComponentTool, generateServiceTool, generateRouteTool } from './generate-tools.js';
import { searchDocs } from './docs-tools.js';
import { getConventionsTool } from './conventions.js';
import { inspectProject } from './inspect-project.js';
import { explainTemplate } from './explain-template.js';

export { generateComponentTool, generateServiceTool, generateRouteTool, writeGenerated } from './generate-tools.js';
export { searchDocs, collectDocSources, findRepoRoot, findPackagesDir } from './docs-tools.js';
export { getConventionsTool, CONVENTIONS } from './conventions.js';
export { inspectProject } from './inspect-project.js';
export { explainTemplate, parseTemplateBody } from './explain-template.js';

function textResult(value) {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}

function errorResult(err) {
  return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
}

const generateInputShape = {
  name: z.string().describe('Name to scaffold, e.g. "UserProfile" or "user-profile".'),
  targetDir: z.string().describe('Project root to write into (same meaning as `aeon generate`\'s cwd).'),
  overwrite: z.boolean().optional().describe('Overwrite an existing file instead of refusing. Default false.'),
};

/** Build a fresh McpServer with every Aeon tool registered. Call server.connect(transport) to serve it. */
export function createServer() {
  const server = new McpServer(
    { name: 'aeon-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
    'generate_component',
    {
      title: 'Generate Aeon component',
      description:
        'Scaffold a real Aeon component file at src/components/<Name>.js in the given project, using @aeon-framework/cli\'s real generator (same output as `aeon generate component <Name>`). Writes to disk and returns the file path + content.',
      inputSchema: generateInputShape,
    },
    async (args) => {
      try {
        return textResult(generateComponentTool(args));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    'generate_service',
    {
      title: 'Generate Aeon service',
      description:
        'Scaffold a real Aeon DI service file at src/services/<name>.js in the given project, using @aeon-framework/cli\'s real generator (same output as `aeon generate service <Name>`). Writes to disk and returns the file path + content.',
      inputSchema: generateInputShape,
    },
    async (args) => {
      try {
        return textResult(generateServiceTool(args));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    'generate_route',
    {
      title: 'Generate Aeon route',
      description:
        'Scaffold a real Aeon route file at src/routes/<Name>.js in the given project, using @aeon-framework/cli\'s real generator (same output as `aeon generate route <Name>`). Writes to disk and returns the file path + content plus the route\'s exported table entry.',
      inputSchema: generateInputShape,
    },
    async (args) => {
      try {
        return textResult(generateRouteTool(args));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    'search_docs',
    {
      title: 'Search Aeon docs',
      description:
        'Case-insensitive search over Aeon\'s real README.md and every package\'s src/index.d.ts. Returns matched excerpts (with surrounding context) and which file each came from.',
      inputSchema: { query: z.string().describe('Search text, e.g. "signal", "createRouter", "keyed list".') },
    },
    async (args) => {
      try {
        return textResult(searchDocs(args));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    'get_conventions',
    {
      title: 'Get Aeon conventions',
      description:
        'Aeon\'s curated idioms: signals vs. virtual DOM, the four real template binding kinds, defineComponent/onMount/onCleanup, DI, router modes — plus real footguns (no ref= binding, no key= attribute pattern) an AI assistant trained on React/lit-html/Vue is likely to hit.',
      inputSchema: {},
    },
    async () => {
      try {
        return textResult(getConventionsTool().text);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    'inspect_project',
    {
      title: 'Inspect Aeon project',
      description:
        'Reads a real Aeon project on disk (never evaluates its code): which @aeon-framework/* packages it depends on, and a best-effort summary of src/routes, src/components, src/services.',
      inputSchema: { projectDir: z.string().describe('Absolute or relative path to the project root.') },
    },
    async (args) => {
      try {
        return textResult(inspectProject(args));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    'explain_template',
    {
      title: 'Explain Aeon template bindings',
      description:
        'Aeon\'s unique tool: feed the body of an html`...` template (using ${N} for each interpolation, numbered in order) and get back EXACTLY what Aeon\'s real compiler decides each binding is (attribute/property/event/boolean/node), by actually calling the real compiler — not a guess. Flags binding prefixes that look like other frameworks\' special syntax (ref=, key=) but are NOT real Aeon binding kinds in Aeon and silently become plain string attributes.',
      inputSchema: {
        template: z
          .string()
          .describe('The body between the backticks of an html`...` template, with ${N} for each interpolation slot in order, e.g. "<button ?disabled=${0} @click=${1}>${2}</button>".'),
      },
    },
    async (args) => {
      try {
        return textResult(await explainTemplate(args));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
