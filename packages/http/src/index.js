// Aeon HTTP: fetch wrapped in signals instead of Angular's Observable-based
// HttpClient. Two primitives cover the two shapes of network calls:
//   resource() — reactive GET-like data tied to a source signal. Re-fetches
//                whenever the source changes; stale in-flight requests are
//                aborted so a slow first response can never overwrite a
//                faster later one.
//   mutation() — an imperative action (POST/PUT/DELETE, form submit, button
//                click) with the same {data, error, loading} signal shape,
//                triggered by calling run(...args) rather than reactively.
// Both are built on the plain `http.*` fetch helpers below, which you can
// use directly with no signals involved at all.
import { signal, effect, onCleanup } from '@aeon-framework/core';

export class HttpError extends Error {
  constructor(status, statusText, body) {
    super(`HTTP ${status} ${statusText}`);
    this.name = 'HttpError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

async function parseBody(res) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  const text = await res.text();
  return text.length ? text : null;
}

async function doFetch(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let body = null;
    try {
      body = await parseBody(res);
    } catch {
      // response had no readable body — leave it null
    }
    throw new HttpError(res.status, res.statusText, body);
  }
  return parseBody(res);
}

function withJsonBody(method) {
  return (url, body, opts = {}) =>
    doFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      ...opts,
    });
}

/** Plain fetch helpers — no signals, just promises. Use these directly for
 * one-off calls, or as the building blocks resource()/mutation() wrap. */
export const http = {
  get: (url, opts = {}) => doFetch(url, { method: 'GET', ...opts }),
  del: (url, opts = {}) => doFetch(url, { method: 'DELETE', ...opts }),
  post: withJsonBody('POST'),
  put: withJsonBody('PUT'),
  patch: withJsonBody('PATCH'),
};

/**
 * Reactive data tied to a source. Re-runs `fetcher` whenever a signal read
 * inside `sourceFn` changes; a source of `null`/`undefined`/`false` skips
 * fetching entirely (the standard "don't fetch until we have an id" guard).
 * A request superseded by a newer one (source changed again, or refetch()
 * called again before it resolved) is aborted and its result discarded, so
 * `data` never flickers back to a stale value.
 *
 * Call inside a component function so cleanup (aborting an in-flight
 * request on unmount) is wired automatically; call `dispose()` yourself if
 * you construct one outside a component.
 */
export function resource(sourceFn, fetcher) {
  const data = signal(undefined);
  const error = signal(undefined);
  const loading = signal(false);
  let controller = null;
  let callId = 0;

  function run() {
    const source = sourceFn();
    if (source == null || source === false) {
      if (controller) controller.abort();
      data.value = undefined;
      error.value = undefined;
      loading.value = false;
      return;
    }
    if (controller) controller.abort();
    controller = new AbortController();
    const id = ++callId;
    loading.value = true;
    error.value = undefined;
    Promise.resolve(fetcher(source, { signal: controller.signal }))
      .then((result) => {
        if (id !== callId) return; // superseded — ignore
        data.value = result;
        loading.value = false;
      })
      .catch((err) => {
        if (id !== callId) return;
        if (err && err.name === 'AbortError') return;
        error.value = err;
        loading.value = false;
      });
  }

  const stop = effect(run);
  const dispose = () => {
    if (controller) controller.abort();
    stop();
  };
  onCleanup(dispose);

  return { data, error, loading, refetch: run, dispose };
}

/**
 * An imperative action with the same {data, error, loading} shape as
 * resource(), but triggered by calling run(...args) instead of reactively —
 * the right primitive for a form submit or a delete button, where the call
 * happens because the user acted, not because a signal changed.
 */
export function mutation(actionFn) {
  const data = signal(undefined);
  const error = signal(undefined);
  const loading = signal(false);
  let callId = 0;

  async function run(...args) {
    const id = ++callId;
    loading.value = true;
    error.value = undefined;
    try {
      const result = await actionFn(...args);
      if (id !== callId) return result; // superseded — still return it, just don't touch signals
      data.value = result;
      loading.value = false;
      return result;
    } catch (err) {
      if (id === callId) {
        error.value = err;
        loading.value = false;
      }
      throw err;
    }
  }

  return { data, error, loading, run };
}
