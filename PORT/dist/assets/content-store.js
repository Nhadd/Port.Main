// Shared, dependency-free persistence. Firebase credentials are never bundled here.
export const backend = Object.freeze({
  apiKey: 'AIzaSyD3Cqhp2-M98PePXzkutp-dWFvATLoHZkI',
  database: "https://leonard-dacpano-portfolio-default-rtdb.asia-southeast1.firebasedatabase.app",
  sitePath: 'portfolioContent/site',
  ownerUid: 'mplk1JMenjfCgSix8rhe3Zourpu2',
  maxPayload: 1000000
});
export const pageNames = ['index', 'blog1', 'blog2', 'blog3'];
const tags = new Set('a article blockquote br button details div em figcaption figure form h1 h2 h3 h4 header img input label li nav p section small span strong summary textarea ul'.split(' '));
const attributes = new Set('id class title alt width height loading fetchpriority href src target rel download type name for rows placeholder required maxlength autocomplete tabindex role aria-label aria-labelledby aria-live aria-controls aria-expanded aria-pressed aria-hidden aria-current hidden data-filter data-category data-like data-year data-page'.split(' '));
const containers = new Set(['header','main','footer']);
const colorNames = new Set(['accentDark','accentLight']);
export function safeUrl(value, kind = 'href') {
  if (typeof value !== 'string' || value.length > 450000 || /[\u0000-\u001f\u007f\\]/.test(value)) return false;
  if (kind === 'src' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)) return true;
  if (kind === 'href' && /^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(value)) return true;
  if (/^https:\/\//i.test(value)) { try { const url = new URL(value); return !url.username && !url.password; } catch { return false; } }
  if (kind === 'href' && /^(mailto:[^\s<>]+@[^\s<>]+|tel:\+?[\d ()-]+)$/i.test(value)) return true;
  if (!value || value.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('/')) return false;
  try { const url = new URL(value, 'https://portfolio.invalid/leonarddacpano/'); return url.origin === 'https://portfolio.invalid' && url.pathname.startsWith('/leonarddacpano/'); } catch { return false; }
}
export function validateTree(node, depth = 0, budget = {count:0}) {
  if (++budget.count > 18000 || depth > 35 || !node || typeof node !== 'object' || Array.isArray(node)) throw new Error('Invalid page structure.');
  if (node.type === 'text') { if (typeof node.value !== 'string' || node.value.length > 15000) throw new Error('Text is too long.'); return; }
  if (node.type !== 'element' || (!tags.has(node.tag) && !containers.has(node.tag))) throw new Error('Unsupported element.');
  if (!node.attrs || typeof node.attrs !== 'object' || Array.isArray(node.attrs)) throw new Error('Invalid attributes.');
  for (const [key,value] of Object.entries(node.attrs)) {
    if (!attributes.has(key) && !(key === 'action' && node.tag === 'form') && !(key === 'method' && node.tag === 'form')) throw new Error('Unsupported attribute.');
    if (typeof value !== 'string' || (key !== 'src' && key !== 'href' && value.length > 1000)) throw new Error('Invalid attribute value.');
    if (['href','src','action'].includes(key) && !safeUrl(value, key)) throw new Error('Use a relative file path or a safe HTTPS URL.');
    if (key === 'data-like' && !/^[a-z0-9-]+$/i.test(value)) throw new Error('Invalid appreciation key.');
    if (key === 'method' && value.toLowerCase() !== 'post') throw new Error('Unsupported form method.');
    if (key === 'target' && !['_blank','_self'].includes(value)) throw new Error('Invalid link target.');
  }
  if (!Array.isArray(node.children)) throw new Error('Invalid children.');
  for (const child of node.children) validateTree(child, depth + 1, budget);
}
export function validateSite(site) {
  if (!site || site.schema !== 1 || typeof site.pages !== 'object' || Array.isArray(site.pages)) throw new Error('Invalid portfolio data.');
  if (new TextEncoder().encode(JSON.stringify(site)).length > backend.maxPayload) throw new Error('Portfolio data is too large. Use image URLs for larger files.');
  for (const [name,page] of Object.entries(site.pages)) {
    if (!pageNames.includes(name) || !page || typeof page.title !== 'string' || page.title.length > 180 || typeof page.description !== 'string' || page.description.length > 1000) throw new Error('Invalid page metadata.');
    for (const region of ['header','main','footer']) {
      const node = page[region];
      if (!node || node.tag !== region) throw new Error('Missing page region.');
      validateTree(node);
    }
    if (page.main.attrs.id !== 'main' || !page.header.attrs.class?.split(' ').includes('site-header') || !page.footer.attrs.class?.split(' ').includes('site-footer')) throw new Error('Missing page landmarks.');
    const ids=[]; const walk=node=>{if(node.type==='element'){if(node.attrs.id)ids.push(node.attrs.id);node.children.forEach(walk);}};walk(page.header);walk(page.main);walk(page.footer);
    if (new Set(ids).size!==ids.length) throw new Error('Duplicate IDs in page.');
    const required = name === 'index' ? ['home','hero-title','projects','work-title','filter-status','about','about-title','skills','skills-title','experience','education','blog','journal-title','contact','contact-title','contact-form','name','email','message','form-status','like-status','main-nav','theme-toggle','menu-btn'] : ['main-nav','theme-toggle','menu-btn'];
    if (required.some(id=>!ids.includes(id))) throw new Error('A required page section or control is missing.');
  }
  for (const [key,value] of Object.entries(site.colors || {})) if (!colorNames.has(key) || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Invalid theme color.');
  return site;
}
function serializeNode(node) {
  if (node.nodeType === 3) return { type:'text', value:node.textContent };
  if (node.nodeType !== 1 || (!tags.has(node.localName) && !containers.has(node.localName))) return null;
  const attrs = {};
  for (const attribute of node.attributes) if (attributes.has(attribute.name) || (node.localName === 'form' && ['action','method'].includes(attribute.name))) attrs[attribute.name]=attribute.value;
  if (attrs.target === '_blank') attrs.rel = 'noopener noreferrer';
  // Filters, likes, and nav are initialized afresh after the saved page is loaded.
  if (attrs['data-category']) delete attrs.hidden;
  if (node.matches('.filters,[data-like]')) attrs.hidden='';
  if (attrs.id === 'main-nav') delete attrs['aria-current'];
  if (attrs.id === 'menu-btn') attrs['aria-expanded']='false';
  if (node.matches('details')) delete attrs.open;
  attrs.class = (attrs.class || '').split(/\s+/).filter(c => c && !['reveal-ready','is-visible','is-open','editor-selected'].includes(c)).join(' ');
  if (!attrs.class) delete attrs.class;
  return { type:'element', tag:node.localName, attrs, children:[...node.childNodes].map(serializeNode).filter(Boolean) };
}
export function capturePage(doc) {
  const page = { title:doc.title, description:doc.querySelector('meta[name=description]')?.content || '' };
  for (const [name,selector] of Object.entries({header:'.site-header',main:'main',footer:'.site-footer'})) page[name] = serializeNode(doc.querySelector(selector));
  validateSite({schema:1,pages:{[doc.querySelector('main').dataset.page || 'index']:page}});
  return page;
}
function createNode(doc, node) {
  if (node.type === 'text') return doc.createTextNode(node.value);
  const element = doc.createElement(node.tag);
  for (const [key,value] of Object.entries(node.attrs)) element.setAttribute(key,value);
  if (element.target === '_blank') element.rel = 'noopener noreferrer';
  node.children.forEach(child => element.append(createNode(doc,child)));
  return element;
}
// Keep the editor entrance available when loading older published headers.
function ensureHeaderAdminLink(doc) {
  const actions=doc.querySelector('.site-header .header-actions');
  if(!actions)return;
  const link=actions.querySelector('.header-admin') || doc.createElement('a');
  link.className='header-admin';link.setAttribute('href','admin.html');link.setAttribute('aria-label','Open admin editor');link.setAttribute('title','Open admin editor');
  const icon=doc.createElement('span');icon.className='lock-icon';icon.setAttribute('aria-hidden','true');
  link.replaceChildren(icon);if(!link.parentElement)actions.prepend(link);
}
export function applyPage(doc, page) {
  for (const [name,selector] of Object.entries({header:'.site-header',main:'main',footer:'.site-footer'})) doc.querySelector(selector).replaceWith(createNode(doc,page[name]));
  ensureHeaderAdminLink(doc);
  doc.title = page.title;
  for (const selector of ['meta[name=description]','meta[property="og:description"]']) {const meta=doc.querySelector(selector);if(meta)meta.content=page.description;}
  const title=doc.querySelector('meta[property="og:title"]');if(title)title.content=page.title;
}
export function applyColors(doc,colors={}) {
  doc.querySelector('#portfolio-colors')?.remove();
  if (!colors.accentDark && !colors.accentLight) return;
  const style=doc.createElement('style');style.id='portfolio-colors';
  style.textContent=`:root[data-theme="dark"]{${colors.accentDark?'--accent:'+colors.accentDark+';':''}}:root[data-theme="light"]{${colors.accentLight?'--accent:'+colors.accentLight+';':''}}`;
  doc.head.append(style);
}
export async function loadSite(fetcher = fetch, token = '') {
  const response=await fetcher(`${backend.database}/${backend.sitePath}.json${token?'?auth='+encodeURIComponent(token):''}`,{headers:{'X-Firebase-ETag':'true'},signal:AbortSignal.timeout(token?7000:2500),cache:'no-store'});
  if(!response.ok)throw new Error('Portfolio storage is unavailable.');
  const record=await response.json();
  if(record===null)return {site:{schema:1,pages:{},colors:{}},etag:response.headers.get('ETag'),revision:0};
  if(record.schema!==1 || !Number.isSafeInteger(record.revision) || record.revision<1 || typeof record.payload!=='string' || record.payload.length>backend.maxPayload)throw new Error('Invalid saved portfolio.');
  return {site:validateSite(JSON.parse(record.payload)),etag:response.headers.get('ETag'),revision:record.revision};
}
export async function signIn(email,password,fetcher=fetch) {
  const response=await fetcher(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${backend.apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Sign-in failed. Check your credentials and that email/password sign-in is enabled.');
  const result=await response.json();
  if(!result.idToken || !result.localId)throw new Error('Invalid sign-in response.');
  if(result.localId!==backend.ownerUid)throw new Error('This account does not have portfolio administrator access.');
  return {token:result.idToken,uid:result.localId,expires:Date.now()+Math.min(Number(result.expiresIn)||3600,3600)*1000};
}
export async function publishSite(site,session,base,fetcher=fetch) {
  validateSite(site);
  if(!session?.token || session.expires<=Date.now())throw new Error('Your session expired. Sign in again to publish.');
  if(!base?.etag)throw new Error('Reload the published version before saving.');
  const response=await fetcher(`${backend.database}/${backend.sitePath}.json?auth=${encodeURIComponent(session.token)}`,{method:'PUT',headers:{'Content-Type':'application/json','if-match':base.etag,'X-Firebase-ETag':'true'},body:JSON.stringify({schema:1,revision:base.revision+1,updatedAt:{'.sv':'timestamp'},payload:JSON.stringify(site)}),signal:AbortSignal.timeout(15000)});
  if(response.status===412)throw new Error('The published version changed in another session. Export your draft and reload before publishing.');
  if(!response.ok)throw new Error('Publishing was not confirmed. Your draft is still here; check the connection and your admin access.');
  return {revision:base.revision+1,etag:response.headers.get('ETag')};
}

export async function requestPasswordReset(email,fetcher=fetch) {
 if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Enter your administrator email first.');
 const response=await fetcher('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key='+backend.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestType:'PASSWORD_RESET',email}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('The password email could not be requested. Please try again later.');
}
