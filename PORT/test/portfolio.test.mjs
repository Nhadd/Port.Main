import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { audit, root } from '../scripts/check.mjs';
test('all pages have valid structure and case-sensitive Pages-safe references', () => { assert.deepEqual(audit().errors, []); });
test('original photographs, screenshots, and CV are preserved byte for byte', () => {
  const baseline = JSON.parse(fs.readFileSync(new URL('./original-assets.json', import.meta.url)));
  for (const item of baseline) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, item.path))).digest('hex'), item.sha256, item.path);
});
class Element {
  constructor() { this.attributes = {}; this.listeners = {}; this.textContent = ''; this.disabled = false; this.hidden = true; this.dataset = {}; this.children = {}; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  querySelector(selector) { return this.children[selector] || null; }
  querySelectorAll() { return []; }
}
const script = fs.readFileSync(path.join(root, 'assets/script.js'), 'utf8');
function run({ elements = {}, likes = [], fetch = async () => ({ ok: false }), brokenStorage = false } = {}) {
  const storage = new Map();
  const document = { documentElement: { dataset: { theme: 'dark' } }, querySelector: selector => elements[selector] || null, querySelectorAll: selector => selector === '[data-like]' ? likes : [], body: { classList: { add(){}, remove(){} } } };
  const context = { document, window: {}, matchMedia: () => ({ matches: false, addEventListener(){} }), localStorage: { getItem(key) { if (brokenStorage) throw new Error('Storage denied'); return storage.get(key); }, setItem(key,value) { if (brokenStorage) throw new Error('Storage denied'); storage.set(key,value); } }, Date, fetch, AbortSignal, FormData: class {} };
  vm.runInNewContext(script, context);
  return { document, storage };
}
test('shared script does not crash on journal pages without homepage controls', () => { assert.doesNotThrow(() => run()); });
test('theme changes even when browser storage is blocked', () => {
  const theme = new Element(); const { document } = run({ elements: { '#theme-toggle': theme }, brokenStorage: true });
  theme.listeners.click(); assert.equal(document.documentElement.dataset.theme, 'light'); assert.equal(theme.attributes['aria-label'], 'Switch to dark theme');
});
function contact() {
  const form = new Element(), button = new Element(), status = new Element();
  form.action = 'https://formspree.io/f/myzwklvk'; form.elements = { _gotcha: { value: '' } }; form.children['[type=submit]'] = button;
  form.reportValidity = () => true; form.reset = () => { form.didReset = true; };
  return { form, button, status, elements: { '#contact-form': form, '#form-status': status } };
}
test('failed contact delivery preserves the message and exposes email fallback', async () => {
  const state = contact(); run({ elements: state.elements, fetch: async () => { throw new Error('Offline'); } });
  await state.form.listeners.submit({ preventDefault(){} });
  assert.match(state.status.textContent, /could not be confirmed/); assert.match(state.status.textContent, /nhaddacpano@gmail.com/); assert.equal(state.form.didReset, undefined); assert.equal(state.button.disabled, false);
});
test('contact form clears only after successful service response', async () => {
  const state = contact(); let calls = 0;
  run({ elements: state.elements, fetch: async () => { calls++; return { ok: true }; } });
  await state.form.listeners.submit({ preventDefault(){} });
  assert.equal(calls,1); assert.equal(state.form.didReset,true); assert.match(state.status.textContent,/has been sent/); assert.equal(state.button.disabled,false);
});
test('invalid form and honeypot never send a request', async () => {
  const state = contact(); let calls = 0;
  run({ elements: state.elements, fetch: async () => { calls++; } });
  state.form.reportValidity = () => false; await state.form.listeners.submit({ preventDefault(){} });
  state.form.reportValidity = () => true; state.form.elements._gotcha.value = 'bot'; await state.form.listeners.submit({ preventDefault(){} });
  assert.equal(calls,0);
});
test('denied Firebase access falls back to a toggleable local heart', async () => {
  const button = new Element(), count = new Element(), icon = new Element(), status = new Element();
  button.dataset.like = 'blog1'; button.children['.like-count'] = count; button.children.span = icon;
  const { storage } = run({ likes:[button], elements:{ '#like-status':status }, fetch:async()=>({ok:false}) });
  await button.listeners.click(); assert.equal(button.attributes['aria-pressed'],'true'); assert.equal(count.textContent,'1'); assert.equal(storage.get('portfolio:like:blog1'),'true'); assert.match(status.textContent,/this device/);
  await button.listeners.click(); assert.equal(button.attributes['aria-pressed'],'false'); assert.equal(count.textContent,'0');
});
test('production build retains all local navigation and project path compatibility', { skip: !fs.existsSync(path.join(root,'dist/index.html')) }, () => { assert.deepEqual(audit(path.join(root,'dist')).errors,[]); });
