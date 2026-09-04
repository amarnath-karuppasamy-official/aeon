// Aeon renderer: tagged-template views compiled once, cloned cheaply, and patched
// directly by signals. No virtual DOM diffing, no re-render of unrelated nodes.
import { effect } from './signal.js';

const MARK = 'aeon';
// Matches a trailing `name=` (unquoted) or `name="` / `name='` (quoted, quote captured).
const attrBindRe = /([.?@a-zA-Z0-9_:-]+)=(["'])?$/;
const bindTokenRe = new RegExp(`^${MARK}:(\\d+)${MARK}$`);

const templateCache = new WeakMap();

/** Tag a literal template as reactive markup. Values that are functions are tracked. */
export function html(strings, ...values) {
  return { __aeonTemplate: true, strings, values };
}

function compile(strings) {
  let htmlString = '';
  for (let i = 0; i < strings.length; i++) {
    htmlString += strings[i];
    if (i < strings.length - 1) {
      const attrMatch = attrBindRe.exec(strings[i]);
      if (attrMatch) {
        // Quoted (`name="`) — the closing quote already lives in the next chunk.
        // Unquoted (`name=`) — wrap the marker in quotes ourselves so the HTML stays valid.
        htmlString += attrMatch[2] ? `${MARK}:${i}${MARK}` : `"${MARK}:${i}${MARK}"`;
      } else {
        htmlString += `<!--${MARK}:${i}${MARK}-->`;
      }
    }
  }
  const template = document.createElement('template');
  template.innerHTML = htmlString;

  // Walk the template ONCE to find every binding, recording a child-index
  // path to each rather than a live reference. Every future clone of this
  // template reaches its parts by following those paths directly — no
  // querySelectorAll/TreeWalker re-scan of the whole subtree per instance.
  // This also strips the placeholder bind attributes from the template's own
  // content permanently, so clones never carry them and never need a
  // per-instance removeAttribute pass either. This is the difference between
  // "cheap enough to clone 1,000 times a frame" and not.
  const partDescriptors = [];
  walkForParts(template.content, [], partDescriptors);
  return { template, partDescriptors };
}

function walkForParts(node, path, out) {
  if (node.nodeType === 1) {
    // Element: scan attributes once, stripping bind markers from the
    // template's own content so every clone is already clean.
    for (const attr of [...node.attributes]) {
      const m = bindTokenRe.exec(attr.value);
      if (!m) continue;
      let name = attr.name;
      let kind = 'attribute';
      if (name[0] === '@') { kind = 'event'; name = name.slice(1); }
      else if (name[0] === '.') { kind = 'property'; name = name.slice(1); }
      else if (name[0] === '?') { kind = 'boolean'; name = name.slice(1); }
      node.removeAttribute(attr.name);
      out.push({ path, index: Number(m[1]), kind, name });
    }
  } else if (node.nodeType === 8) {
    const m = bindTokenRe.exec(node.data);
    if (m) out.push({ path, index: Number(m[1]), kind: 'node' });
  }
  const children = node.childNodes;
  for (let i = 0; i < children.length; i++) walkForParts(children[i], [...path, i], out);
}

function getNodeAtPath(root, path) {
  let node = root;
  for (const i of path) node = node.childNodes[i];
  return node;
}

function getTemplate(strings) {
  let info = templateCache.get(strings);
  if (!info) {
    info = compile(strings);
    templateCache.set(strings, info);
  }
  return info;
}

class AttrPart {
  constructor(el, name, kind) {
    this.el = el;
    this.name = name;
    this.kind = kind;
    this._listener = null;
  }
  update(value) {
    if (this.kind === 'event') {
      if (this._listener) this.el.removeEventListener(this.name, this._listener);
      this._listener = typeof value === 'function' ? value : null;
      if (this._listener) this.el.addEventListener(this.name, this._listener);
    } else if (this.kind === 'property') {
      this.el[this.name] = value;
    } else if (this.kind === 'boolean') {
      this.el.toggleAttribute(this.name, !!value);
    } else {
      if (value == null || value === false) this.el.removeAttribute(this.name);
      else this.el.setAttribute(this.name, value === true ? '' : String(value));
    }
  }
}

class NodePart {
  constructor(anchor) {
    this.anchor = anchor;
    this.nodes = [];
    this.nestedDisposers = [];
    this.listState = null;
  }
  clear() {
    this._clearList();
    for (const d of this.nestedDisposers) d();
    this.nestedDisposers = [];
    for (const n of this.nodes) n.remove();
    this.nodes = [];
  }
  _clearList() {
    if (!this.listState) return;
    for (const entry of this.listState.values()) {
      for (const d of entry.disposers) d();
      for (const n of entry.nodes) n.remove();
    }
    this.listState = null;
  }
  update(value) {
    if (value && value.__aeonList) {
      this._updateList(value);
      return;
    }
    this._clearList();
    this.clear();
    const frag = document.createDocumentFragment();
    this._renderInto(frag, value);
    this.nodes = Array.from(frag.childNodes);
    this.anchor.parentNode.insertBefore(frag, this.anchor);
  }
  /**
   * Keyed reconciliation: reuses and repositions existing DOM/effects instead
   * of rebuilding the list. A row is repositioned only (no work beyond a
   * possible DOM move) when its item is reference-identical to last render —
   * true for every untouched row after `array.map(...)`-style updates, since
   * `.map` only allocates new objects for the entries that actually changed.
   * A key whose item reference DID change is remounted in place; unrelated
   * rows never pay for it. This is what makes `${() => list(...)}` fine-
   * grained rather than "diff the whole list every time."
   */
  _updateList({ itemsFn, keyFn, renderFn }) {
    const items = itemsFn();
    const keys = items.map((item, i) => (keyFn ? keyFn(item, i) : i));
    const keySet = new Set(keys);
    const prevState = this.listState || new Map();
    const nextState = new Map();

    for (const [key, entry] of prevState) {
      if (!keySet.has(key)) {
        for (const d of entry.disposers) d();
        for (const n of entry.nodes) n.remove();
      }
    }

    // Every row (repositioned or newly mounted) is appended into one detached
    // fragment first, then the whole list is inserted with a single
    // insertBefore. Moving an existing node into `batch` implicitly removes
    // it from its old position, so this handles reordering too — the point
    // is to pay for exactly one DOM mutation for the whole list instead of
    // one per row, which is what actually costs on a 1,000-row create.
    const batch = document.createDocumentFragment();
    for (let i = 0; i < items.length; i++) {
      const key = keys[i];
      const item = items[i];
      let entry = prevState.get(key);
      if (entry && entry.item === item) {
        for (const n of entry.nodes) batch.appendChild(n);
      } else {
        if (entry) {
          for (const d of entry.disposers) d();
          for (const n of entry.nodes) n.remove();
        }
        const disposers = [];
        const { fragment } = mount(renderFn(item, i), disposers);
        entry = { nodes: Array.from(fragment.childNodes), disposers, item };
        batch.appendChild(fragment);
      }
      nextState.set(key, entry);
    }

    this.anchor.parentNode.insertBefore(batch, this.anchor);
    this.listState = nextState;
  }
  _renderInto(frag, value) {
    if (value == null || value === false) return;
    if (Array.isArray(value)) {
      for (const v of value) this._renderInto(frag, v);
      return;
    }
    if (value && value.__aeonTemplate) {
      const { fragment } = mount(value, this.nestedDisposers);
      frag.appendChild(fragment);
      return;
    }
    if (value instanceof Node) {
      frag.appendChild(value);
      return;
    }
    frag.appendChild(document.createTextNode(String(value)));
  }
}

function instantiate(info) {
  const fragment = info.template.content.cloneNode(true);
  const parts = info.partDescriptors.map(({ path, index, kind, name }) => {
    const node = getNodeAtPath(fragment, path);
    const part = kind === 'node' ? new NodePart(node) : new AttrPart(node, name, kind);
    return { index, part };
  });
  return { fragment, parts };
}

/** Mount a template result into a detached fragment, wiring reactive bindings. */
function mount(result, disposers) {
  const info = getTemplate(result.strings);
  const { fragment, parts } = instantiate(info);
  for (const { index, part } of parts) {
    const raw = result.values[index];
    // Event handlers are bound as-is: the function IS the value, not a reactive
    // getter to invoke. Every other binding treats a function as "recompute me
    // whenever a signal inside changes."
    if (part instanceof AttrPart && part.kind === 'event') {
      part.update(raw);
    } else if (typeof raw === 'function') {
      disposers.push(effect(() => part.update(raw())));
    } else {
      part.update(raw);
    }
  }
  return { fragment, parts };
}

// ---------------------------------------------------------------------------
// Hydration: adopt server-rendered DOM instead of clearing + re-rendering.
//
// The comment markers `<!--aeon:N aeon-->` that `compile()` emits for every
// node-kind binding are never stripped or mutated by the renderer (only
// bind *attributes* get stripped, from the cached `<template>`, on first
// compile) — so the exact same marker text survives serialization to an
// HTML string and back through the parser. Hydration exploits that: it walks
// the *compiled template* (which still has those markers, plus the original
// child-index structure `walkForParts` used to record every binding's path)
// in lockstep with the *live, already-populated* DOM tree, using each
// marker comment as a resync point. Whatever nodes sit between two markers
// in the live tree are the previous render's actual output for that part —
// they're adopted by reference (assigned into the NodePart, never recreated)
// rather than thrown away and rebuilt.
//
// Known, disclosed limitation: a `list()`-bound region cannot be hydrated
// incrementally with this scheme (there is no per-row marker to key off of,
// only whatever the row templates themselves render), so hydrating a list
// falls back to clearing the server-rendered rows and doing one normal
// client-side `list()` render in their place — a one-time flash limited to
// list regions. Everything else (attributes, properties, event listeners,
// plain text/element node content, and even nested `html` templates used as
// node-part values) hydrates without recreating a single DOM node.
// ---------------------------------------------------------------------------

function buildDescriptorMap(partDescriptors) {
  const map = new Map();
  for (const d of partDescriptors) {
    const key = d.path.join('.');
    let arr = map.get(key);
    if (!arr) map.set(key, (arr = []));
    arr.push(d);
  }
  return map;
}

/**
 * Walk the compiled template's static structure and the live DOM in
 * lockstep, resolving each binding to its real DOM counterpart. `lParent`
 * only needs to expose `childNodes` (a real Node, or `{ childNodes: [...] }`
 * for the synthetic "children of a node-part" case used when recursing into
 * an adopted nested template).
 */
function hydrateChildren(tParent, lParent, path, descByPath, bindings) {
  const tChildren = tParent.childNodes;
  let li = 0;
  for (let ti = 0; ti < tChildren.length; ti++) {
    const tChild = tChildren[ti];
    const curPath = [...path, ti];

    if (tChild.nodeType === 8) {
      const m = bindTokenRe.exec(tChild.data);
      if (m) {
        // Node-part anchor: everything in the live tree from here up to (not
        // including) the matching marker comment is this part's prior output.
        const contentNodes = [];
        let lc = lParent.childNodes[li];
        while (lc && !(lc.nodeType === 8 && lc.data === tChild.data)) {
          contentNodes.push(lc);
          li++;
          lc = lParent.childNodes[li];
        }
        bindings.push({ path: curPath, index: Number(m[1]), kind: 'node', anchorLive: lc, contentNodes });
        if (lc) li++; // step past the anchor itself
        continue;
      }
    }

    if (tChild.nodeType === 1) {
      const lChild = lParent.childNodes[li];
      const descs = descByPath.get(curPath.join('.'));
      if (descs && lChild) for (const d of descs) bindings.push({ ...d, domNode: lChild });
      if (lChild) hydrateChildren(tChild, lChild, curPath, descByPath, bindings);
      li++;
      continue;
    }

    // Static text or a plain (non-binding) comment: one live node consumed, no binding.
    li++;
  }
}

/** Adopt (or, for lists, fall back to freshly rendering) a node-part's initial value. */
function adoptNodePart(part, value, contentNodes) {
  if (value && value.__aeonList) {
    // Documented list-hydration limitation: no stable per-row hydration
    // anchors exist yet, so drop the server-rendered rows and do one normal
    // client render — a disclosed, one-time flash for this region only.
    for (const n of contentNodes) n.remove();
    part.update(value);
    return;
  }
  if (value && value.__aeonTemplate) {
    // Nested template (e.g. `${() => cond() ? html`<b>A</b>` : html`<i>B</i>`}`):
    // recurse the same lockstep walk against its own compiled structure so
    // ITS bindings (including event listeners) get wired up without
    // recreating any of these nodes either.
    part.nodes = contentNodes;
    hydrateInto(value, { childNodes: contentNodes }, part.nestedDisposers);
    return;
  }
  if (Array.isArray(value) || value instanceof Node) {
    // Mixed arrays / raw Node values aren't given per-item markers either;
    // same disclosed fallback as list().
    for (const n of contentNodes) n.remove();
    part.update(value);
    return;
  }
  // Plain text/number/etc: the server already rendered the right text node(s) — adopt as-is.
  part.nodes = contentNodes;
}

function hydrateInto(result, parentLike, disposers) {
  const info = getTemplate(result.strings);
  const descByPath = buildDescriptorMap(info.partDescriptors);
  const bindings = [];
  hydrateChildren(info.template.content, parentLike, [], descByPath, bindings);

  for (const b of bindings) {
    const raw = result.values[b.index];
    if (b.kind === 'node') {
      if (!b.anchorLive) continue; // malformed/truncated markup — nothing safe to hydrate here
      const part = new NodePart(b.anchorLive);
      if (typeof raw === 'function') {
        let first = true;
        disposers.push(
          effect(() => {
            const v = raw();
            if (first) {
              first = false;
              adoptNodePart(part, v, b.contentNodes);
            } else {
              part.update(v);
            }
          })
        );
      } else {
        adoptNodePart(part, raw, b.contentNodes);
      }
    } else {
      const part = new AttrPart(b.domNode, b.name, b.kind);
      if (part.kind === 'event') {
        // Server-rendered markup can never carry listeners — always attach.
        part.update(raw);
      } else if (typeof raw === 'function') {
        disposers.push(effect(() => part.update(raw())));
      } else {
        part.update(raw);
      }
    }
  }
}

/**
 * Adopt existing server-rendered DOM under `container` instead of clearing
 * and re-rendering it. `result` is an Aeon template result (the return
 * value of `html\`...\``, or a component function's return value) that
 * describes the SAME markup `container` was already populated with (e.g. by
 * `@aeon-framework/ssr`'s `renderToString`). Returns a dispose function,
 * same contract as `render()`.
 *
 * See the block comment above for the exact adoption rules and the
 * list-hydration flash limitation.
 */
export function hydrate(result, container) {
  const disposers = [];
  hydrateInto(result, container, disposers);
  return () => {
    for (const d of disposers) d();
    container.textContent = '';
  };
}

/** Render a template result into a container element. Returns a dispose function. */
export function render(result, container) {
  const disposers = [];
  container.textContent = '';
  const { fragment } = mount(result, disposers);
  container.appendChild(fragment);
  return () => {
    for (const d of disposers) d();
    container.textContent = '';
  };
}

/**
 * Keyed reactive list. Wrap in a binding function so it re-runs on change:
 *   ${() => list(() => todos.value, t => t.id, t => html`<li>${t.text}</li>`)}
 * Existing rows are repositioned, not rebuilt, when order changes.
 */
export function list(itemsFn, keyFn, renderFn) {
  return { __aeonList: true, itemsFn, keyFn, renderFn };
}

// ---------------------------------------------------------------------------
// Internal-only re-export — NOT part of @aeon-framework/core's public API.
// index.js (the package's "." export) deliberately does not re-export this,
// so nothing about core's public contract changes. It exists solely so
// tooling that needs the REAL binding-kind classification a template
// compiles to — e.g. @aeon-framework/mcp's explain_template tool — can call
// the actual compiler function itself (deep import of this file) instead of
// re-implementing/guessing at its regex/attribute-prefix rules elsewhere,
// which would drift the moment this file changes.
// ---------------------------------------------------------------------------
export { compile as __internal_compile };
