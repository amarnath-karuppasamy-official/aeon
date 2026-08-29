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
