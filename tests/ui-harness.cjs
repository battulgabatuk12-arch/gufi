// In-memory DOM and MQTT transport for testing application logic without a browser
// or internet. This does not verify CSS layout, real touch hardware, or the relay.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
class Node {
  constructor(tag = '', attrs = {}, text = '') {
    this.tagName = tag.toUpperCase(); this.attrs = attrs; this.children = []; this.parentElement = null;
    this._text = text; this.style = {}; this.listeners = new Map(); this.disabled = false;
    this.hidden = 'hidden' in attrs; this.value = attrs.value || ''; this.open = false;
    this.dataset = Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]));
    this.classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
    this.classList = { contains: c => this.classes.has(c), add: c => this.classes.add(c), remove: c => this.classes.delete(c), toggle: (c, force) => { const on = force === undefined ? !this.classes.has(c) : force; on ? this.classes.add(c) : this.classes.delete(c); return on; } };
  }
  get firstChild() { return this.children[0]; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  set textContent(t) { this._text = String(t); this.children = []; }
  set innerHTML(t) { this.textContent = t.replace(/<[^>]*>/g, ''); }
  append(...nodes) { for (let n of nodes) { if (typeof n === 'string') n = new Node('', {}, n); n.parentElement = this; this.children.push(n); } }
  appendChild(n) { this.append(n); return n; }
  replaceChildren(...nodes) { this._text = ''; this.children = []; this.append(...nodes); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  matches(selector) {
    const tag = selector.match(/^[\w-]+/); if (tag && this.tagName !== tag[0].toUpperCase()) return false;
    const cls = selector.match(/\.([\w-]+)/); if (cls && !this.classes.has(cls[1])) return false;
    const attr = selector.match(/\[([\w-]+)\]/); if (attr && !(attr[1] in this.attrs)) return false;
    return !!this.tagName;
  }
  querySelectorAll(selector) {
    const parts = selector.trim().split(/\s+/), result = [];
    const walk = node => { for (const child of node.children) { if (child.matches(parts.at(-1))) { let ancestor = child.parentElement, n = parts.length - 2; while (n >= 0 && ancestor) { if (ancestor.matches(parts[n])) n--; ancestor = ancestor.parentElement; } if (n < 0) result.push(child); } walk(child); } };
    walk(this); return result;
  }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
  closest(s) { let n = this; while (n) { if (n.matches(s)) return n; n = n.parentElement; } return null; }
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(fn); }
  dispatch(name, fields = {}) { const e = { target: this, preventDefault() {}, ...fields }; for (const fn of this.listeners.get(name) || []) fn(e); }
  click() { if (!this.disabled && this.onclick) return this.onclick({ target: this }); }
  focus() {}
  setPointerCapture() {}
  showModal() { this.open = true; this.attrs.open = ''; }
  close() { this.open = false; delete this.attrs.open; this.dispatch('close'); }
  getContext() { return new Proxy({ measureText: s => ({ width: String(s).length * 6 }) }, { get: (t, p) => p in t ? t[p] : () => {} }); }
  getBoundingClientRect() { return this.rect || { x: 0, y: 0, left: 0, top: 0, width: 210, height: 140 }; }
}
function documentFromHtml(width, height) {
  const document = new Node('document'), stack = [document], ids = new Map();
  const source = html.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '');
  for (const token of source.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/[\w-]+\s*>|<[\w-]+\b[^>]*>|[^<]+/g)) {
    const t = token[0]; if (t.startsWith('<!')) continue;
    if (t.startsWith('</')) { const tag = t.slice(2, -1).trim().toUpperCase(); while (stack.length > 1) if (stack.pop().tagName === tag) break; continue; }
    if (t.startsWith('<')) {
      const tag = t.match(/^<([\w-]+)/)[1], attrs = {};
      const rest = t.slice(tag.length + 1, -1);
      for (const a of rest.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1]] = decode(a[2] ?? a[3] ?? a[4] ?? '');
      const node = new Node(tag, attrs); stack.at(-1).append(node); if (attrs.id) ids.set(attrs.id, node);
      if (!/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(tag) && !t.endsWith('/>')) stack.push(node);
    } else stack.at(-1).append(new Node('', {}, decode(t)));
  }
  document.getElementById = id => ids.get(id) || null;
  document.createElement = tag => new Node(tag); document.createTextNode = t => new Node('', {}, t);
  document.documentElement = document.querySelector('html');
  ids.get('map').rect = { left: width <= 760 ? 0 : 253, top: 63, width: width <= 760 ? width : width - 253, height: height - 63 };
  return document;
}
function mqttPacket(head, payload) {
  const bytes = []; let length = payload.length;
  do { let digit = length % 128; length = Math.floor(length / 128); if (length) digit |= 128; bytes.push(digit); } while (length);
  return Uint8Array.from([head, ...bytes, ...payload]);
}
class Broker {
  constructor() { this.queue = []; this.sockets = []; }
  flush() { let count = 0; while (this.queue.length) { if (++count > 1000) throw Error('broker loop'); this.queue.shift()(); } }
  webSocketClass() {
    const broker = this;
    return class WebSocket {
      static OPEN = 1;
      constructor() { this.readyState = 0; this.topics = new Set(); broker.sockets.push(this); broker.queue.push(() => { this.readyState = 1; this.onopen?.(); }); }
      receive(packet) { broker.queue.push(() => { if (this.readyState === 1) this.onmessage?.({ data: Uint8Array.from(packet).buffer }); }); }
      send(data) {
        const packet = Array.from(data), type = packet[0] >> 4; let i = 1; while (packet[i++] & 128) {}
        const p = packet.slice(i);
        if (type === 1) this.receive(mqttPacket(0x20, [0, 0]));
        if (type === 8) { for (let j = 2; j < p.length;) { const len = p[j] * 256 + p[j + 1]; j += 2; this.topics.add(Buffer.from(p.slice(j, j + len)).toString()); j += len + 1; } this.receive(mqttPacket(0x90, [p[0], p[1], 0])); }
        if (type === 3) { const len = p[0] * 256 + p[1], topic = Buffer.from(p.slice(2, 2 + len)).toString(); for (const socket of broker.sockets) if (socket.topics.has(topic)) socket.receive(data); }
      }
      close() { this.readyState = 3; }
    };
  }
}
function app({ width = 1440, height = 900, search = '', saved, broker = new Broker(), fetchImpl, tutorialSeen = true } = {}) {
  const document = documentFromHtml(width, height), listeners = new Map(), storage = new Map(saved || []);
  if (tutorialSeen) storage.set('mongol-baatruud-guide-v1', '1');
  let now = 0, raf = null;
  const sandbox = {
    document, console, crypto: webcrypto, TextEncoder, TextDecoder, URL, URLSearchParams, WebSocket: broker.webSocketClass(),
    performance: { now: () => now }, location: { search, href: 'https://game.test/' + search, protocol: 'https:' },
    fetch: fetchImpl || (async () => ({ ok: false, json: async () => ({ error: 'offline test' }) })),
    navigator: { clipboard: { writeText: async () => {} } }, devicePixelRatio: 1,
    matchMedia: () => ({ matches: width <= 760 }), ResizeObserver: class { observe() {} },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    requestAnimationFrame: fn => { raf = fn; },
    addEventListener: (name, fn) => { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); }
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox); for (const script of scripts) vm.runInContext(script, context);
  const fire = (name, fields = {}) => { const event = { target: document.getElementById('map'), preventDefault() {}, ...fields }; for (const fn of listeners.get(name) || []) fn(event); };
  return { context, document, storage, broker, fire, get steppe() { return context.Steppe; },
    click: id => document.getElementById(id).click(),
    frame: (ms = 16) => { now += ms; const fn = raf; raf = null; fn(now); broker.flush(); },
    frames: n => { for (let i = 0; i < n; i++) { now += 16; const fn = raf; raf = null; fn(now); broker.flush(); } }
  };
}
module.exports = { app, Broker };
