// precompileTemplate() — AOT milestone 2's actual optimization primitive.
//
// Runs Aeon's REAL runtime compiler (@aeon-framework/core's dom.js
// `compile()`, deep-imported as `__internal_compile` — see dom.js's bottom
// comment) against a template's `strings` chunks at BUILD time, so
// `esbuild-plugin.js` can attach the result to the call site and let
// core's `getTemplate()` skip the `walkForParts()` tree-walk at runtime
// (see dom.js's "AOT fast path" comment on `getTemplate`). This module
// does not reimplement or approximate that walk in any way — it calls the
// exact same function the browser would otherwise call on first render,
// just earlier, on the build machine, against a throwaway happy-dom
// document instead of a real one. That's the whole trick, and the whole
// honest scope: the DOM `<template>` element itself is still created and
// its `innerHTML` still parsed at runtime by every clone — this only moves
// the ONE tree-walk that finds bindings, which used to happen on the first
// real render and now happens at build time instead.
//
// Same relative-import trick @aeon-framework/mcp's explain-template.js
// uses to reach core/src/dom.js, for the same reason (core's package.json
// "exports" map whitelists only ".", so a bare `@aeon-framework/core/src/dom.js`
// specifier is rejected by Node's package-exports enforcement even though
// the file really exists on disk).
import { Window } from 'happy-dom';

let compileFn = null;
let domReady = false;

function ensureDom() {
  if (domReady) return;
  const window = new Window({ url: 'http://localhost/' });
  globalThis.window = window;
  globalThis.document = window.document;
  domReady = true;
}

async function loadCompile() {
  if (compileFn) return compileFn;
  const candidates = [
    '../../core/src/dom.js', // workspace checkout: packages/compiler/src -> packages/core/src
    '@aeon-framework/core/src/dom.js', // in case a future core exports map whitelists this
  ];
  let lastErr;
  for (const spec of candidates) {
    try {
      const mod = await import(spec);
      if (typeof mod.__internal_compile === 'function') {
        compileFn = mod.__internal_compile;
        return compileFn;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(
    `precompileTemplate could not load @aeon-framework/core's internal compile() — ` +
      `tried: ${candidates.join(', ')}. Last error: ${lastErr && lastErr.message}`
  );
}

/**
 * Precompile a tagged-template's `strings` chunks (the cooked chunk array a
 * real `html`...`` ` call site's `strings` argument holds — `compile()`
 * never reads `.raw`, so a plain array of cooked strings is sufficient; no
 * TemplateStringsArray needs to be fabricated) into the `{ html, parts }`
 * shape core's `getTemplate()` fast path expects.
 *
 * `html` is `template.innerHTML` AFTER `compile()` has stripped every bind
 * marker attribute from the template's own content (exactly what a clone at
 * runtime would see). `parts` is the real `partDescriptors` array
 * `walkForParts()` produced — not a guess, not a second implementation of
 * the attribute-prefix rules.
 *
 * @param {string[]} quasis - cooked template-literal chunks, in source order.
 * @returns {Promise<{ html: string, parts: Array<{path:number[], index:number, kind:string, name?:string}> }>}
 */
export async function precompileTemplate(quasis) {
  if (!Array.isArray(quasis) || quasis.length === 0) {
    throw new Error('precompileTemplate(quasis) requires a non-empty array of cooked template chunks.');
  }
  ensureDom();
  const compile = await loadCompile();
  const { template, partDescriptors } = compile(quasis);
  return { html: template.innerHTML, parts: partDescriptors };
}
