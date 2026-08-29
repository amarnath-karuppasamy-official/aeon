import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signal } from '@aeon-framework/core';
import { resource, mutation, http, HttpError } from '../src/index.js';

// A tiny scripted fetch stand-in — enough to drive resource()/mutation()
// through real promise timing without a real network.
function fakeFetch(responder) {
  return async (url, opts) => {
    const { status = 200, body = {}, delayMs = 0, headers = { 'content-type': 'application/json' } } =
      await responder(url, opts);
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    if (opts?.signal?.aborted) {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: { get: (k) => (k.toLowerCase() === 'content-type' ? headers['content-type'] : null) },
      json: async () => body,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    };
  };
}

test('resource() fetches when the source is present, skips when falsy', async () => {
  globalThis.fetch = fakeFetch(async () => ({ body: { ok: true } }));
  const id = signal(null);
  const r = resource(() => id.value, (v) => http.get(`/api/${v}`));
  assert.equal(r.loading.value, false); // no source yet, never fetched
  assert.equal(r.data.value, undefined);

  id.value = 1;
  assert.equal(r.loading.value, true); // fetch kicked off synchronously
  await new Promise((res) => setTimeout(res, 0));
  assert.deepEqual(r.data.value, { ok: true });
  assert.equal(r.loading.value, false);
  r.dispose();
});

test('resource() discards a superseded (stale) response', async () => {
  const calls = [];
  globalThis.fetch = fakeFetch(async (url) => {
    calls.push(url);
    const delayMs = url.endsWith('/1') ? 50 : 5; // first call resolves LAST
    return { body: { url }, delayMs };
  });
  const id = signal(1);
  const r = resource(() => id.value, (v) => http.get(`/api/${v}`));
  id.value = 2; // supersedes the /1 request before it resolves
  await new Promise((res) => setTimeout(res, 80));
  assert.deepEqual(r.data.value, { url: '/api/2' }); // never flickers back to /1's late result
  r.dispose();
});

test('resource() surfaces a non-2xx response as HttpError on the error signal', async () => {
  globalThis.fetch = fakeFetch(async () => ({ status: 404, body: { message: 'not found' } }));
  const r = resource(() => 1, () => http.get('/api/missing'));
  await new Promise((res) => setTimeout(res, 0));
  assert.ok(r.error.value instanceof HttpError);
  assert.equal(r.error.value.status, 404);
  assert.equal(r.data.value, undefined);
  r.dispose();
});

test('mutation() runs on demand and reports loading/data/error', async () => {
  globalThis.fetch = fakeFetch(async () => ({ body: { created: true } }));
  const create = mutation((payload) => http.post('/api/things', payload));
  assert.equal(create.loading.value, false);
  const p = create.run({ name: 'x' });
  assert.equal(create.loading.value, true);
  await p;
  assert.deepEqual(create.data.value, { created: true });
  assert.equal(create.loading.value, false);
});

test('mutation() rejects and sets the error signal on failure', async () => {
  globalThis.fetch = fakeFetch(async () => ({ status: 500, body: 'boom' }));
  const create = mutation(() => http.post('/api/things', {}));
  await assert.rejects(() => create.run());
  assert.ok(create.error.value instanceof HttpError);
});
