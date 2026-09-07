import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createToken, Container, createContainer, provide, inject, rootContainer } from '../src/index.js';

test('createToken() returns a unique Symbol, even for the same description', () => {
  const a = createToken('logger');
  const b = createToken('logger');
  assert.equal(typeof a, 'symbol');
  assert.notEqual(a, b, 'two tokens with the same description must not be the same identity');
  assert.equal(a.description, 'logger');
});

test('provide()/inject() round-trips a plain value', () => {
  const c = createContainer();
  const Token = createToken('config');
  c.provide(Token, { apiUrl: 'https://example.test' });
  assert.deepEqual(c.inject(Token), { apiUrl: 'https://example.test' });
});

test('provide() with a factory receives the container and is memoized (singleton by default)', () => {
  const c = createContainer();
  const Token = createToken('service');
  let calls = 0;
  c.provide(Token, (container) => {
    calls++;
    assert.equal(container, c, 'factory receives the container it was registered on');
    return { id: calls };
  });
  const first = c.inject(Token);
  const second = c.inject(Token);
  assert.equal(calls, 1, 'a singleton factory runs exactly once');
  assert.equal(first, second, 'repeated inject() returns the same instance');
});

test('provide(..., { singleton: false }) runs the factory again on every inject()', () => {
  const c = createContainer();
  const Token = createToken('transient');
  let calls = 0;
  c.provide(Token, () => ({ id: ++calls }), { singleton: false });
  const first = c.inject(Token);
  const second = c.inject(Token);
  assert.equal(calls, 2);
  assert.notEqual(first, second);
});

test('inject() throws a clear error for an unregistered token', () => {
  const c = createContainer();
  const Token = createToken('missing');
  assert.throws(() => c.inject(Token), /no provider registered/i);
});

test('re-providing a token clears its cached instance', () => {
  const c = createContainer();
  const Token = createToken('flag');
  c.provide(Token, 'first');
  assert.equal(c.inject(Token), 'first');
  c.provide(Token, 'second');
  assert.equal(c.inject(Token), 'second', 're-provide must invalidate the previously cached value');
});

test('has() reports registration without resolving/instantiating', () => {
  const c = createContainer();
  const Token = createToken('lazy');
  let built = false;
  c.provide(Token, () => {
    built = true;
    return {};
  });
  assert.equal(c.has(Token), true);
  assert.equal(built, false, 'has() must not trigger the factory');
});

test('createChild() falls back to the parent container for unregistered tokens', () => {
  const parent = createContainer();
  const ParentToken = createToken('fromParent');
  parent.provide(ParentToken, 'parent-value');

  const child = parent.createChild();
  assert.equal(child.inject(ParentToken), 'parent-value');
  assert.equal(child.has(ParentToken), true);
});

test('a child container can override a parent-provided token without mutating the parent', () => {
  const parent = createContainer();
  const Token = createToken('overridable');
  parent.provide(Token, 'parent-value');

  const child = parent.createChild();
  child.provide(Token, 'child-value');

  assert.equal(child.inject(Token), 'child-value');
  assert.equal(parent.inject(Token), 'parent-value', "overriding in a child must not affect the parent's own value");
});

test('a grandchild container resolves through multiple levels of parents', () => {
  const grandparent = createContainer();
  const Token = createToken('deep');
  grandparent.provide(Token, 'from-grandparent');

  const parent = grandparent.createChild();
  const child = parent.createChild();

  assert.equal(child.inject(Token), 'from-grandparent');
});

test('Container can be constructed directly with an explicit parent (same as createChild())', () => {
  const parent = new Container();
  const Token = createToken('direct');
  parent.provide(Token, 'value');

  const child = new Container(parent);
  assert.equal(child.inject(Token), 'value');
});

test('module-level provide()/inject() operate on a shared global root container', () => {
  const Token = createToken('global-root');
  provide(Token, 'root-value');
  assert.equal(inject(Token), 'root-value');
  assert.equal(rootContainer.inject(Token), 'root-value', 'the exported rootContainer must be the same instance provide()/inject() use');
});

test('a factory can inject other tokens from the same container to compose services', () => {
  const c = createContainer();
  const ConfigToken = createToken('config');
  const ServiceToken = createToken('service');

  c.provide(ConfigToken, { greeting: 'hello' });
  c.provide(ServiceToken, (container) => {
    const config = container.inject(ConfigToken);
    return { greet: (name) => `${config.greeting}, ${name}!` };
  });

  assert.equal(c.inject(ServiceToken).greet('world'), 'hello, world!');
});
