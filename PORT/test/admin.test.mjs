import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseHTML} from 'linkedom';
import {root} from '../scripts/check.mjs';

import {
  backend,
  pageNames,
  capturePage,
  applyPage,
  validateSite,
  safeUrl,
  loadSite,
  signIn,
  publishSite,
  requestPasswordReset
} from '../assets/content-store.js';

function page(name = 'index') {
  return parseHTML(
    fs.readFileSync(path.join(root,name + '.html'),'utf8')
  ).document;
}

function site() {
  const pages = {};

  for (const name of pageNames) {
    pages[name] = capturePage(page(name));
  }

  return {
    schema: 1,
    pages,
    colors: {
      accentDark: '#c0a8f5',
      accentLight: '#6840a1'
    }
  };
}

const response = (body,status = 200,etag = '"version1"') => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      ETag: etag,
      'Content-Type': 'application/json'
    }
  }
);

test('all four portfolio pages round-trip as safe editable content',() => {
  const content = site();
  validateSite(content);

  for (const name of pageNames) {
    const doc = page(name);
    applyPage(doc,content.pages[name]);

    assert.equal(doc.title,content.pages[name].title);
    assert.equal(doc.querySelector('main').dataset.page,name);
    assert.equal(doc.querySelectorAll('main h1').length,1);
    assert.deepEqual(capturePage(doc),content.pages[name]);
  }
});

test('saved content cannot introduce script elements, event handlers, or unsafe URLs',() => {
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '//evil.test',
    'https://owner:password@example.test/a',
    '/outside',
    '../../outside',
    'java\nscript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz4='
  ]) {
    assert.equal(safeUrl(value,'src'),false,value);
  }

  for (const value of [
    'pp/game.jpg',
    'https://example.test/photo.jpg',
    'data:image/png;base64,YQ=='
  ]) {
    assert.equal(safeUrl(value,'src'),true,value);
  }

  for (const mutate of [
    s => s.pages.index.main.children.push({
      type: 'element',
      tag: 'script',
      attrs: {},
      children: []
    }),
    s => s.pages.index.main.attrs.onclick = 'alert(1)',
    s => s.pages.index.main.children.push({
      type: 'element',
      tag: 'a',
      attrs: {href:'javascript:alert(1)'},
      children: []
    }),
    s => s.colors.accentDark = 'red;}body{display:none}'
  ]) {
    const bad = site();
    mutate(bad);
    assert.throws(() => validateSite(bad));
  }
});

test('page invariants, duplicate IDs, unsupported pages, and size limits are enforced',() => {
  const missing = site();
  missing.pages.index.main.attrs.id = 'other';
  assert.throws(() => validateSite(missing));

  const duplicate = site();
  duplicate.pages.index.main.children.push({
    type: 'element',
    tag: 'p',
    attrs: {id:'main'},
    children: []
  });

  assert.throws(() => validateSite(duplicate),/Duplicate/);
  assert.throws(() => validateSite({
    schema: 1,
    pages: {admin:site().pages.index}
  }));

  const big = site();
  big.pages.index.description = 'a'.repeat(1001);
  assert.throws(() => validateSite(big));
});

test('wrong password and an authenticated non-admin both fail closed',async () => {
  await assert.rejects(
    signIn(
      'owner@example.test',
      'test-only',
      async () => response({},400)
    ),
    /Sign-in failed/
  );

  let calls = 0;

  await assert.rejects(
    signIn(
      'other@example.test',
      'test-only',
      async () => ++calls === 1
        ? response({
            idToken: 'test-token',
            localId: 'other',
            expiresIn: '3600'
          })
        : response(false)
    ),
    /does not have/
  );
});

test('admin login requires the configured owner UID and returns only an in-memory session',async () => {
  const requests = [];

  const loggedIn = await signIn(
    'owner@example.test',
    'test-only',
    async (url,options) => {
      requests.push({url,options});

      return requests.length === 1
        ? response({
            idToken: 'test-token',
            refreshToken: 'discard-me',
            localId: backend.ownerUid,
            expiresIn: '3600'
          })
        : response(true);
    }
  );

  assert.equal(loggedIn.uid,backend.ownerUid);
  assert.equal(loggedIn.refreshToken,undefined);
  assert.equal(requests.length,1);
  assert.ok(loggedIn.expires > Date.now());
});

