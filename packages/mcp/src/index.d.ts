// Type declarations for @aeon-framework/mcp. Hand-written to match
// src/*.js — keep in sync by hand when the JS API changes.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/** Build a fresh MCP server with every Aeon tool registered. Call
 * `server.connect(transport)` (e.g. a StdioServerTransport) to serve it —
 * see bin/aeon-mcp.mjs for the standard stdio launcher. */
export function createServer(): McpServer;

export interface GenerateArgs {
  name: string;
  targetDir: string;
  overwrite?: boolean;
}

export interface GenerateResult {
  path: string;
  relativePath: string;
  content: string;
  name: string;
}

/** Scaffold `kind` ('component' | 'service' | 'route') to disk using
 * @aeon-framework/cli's real generator. Throws if the destination already
 * exists (unless `opts.overwrite`). */
export function writeGenerated(
  kind: 'component' | 'service' | 'route',
  name: string,
  targetDir: string,
  opts?: { overwrite?: boolean }
): GenerateResult;

export function generateComponentTool(args: GenerateArgs): GenerateResult;
export function generateServiceTool(args: GenerateArgs): GenerateResult;
export function generateRouteTool(args: GenerateArgs): GenerateResult;

export interface DocMatch {
  line: number;
  excerpt: string;
}

export interface DocSearchFileResult {
  file: string;
  matchCount: number;
  matches: DocMatch[];
}

export interface DocSearchResult {
  query: string;
  results: DocSearchFileResult[];
}

export interface DocSource {
  file: string;
  content: string;
}

/** Case-insensitive substring search over README.md + every package's src/index.d.ts. */
export function searchDocs(args: { query: string }, opts?: { sources?: DocSource[]; startDir?: string }): DocSearchResult;
export function collectDocSources(startDir?: string): DocSource[];
export function findRepoRoot(startDir?: string): string | null;
export function findPackagesDir(startDir?: string): string | null;

/** Aeon's curated conventions/idioms as a single Markdown-ish string. */
export const CONVENTIONS: string;
export function getConventionsTool(): { text: string };

export interface RouteScrape {
  file: string;
  routePath: string | null;
  exportName: string | null;
}

export interface AeonPackageDependency {
  name: string;
  version: string;
  via: 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies';
}

export interface InspectProjectResult {
  projectDir: string;
  projectName: string | null;
  aeonPackages: AeonPackageDependency[];
  routes: RouteScrape[];
  components: string[];
  services: string[];
}

/** Reads a real project on disk (never evaluates its code). */
export function inspectProject(args: { projectDir: string }): InspectProjectResult;

export type BindingKind = 'attribute' | 'property' | 'event' | 'boolean' | 'node';

export interface ExplainedBinding {
  slot: number;
  kind: BindingKind | null;
  name: string | null;
  note: string | null;
  /** Set (and prefixed "NOT a real Aeon binding kind: ...") when this
   * attribute name looks like another framework's special binding syntax
   * (ref=, key=, ...) that Aeon does not actually support. */
  warning: string | null;
}

export interface ExplainTemplateResult {
  template: string;
  slotCount: number;
  bindings: ExplainedBinding[];
}

/** Feed the body of an html`...` template (${N} placeholders, in order) and
 * get back exactly what Aeon's real compiler decides each binding is. */
export function explainTemplate(args: { template: string }): Promise<ExplainTemplateResult>;
export function parseTemplateBody(template: string): { strings: string[]; slotOrder: number[] };
