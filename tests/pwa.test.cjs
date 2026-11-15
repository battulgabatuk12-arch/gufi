const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
test('the install manifest has real 192px/512px icons and an Apple home screen icon', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest')));
  assert.equal(manifest.display, 'standalone'); assert.equal(manifest.scope, '/');
  for (const icon of manifest.icons) {
    const bytes = fs.readFileSync(path.join(root, icon.src));
    const dimension = Number(icon.sizes.split('x')[0]);
    assert.equal(bytes.readUInt32BE(16), dimension); assert.equal(bytes.readUInt32BE(20), dimension);
  }
  assert.equal(fs.readFileSync(path.join(root, 'icons/apple-touch-icon.png')).readUInt32BE(16), 180);
});
test('the app shell is cached offline and ranking API requests are never intercepted', async () => {
  const listeners = {}, saved = new Map();
  const sandbox = { URL, Promise, self: { location: { origin: 'https://game.test' }, clients: { claim: async () => {} }, addEventListener: (name, fn) => { listeners[name] = fn; } }, caches: { open: async () => ({ addAll: async files => files.forEach(p => saved.set(p, 'cached ' + p)), put: async (k,v) => saved.set(k,v) }), keys: async () => [], match: async key => saved.get(key), delete: async () => true }, fetch: async () => { throw Error('offline'); } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), sandbox);
  let pending; listeners.install({ waitUntil: p => { pending = p; } }); await pending;
  assert.ok(saved.has('/index.html'));
  let response; listeners.fetch({ request: { method: 'GET', url: 'https://game.test/?app=1', mode: 'navigate' }, respondWith: p => { response = p; } });
  assert.equal(await response, 'cached /index.html');
  let intercepted = false; listeners.fetch({ request: { method: 'GET', url: 'https://game.test/api/rank' }, respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, false);
});