test('published content uses an authenticated conditional write',async () => {
  let request;

  const result = await publishSite(
    site(),
    {token:'test-token',expires:Date.now() + 10000},
    {etag:'"version1"',revision:1},
    async (url,options) => {
      request = {url,options};
      return response({},200,'"version2"');
    }
  );

  assert.match(request.url,/auth=test-token/);
  assert.equal(request.options.headers['if-match'],'"version1"');
  assert.equal(request.options.method,'PUT');
  assert.equal(JSON.parse(request.options.body).revision,2);
  assert.equal(result.etag,'"version2"');
});

test('expired sessions, missing ETags, conflicts, and rejected writes do not succeed',async () => {
  const content = site();
  const session = {token:'test-token',expires:Date.now() + 10000};
  const base = {etag:'"v1"',revision:1};

  let calls = 0;

  const fetcher = async () => {
    calls++;
    return response({},403);
  };

  await assert.rejects(
    publishSite(content,null,base,fetcher),
    /expired/
  );

  await assert.rejects(
    publishSite(content,session,{revision:1},fetcher),
    /Reload/
  );

  assert.equal(calls,0);

  await assert.rejects(
    publishSite(content,session,base,async () => response({},412)),
    /changed in another/
  );

  await assert.rejects(
    publishSite(content,session,base,fetcher),
    /not confirmed/
  );
});

test('public content loading validates remote data and rejects denied or malformed records',async () => {
  const loaded = await loadSite(async () => response({
    schema: 1,
    revision: 1,
    payload: JSON.stringify(site())
  }));

  assert.equal(loaded.revision,1);
  assert.equal(Object.keys(loaded.site.pages).length,4);

  await assert.rejects(
    loadSite(async () => response({},401)),
    /unavailable/
  );

  await assert.rejects(
    loadSite(async () => response({
      schema: 1,
      revision: 1,
      payload: '{"schema":1,"pages":{"admin":{}}}'
    }))
  );
});

test('deployed rules deny enrollment and limit content writes to the configured owner UID',() => {
  const fragment = JSON.parse(
    fs.readFileSync(path.join(root,'firebase/database.rules.json'))
  ).rules;

  assert.equal(fragment.portfolioAdmins.$uid['.write'],false);

  assert.equal(
    fragment.portfolioContent.site['.write'],
    "auth != null && auth.uid === '" + backend.ownerUid + "' && newData.exists()"
  );

  assert.equal(fragment['.read'],false);
  assert.equal(fragment['.write'],false);
  assert.equal(fragment.portfolioContent.site.$other['.validate'],false);
  assert.match(fragment.portfolioContent.site.payload['.validate'],/1000000/);
});

test('editor unlock, in-place text editing, page switching, publish, and sign-out work together',async () => {
  const {document,window} = parseHTML(
    fs.readFileSync(path.join(root,'admin.html'),'utf8')
  );

  const previous = Object.fromEntries(
    ['document','window','localStorage','fetch','confirm'].map(
      key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]
    )
  );

  const store = new Map();
  let frameDoc = page();
  let selectedName = 'index';
  const iframe = document.querySelector('iframe');

  Object.defineProperty(iframe,'contentDocument',{
    get: () => frameDoc
  });

  Object.defineProperty(document.querySelector('#page-select'),'value',{
    get: () => selectedName,
    set: value => {
      selectedName = value;
    }
  });

  document.querySelector('#login-form').reportValidity = () => true;

  globalThis.document = document;
  globalThis.window = window;
  globalThis.localStorage = {
    getItem: key => store.get(key) || null,
    setItem: (key,value) => store.set(key,value)
  };

  globalThis.confirm = () => true;

  const calls = [];

  globalThis.fetch = async (url,options = {}) => {
    calls.push({url,options});

    if (url.includes('signInWithPassword')) {
      return response({
        idToken: 'test-token',
        localId: backend.ownerUid,
        expiresIn: '3600'
      });
    }

    if (url.includes('portfolioAdmins')) {
      return response(true);
    }

    if (options.method === 'PUT') {
      return response({},200,'"v2"');
    }

    return response({
      schema: 1,
      revision: 1,
      payload: JSON.stringify(site())
    });
  };

  const event = (selector,type = 'click') => document
    .querySelector(selector)
    .dispatchEvent(new window.Event(type,{
      bubbles: true,
      cancelable: true
    }));

  const settle = async () => {
    for (let step = 0; step < 12; step++) {
      await new Promise(setImmediate);
    }
  };

  try {
    await import('../assets/admin.js?workflow-test');

    assert.equal(document.querySelector('#editor-app').hidden,true);

    document.querySelector('#admin-username').value = 'owner@example.test';
    document.querySelector('#admin-password').value = 'test-only';

    event('#login-form','submit');
    await settle();

    assert.equal(document.querySelector('#login-panel').hidden,true);
    assert.equal(document.querySelector('#editor-app').hidden,false);
    assert.equal(document.querySelector('#admin-password').value,'');

    iframe.dispatchEvent(new window.Event('load'));

    const hello = frameDoc.querySelector('.hello');
    hello.textContent = 'Hello from an edited draft.';

    hello.dispatchEvent(new window.Event('input',{
      bubbles: true
    }));

    selectedName = 'blog1';
    event('#page-select','change');

    frameDoc = page('blog1');
    iframe.dispatchEvent(new window.Event('load'));

    event('#save-draft');

    const saved = JSON.parse(store.get('portfolio:editor-draft'));

    assert.ok(
      JSON.stringify(saved.pages.index).includes('Hello from an edited draft.')
    );

    assert.equal(saved.pages.blog1.main.attrs['data-page'],'blog1');
    assert.equal(saved.pages.index.main.attrs['data-page'],'index');

    event('#publish');
    await settle();

    assert.match(
      document.querySelector('#editor-status').textContent,
      /Published successfully/
    );

    assert.equal(
      calls.filter(call => call.options.method === 'PUT').length,
      1
    );

    event('#sign-out');

    assert.equal(document.querySelector('#editor-app').hidden,true);
    assert.equal(document.querySelector('#login-panel').hidden,false);

    assert.equal(
      [...store.keys()].some(key => /token|password/i.test(key)),
      false
    );
  } finally {
    for (const [key,value] of Object.entries(previous)) {
      if (value === undefined) {
        delete globalThis[key];
      } else {
        Object.defineProperty(globalThis,key,value);
      }
    }
  }
});

