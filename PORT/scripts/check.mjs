import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const pages = ['index.html', 'blog1.html', 'blog2.html', 'blog3.html', 'admin.html'];
const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
export function audit(base = root) {
  const errors = [];
  const documents = new Map(pages.map(file => [file, fs.readFileSync(path.join(base, file), 'utf8')]));
  const ids = new Map([...documents].map(([file, html]) => [file, [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])]));
  let references = 0;
  for (const [file, html] of documents) {
    const fail = message => errors.push(`${file}: ${message}`);
    if (new Set(ids.get(file)).size !== ids.get(file).length) fail('duplicate IDs');
    if ((html.match(/<h1\b/g) || []).length !== 1) fail('must have exactly one h1');
    if (!html.includes('<html lang="en"')) fail('missing document language');
    if (!html.includes('name="viewport"')) fail('missing responsive viewport');
    if (!html.includes('name="description"')) fail('missing description');
    const stack = [];
    for (const token of html.matchAll(/<!--[\s\S]*?-->|<![^>]+>|<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi)) {
      if (!token[1]) continue;
      const tag = token[1].toLowerCase();
      if (voidTags.has(tag)) continue;
      if (token[0].startsWith('</')) { if (stack.pop() !== tag) fail(`unbalanced closing ${tag}`); }
      else stack.push(tag);
    }
    if (stack.length) fail(`unclosed tags: ${stack.join(', ')}`);
    for (const match of html.matchAll(/<(?:a|link|img|script)\b[^>]*?\b(?:href|src)="([^"]+)"[^>]*>/g)) {
      const ref = match[1];
      if (ref === '#') { fail('placeholder link'); continue; }
      if (/^(?:https?:|mailto:|tel:)/.test(ref)) continue;
      references++;
      if (ref.startsWith('/')) { fail(`root-relative path breaks project Pages: ${ref}`); continue; }
      const [relative, fragment] = ref.split('#');
      const resolved = path.resolve(base, relative || file);
      if (resolved !== base && !resolved.startsWith(base + path.sep)) { fail(`path escapes site: ${ref}`); continue; }
      if (!fs.existsSync(resolved)) { fail(`missing file: ${ref}`); continue; }
      if (relative) {
        let directory = base;
        for (const component of relative.split('/')) {
          if (!fs.readdirSync(directory).includes(component)) { fail(`case mismatch: ${ref}`); break; }
          directory = path.join(directory, component);
        }
      }
      if (fragment && !ids.get(relative || file)?.includes(fragment)) fail(`missing fragment: ${ref}`);
    }
    for (const img of html.matchAll(/<img\b[^>]*>/g)) {
      if (!/\balt="[^"]*"/.test(img[0])) fail('image missing alternative text');
      if (!/\bwidth="\d+"/.test(img[0]) || !/\bheight="\d+"/.test(img[0])) fail('image missing intrinsic dimensions');
    }
    for (const input of html.matchAll(/<(?:input|textarea)\b[^>]*>/g)) {
      if (input[0].includes('honeypot')) continue;
      const id = input[0].match(/\bid="([^"]+)"/)?.[1];
      if (!id || !html.includes(`for="${id}"`)) fail('form field missing explicit label');
    }
  }
  return { errors, pages: documents.size, references };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = audit();
  for (const file of ['assets/script.js','assets/theme.js','assets/content-store.js','assets/content-entry.js','assets/admin.js','scripts/build.mjs','scripts/serve.mjs']) {
    const checked = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
    if (checked.status !== 0) result.errors.push(checked.stderr);
  }
  if (result.errors.length) { console.error(result.errors.join('\n')); process.exitCode = 1; }
  else console.log(`PASS: ${result.pages} HTML pages; ${result.references} local references; exact path casing, fragments, markup, image dimensions, form labels, and JavaScript syntax.`);
}
