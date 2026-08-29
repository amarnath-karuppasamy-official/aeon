// Aeon SSR: renders a component/template to an HTML string by actually
// running the real client renderer (`mount()`/`render()` from
// @aeon-framework/core) against a headless Happy DOM document, then
// serializing the result. There is no separate/parallel string renderer —
// whatever `mount()`/`render()` do on the client is exactly what runs here,
// so SSR output can't drift from client behavior.
import { Window } from 'happy-dom';
import { mount, render } from '@aeon-framework/core';

// One Happy DOM window per process, installed lazily and reused — mirrors
// @aeon-framework/testing's setupDom(). This matters beyond convenience:
// Aeon's `<template>` compilation is cached per call-site (`html` tagged
// template) and that cached `<template>` element is bound to whichever
// `document` was active the first time that call site compiled. Creating a
// fresh Happy DOM window per call would make later calls compile a second,
// throwaway `<template>` against a *different* document than the one a
// same-process `hydrate()` test later inspects — reusing one window per
// process keeps template compilation, and therefore hydration's structural
// walk, consistent.
let installedWindow = null;

function ensureDom() {
  if (installedWindow) return;
  // A real origin, not Happy DOM's default `about:blank` — @aeon-framework/router's
  // navigate() drives window.history.pushState()/replaceState() to resolve a
  // route before renderToString() runs (the standard pattern for per-request
  // SSR routing: call router.navigate(req.url) then renderToString(App)).
  // history.pushState() throws a SecurityError against `about:blank`'s null
  // origin, so every consumer doing per-request SSR would otherwise have to
  // work around this the same way — fixed once, here, instead.
  const window = new Window({ url: 'http://localhost/' });
  installedWindow = window;
  globalThis.window = window;
  globalThis.document = window.document;
  for (const key of ['Node', 'Element', 'HTMLElement', 'Event', 'CustomEvent', 'MouseEvent']) {
    if (key in window) {
      try {
        globalThis[key] = window[key];
      } catch {
        // non-configurable in this Node version — safe to skip, SSR code
        // rarely references these constructors by name.
      }
    }
  }
}

/**
 * Render a component function (`(props) => html\`...\``) or an already-
 * evaluated template result (`html\`...\``) to an HTML string, using the
 * real client renderer against a headless Happy DOM document.
 *
 * Returns the HTML that would sit *inside* the element you'll eventually
 * call `hydrate()`/`hydrateComponent()` on — i.e. render this into your
 * server response's mount-point element's innerHTML.
 */
export function renderToString(vnodeOrComponentFn, props = {}) {
  ensureDom();
  const container = document.createElement('div');
  const dispose =
    typeof vnodeOrComponentFn === 'function'
      ? mount(vnodeOrComponentFn, container, props)
      : render(vnodeOrComponentFn, container);
  const html = container.innerHTML;
  dispose();
  return html;
}