test('password setup requests use the Firebase email flow without storing a password',async () => {
  let sent;

  await requestPasswordReset(
    'owner@example.test',
    async (url,options) => {
      sent = {url,options};
      return response({email:'owner@example.test'});
    }
  );

  assert.match(sent.url,/accounts:sendOobCode/);

  assert.deepEqual(
    JSON.parse(sent.options.body),
    {
      requestType: 'PASSWORD_RESET',
      email: 'owner@example.test'
    }
  );
});

test('invalid emails and failed reset requests cannot report success',async () => {
  let calls = 0;

  await assert.rejects(
    requestPasswordReset(
      'not-an-email',
      async () => {
        calls++;
        return response({});
      }
    ),
    /administrator email/
  );

  assert.equal(calls,0);

  await assert.rejects(
    requestPasswordReset(
      'owner@example.test',
      async () => response({},500)
    ),
    /could not be requested/
  );
});

test('formatted header lock survives capture and repeated application unchanged',() => {
  const doc = page();
  const link = doc.querySelector('.header-admin');

  link.innerHTML = '\n          <span class="lock-icon" aria-hidden="true"></span>\n        ';

  const content = capturePage(doc);

  applyPage(doc,content);
  assert.deepEqual(capturePage(doc),content);

  applyPage(doc,content);
  assert.deepEqual(capturePage(doc),content);
});

test('older saved headers still receive one current admin icon',() => {
  for (const mode of ['missing','text','old-icon','extra-content']) {
    const doc = page();
    const link = doc.querySelector('.header-admin');

    if (mode === 'missing') {
      link.remove();
    } else if (mode === 'text') {
      link.textContent = 'Admin';
    } else if (mode === 'old-icon') {
      link.innerHTML = '<span aria-hidden="true">🔒</span>';
    } else {
      link.innerHTML = '<span class="lock-icon" aria-hidden="true"></span>Admin';
    }

    applyPage(doc,capturePage(doc));

    const current = doc.querySelector('.header-admin');

    assert.equal(doc.querySelectorAll('.header-admin').length,1);
    assert.equal(current.getAttribute('href'),'admin.html');
    assert.equal(current.getAttribute('aria-label'),'Open admin editor');
    assert.equal(current.children.length,1);
    assert.equal(current.firstElementChild.className,'lock-icon');
    assert.equal(current.firstElementChild.getAttribute('aria-hidden'),'true');
    assert.equal(current.textContent,'');

    const normalized = capturePage(doc);

    applyPage(doc,normalized);
    assert.deepEqual(capturePage(doc),normalized);
  }
});
