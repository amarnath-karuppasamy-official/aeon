// aeonPrecompile() — the esbuild plugin that wires AOT milestone 2 into
// `aeon build` (see packages/cli/bin/aeon.mjs's `build()`, and this
// package's README section "Compile-time optimization (AOT milestone 2)").
//
// What it does, precisely: for every `html`...`` ` tagged-template call site
// in the APP'S OWN source (never node_modules, never the framework itself),
// it runs the real compiler (precompileTemplate(), which itself calls
// @aeon-framework/core's actual `compile()` — see precompile.js) once, at
// build time, and rewrites the call site so the strings array already
// carries the result as `__aeonPrecompiled`. Core's `getTemplate()` then
// skips `walkForParts()`'s tree-walk at runtime for that template shape
// (see dom.js). That is the entire optimization: one tree-walk per unique
// template shape moves from "the user's browser, on first render" to "the
// build machine." It does NOT:
//   - skip creating/parsing the `<template>` element or cloning it — that
//     still happens on every render, exactly as before.
//   - do any whole-program dead-code elimination or otherwise change what
//     code ships — only the one call site's arguments change shape.
//   - touch `aeon dev` — the CLI wires this plugin into the production
//     `build()` path only.
//
// Safety posture: this plugin must never be the reason a build that would
// otherwise succeed fails. Every failure mode below deliberately degrades
// to "leave that part of the source untouched, let esbuild load it
// normally" rather than throwing out of onLoad.
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import esbuild from 'esbuild';
import { precompileTemplate } from './precompile.js';

const LOADER_BY_EXT = { '.js': 'js', '.mjs': 'js', '.jsx': 'jsx', '.ts': 'ts', '.tsx': 'tsx' };

/**
 * Minimal generic AST walker: calls `visitors[node.type]` (if present) for
 * every node reachable from `root`, in document order. Good enough for the
 * two narrow lookups this plugin needs (import declarations, tagged
 * template expressions) without pulling in acorn-walk for something this
 * small.
 */
function walk(node, visitors) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visitors);
    return;
  }
  if (typeof node.type === 'string') {
    const visit = visitors[node.type];
    if (visit) visit(node);
  }
  for (const key in node) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range' || key === 'parent') continue;
    const value = node[key];
    if (value && typeof value === 'object') walk(value, visitors);
  }
}

/**
 * Find the local binding name `html` is imported as from
 * `@aeon-framework/core` (handling `import { html as h } from ...`
 * aliasing), or null if the file doesn't import it that way at all.
 */
function findLocalHtmlName(ast) {
  let localName = null;
  walk(ast, {
    ImportDeclaration(node) {
      if (node.source.value !== '@aeon-framework/core') return;
      for (const spec of node.specifiers) {
        if (spec.type === 'ImportSpecifier' && spec.imported && spec.imported.name === 'html') {
          localName = spec.local.name;
        }
      }
    },
  });
  return localName;
}

/** Every `TaggedTemplateExpression` tagged with exactly `localName` (a bare identifier, never a member expression). */
function findHtmlCalls(ast, localName) {
  const matches = [];
  walk(ast, {
    TaggedTemplateExpression(node) {
      if (node.tag.type === 'Identifier' && node.tag.name === localName) matches.push(node);
    },
  });
  return matches;
}

/**
 * Rewrite one file's source. Returns `{ contents, loader }` when at least
 * one template was precompiled, or `undefined` to let esbuild load the file
 * exactly as it would have without this plugin (no import to precompile,
 * import present but never called, nothing precompilable, or any error
 * along the way).
 */
async function precompileFile(filePath, source) {
  // Fast bail: the overwhelming common case is a file with nothing to do
  // with Aeon's `html` at all — skip parsing/transforming it entirely.
  if (!source.includes('@aeon-framework/core')) return undefined;

  const ext = path.extname(filePath);
  const loader = LOADER_BY_EXT[ext];
  if (!loader) return undefined;

  // .ts/.tsx always need type-stripping before a plain-JS parser can read
  // them. .jsx is transformed too — Aeon apps can mix JSX-based interop
  // components (@aeon-framework/interop) with `html`-template components in
  // the same project, so a .jsx file importing @aeon-framework/core's
  // `html` for one component while another export in the same file uses
  // JSX is a real (if uncommon) shape worth handling correctly rather than
  // silently skipping. Plain .js/.mjs need no transform — use the source
  // as-is so line/column offsets used for splicing stay simple.
  let code = source;
  if (ext === '.ts' || ext === '.tsx' || ext === '.jsx') {
    const result = esbuild.transformSync(source, { loader, format: 'esm', target: 'esnext' });
    code = result.code;
  }

  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  } catch {
    // Something acorn can't parse (exotic/future syntax, a stage-proposal
    // feature, etc.) — never our problem to solve; let esbuild's own
    // (more permissive) parser handle the file normally.
    return undefined;
  }

  const localHtmlName = findLocalHtmlName(ast);
  if (!localHtmlName) return undefined; // no `html` import from @aeon-framework/core — never guess at a same-named identifier

  const calls = findHtmlCalls(ast, localHtmlName);
  if (calls.length === 0) return undefined;

  const edits = [];
  for (const node of calls) {
    const quasis = node.quasi.quasis.map((q) => q.value.cooked);
    let precompiled;
    try {
      precompiled = await precompileTemplate(quasis);
    } catch (err) {
      // One malformed/unhandleable template must never fail the whole
      // file or the whole build — skip just this call site.
      console.warn(
        `[aeon-precompile] ${filePath}: could not precompile a template (left unoptimized): ${err && err.message}`
      );
      continue;
    }
    const exprsSource = node.quasi.expressions.map((expr) => code.slice(expr.start, expr.end));
    const stringsLiteral = `Object.assign(${JSON.stringify(quasis)}, { __aeonPrecompiled: ${JSON.stringify(precompiled)} })`;
    const callArgs = [stringsLiteral, ...exprsSource].join(', ');
    edits.push({ start: node.start, end: node.end, replacement: `${localHtmlName}(${callArgs})` });
  }
  if (edits.length === 0) return undefined;

  // Apply in reverse source order (highest `start` first) so splicing one
  // edit never invalidates the recorded offsets of an earlier one — proven
  // correct by esbuild-plugin.test.mjs's two-templates-in-one-file case.
  edits.sort((a, b) => b.start - a.start);
  let rewritten = code;
  for (const { start, end, replacement } of edits) {
    rewritten = rewritten.slice(0, start) + replacement + rewritten.slice(end);
  }
  return { contents: rewritten, loader: 'js' };
}

/**
 * The esbuild plugin itself. Intended for `aeon build`'s production client
 * bundle only (see packages/cli/bin/aeon.mjs) — never `aeon dev`.
 */
export function aeonPrecompile() {
  return {
    name: 'aeon-precompile',
    setup(build) {
      build.onLoad({ filter: /\.(js|jsx|ts|tsx|mjs)$/ }, async (args) => {
        // Only ever touches the app's own source — the framework's own
        // packages and any third-party dependency are never rewritten.
        if (args.path.includes('node_modules')) return undefined;
        try {
          const source = fs.readFileSync(args.path, 'utf8');
          const result = await precompileFile(args.path, source);
          return result || undefined;
        } catch (err) {
          // This plugin must never be able to break a build that would
          // otherwise succeed — any unexpected error here just means this
          // one file loads through esbuild's normal (unoptimized) path.
          console.warn(`[aeon-precompile] skipping ${args.path}: ${err && err.message}`);
          return undefined;
        }
      });
    },
  };
}
