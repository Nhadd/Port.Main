import {pageNames,backend,signIn,loadSite,publishSite,capturePage,applyPage,applyColors,validateSite,safeUrl,requestPasswordReset} from './content-store.js';
const $=selector=>document.querySelector(selector);
let session=null,base=null,draft={schema:1,pages:{},colors:{}},selected=null,dirty=false,preview=false,loading=false,loadedPage='index',editVersion=0;
const iframe=$('#editor-frame');
const status=(message)=>{$('#editor-status').textContent=message;};
const loginStatus=(message)=>{$('#login-status').textContent=message;};
const selectedPage=()=>$('#page-select').value;
function remember() {
  let saved=false;try{localStorage.setItem('portfolio:editor-draft',JSON.stringify(draft));saved=true;}catch{/* Memory and export still work. */}
  dirty=true;editVersion++;status(saved?'Draft changes are saved on this device. Publish when you’re ready.':'Draft kept in memory. Export a backup before closing this tab.');
}
function capture() {
  if(loading || !iframe.contentDocument?.querySelector('main'))return;
  const doc=iframe.contentDocument;
  draft.pages[loadedPage]=capturePage(doc);
  remember();
}
function showSelection(element) {
  selected?.classList.remove('editor-selected');selected=element;selected.classList.add('editor-selected');
  $('#selected-name').textContent=element.tagName.toLowerCase()+(element.id?' #'+element.id:'');
  const textField=$('#selected-text');
  const editableText=element.matches('h1,h2,h3,h4,p,li,figcaption,span,em,strong,label,summary,a')&&!element.querySelector('img');
  $('#text-field').hidden=!editableText;
  textField.value=editableText?element.textContent:'';
  const image=element.closest('img');$('#image-fields').hidden=!image;
  if(image){$('#image-url').value=image.getAttribute('src')||'';$('#image-alt').value=image.alt;}
  const link=element.closest('a');$('#link-field').hidden=!link;
  if(link)$('#link-url').value=link.getAttribute('href')||'';
  const field=element.closest('input:not(.honeypot),textarea');$('#placeholder-field').hidden=!field;
  if(field)$('#placeholder').value=field.placeholder;
  const block=findBlock(element);$('#block-actions').hidden=!block;$('#category-field').hidden=!block?.matches('.project-card');if(block?.matches('.project-card'))$('#project-category').value=block.dataset.category;
}
function findBlock(element) {return element?.closest('.project-card,.journal-card,.skill-group,.timeline article,.article-body section');}
function prepareEditor(doc) {
  doc.querySelector('#main-nav').dataset.collapsible='true';
  const style=doc.createElement('style');style.id='editor-chrome';style.textContent='[contenteditable]{outline:1px dashed transparent;cursor:text}[contenteditable]:hover{outline-color:#bba4f5}.editor-selected{outline:2px solid #bba4f5!important;outline-offset:4px}.reveal-ready{opacity:1!important;transform:none!important}html{scroll-behavior:auto!important}';doc.head.append(style);
  const candidates=[...doc.querySelectorAll('main h1,main h2,main h3,main h4,main p,main li,main figcaption,main label,.site-header a,.site-footer a,.site-footer p,main .tags span,main .about-facts strong,main .about-facts span,main .contact-details span,main .project-art-copy span')];
  candidates.filter(element=>!element.closest('[aria-hidden=true]')).forEach(element=>{if(!candidates.some(other=>other!==element && other.contains(element)))element.setAttribute('contenteditable','true');});
  doc.addEventListener('paste',event=>{
    if(!event.target.closest('[contenteditable]'))return;
    event.preventDefault();const text=event.clipboardData.getData('text/plain');const selection=doc.getSelection();if(!selection.rangeCount)return;const range=selection.getRangeAt(0);range.deleteContents();const node=doc.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);capture();
  });
  doc.addEventListener('click',event=>{
    if(event.target.closest('a,button,summary,input,textarea'))event.preventDefault();
    if(event.target.closest('#menu-btn')){doc.querySelector('#main-nav').classList.toggle('is-open');return;}
    const target=event.target.closest('img,a,input:not(.honeypot),textarea,[contenteditable],h1,h2,h3,h4,p,span,section,article');
    if(target)showSelection(target);
  });
  doc.addEventListener('submit',event=>event.preventDefault());
  doc.addEventListener('input',event=>{if(event.target.closest('[contenteditable]')){try{capture();if(selected)$('#selected-text').value=selected.textContent;}catch(error){status(error.message);}}});
}
async function loadFrame() {
  loading=true;selected=null;$('#selected-name').textContent='Click something in the page';
  for(const selector of ['#text-field','#image-fields','#link-field','#placeholder-field','#block-actions'])$(selector).hidden=true;
  $('#editor-frame').title=`${selectedPage()} — ${preview?'preview':'content editor'}`;
  iframe.src=`${selectedPage()}.html?editor=1&view=${preview?'preview':'edit'}&v=${Date.now()}`;
}
iframe.addEventListener('load',()=>{
  if(!session || !iframe.contentDocument?.querySelector('main'))return;
  try{
    const doc=iframe.contentDocument;if(doc.querySelector('main').dataset.page!==selectedPage())return;loadedPage=selectedPage();
    if(draft.pages[selectedPage()])applyPage(doc,draft.pages[selectedPage()]);
    doc.querySelector('main').dataset.page=selectedPage();
    applyColors(doc,draft.colors);
    $('#page-title').value=doc.title;$('#page-description').value=doc.querySelector('meta[name=description]').content;
    if(preview){const script=doc.createElement('script');script.src='assets/script.js';doc.body.append(script);}
    else prepareEditor(doc);
    $('#new-item-tools').hidden=selectedPage()!=='index';for(const name of ['accentDark','accentLight'])if(draft.colors?.[name])$(`[name=${name}]`).value=draft.colors[name];
    loading=false;
  }catch(error){loading=false;status(error.message);}
});
$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!event.target.reportValidity())return;
  const button=$('#login-button');button.disabled=true;loginStatus('Checking your account…');
  try{
    const authenticated=await signIn($('#admin-username').value.trim(),$('#admin-password').value);
    const published=await loadSite(fetch,authenticated.token);
    session=authenticated;base=published;draft=structuredClone(published.site);
    $('#admin-password').value='';$('#login-panel').hidden=true;$('#editor-app').hidden=false;
    $('#admin-account').textContent=$('#admin-username').value.trim();
    try{$('#restore-draft').hidden=!localStorage.getItem('portfolio:editor-draft');}catch{$('#restore-draft').hidden=true;}
    status('Signed in. Select a page, then click text or an image to edit.');await loadFrame();
  }catch(error){session=null;loginStatus(error.message);}
  finally{$('#admin-password').value='';button.disabled=false;}
});
$('#page-select').addEventListener('change',()=>{if(!preview)capture();loadFrame();});
$('#preview-toggle').addEventListener('click',()=>{if(!preview)capture();preview=!preview;$('#preview-toggle').textContent=preview?'Back to editing':'Preview draft';loadFrame();});
$('#page-title').addEventListener('change',()=>{iframe.contentDocument.title=$('#page-title').value;capture();});
$('#page-description').addEventListener('change',()=>{iframe.contentDocument.querySelector('meta[name=description]').content=$('#page-description').value;capture();});
$('#selected-text').addEventListener('change',()=>{if(selected){selected.textContent=$('#selected-text').value;try{capture();}catch(error){status(error.message);}}});
$('#image-alt').addEventListener('change',()=>{if(selected?.matches('img')){selected.alt=$('#image-alt').value;capture();}});
$('#image-url').addEventListener('change',()=>{if(!selected?.matches('img'))return;const value=$('#image-url').value.trim();if(!safeUrl(value,'src')){status('Use an HTTPS image URL or a relative image path.');return;}selected.src=value;capture();});
$('#link-url').addEventListener('change',()=>{const link=selected?.closest('a');if(!link)return;const value=$('#link-url').value.trim();if(!safeUrl(value)){status('Use HTTPS, an email/phone link, or a relative path.');return;}link.setAttribute('href',value);capture();});
$('#placeholder').addEventListener('change',()=>{if(selected?.matches('input,textarea')){selected.placeholder=$('#placeholder').value;capture();}});
$('#image-file').addEventListener('change',async event=>{
  const image=selected;const file=event.target.files[0];if(!file || !image?.matches('img'))return;
  if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type) || file.size>300000){status('Choose a PNG, JPEG, WebP, or GIF under 300 KB, or paste an image URL.');return;}
  const reader=new FileReader();reader.onload=()=>{if(safeUrl(reader.result,'src')){image.src=reader.result;$('#image-url').value='';capture();}};reader.readAsDataURL(file);event.target.value='';
});
$('#block-actions').addEventListener('click',event=>{
  const action=event.target.closest('[data-block-action]')?.dataset.blockAction;const block=findBlock(selected);if(!action || !block)return;
  if(action==='duplicate'){
    const clone=block.cloneNode(true);const suffix=String(Date.now());
    clone.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));clone.removeAttribute('id');clone.querySelectorAll('.editor-selected').forEach(element=>element.classList.remove('editor-selected'));
    clone.querySelectorAll('[data-like]').forEach(element=>{element.dataset.like='note-'+suffix;const count=element.querySelector('.like-count');if(count)count.textContent='0';element.setAttribute('aria-pressed','false');});
    clone.classList.remove('editor-selected');block.after(clone);showSelection(clone.querySelector('[contenteditable]')||clone);
  }
  if(action==='up'&&block.previousElementSibling)block.previousElementSibling.before(block);
  if(action==='down'&&block.nextElementSibling)block.nextElementSibling.after(block);
  if(action==='remove'){
    if(block.id==='education' || block.querySelector('#education')){status('Keep the education anchor; you can edit its text and details.');return;}
    if(!confirm('Remove this item from the draft? The live page stays unchanged until you publish.'))return;
    block.remove();selected=null;$('#selected-name').textContent='Item removed';$('#block-actions').hidden=true;
  }
  try{capture();}catch(error){status(error.message);}
});
for(const name of ['accentDark','accentLight'])$(`[name=${name}]`).addEventListener('change',event=>{draft.colors||={};draft.colors[name]=event.target.value;applyColors(iframe.contentDocument,draft.colors);remember();});
$('#save-draft').addEventListener('click',()=>{if(!preview)capture();else remember();});
$('#restore-draft').addEventListener('click',()=>{try{const restored=validateSite(JSON.parse(localStorage.getItem('portfolio:editor-draft')));draft=restored;dirty=true;loadFrame();status('Device draft restored. The published site is unchanged.');}catch(error){status('The saved device draft could not be restored: '+error.message);}});
$('#export-draft').addEventListener('click',()=>{try{if(!preview)capture();validateSite(draft);const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='leonard-portfolio-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Draft exported.');}catch(error){status(error.message);}});
$('#import-draft').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>backend.maxPayload)throw new Error('Draft file is too large.');const imported=validateSite(JSON.parse(await file.text()));draft=imported;remember();loadFrame();}catch(error){status('Could not import draft: '+error.message);}finally{event.target.value='';}});
$('#publish').addEventListener('click',async()=>{
  const button=$('#publish');button.disabled=true;
  try{if(loading)throw new Error('Wait for the selected page to finish loading.');if(!preview)capture();validateSite(draft);const version=editVersion;const publishedSnapshot=structuredClone(draft);status('Publishing…');const next=await publishSite(publishedSnapshot,session,base);base={...base,...next,site:publishedSnapshot};dirty=editVersion!==version;status(dirty?'Published the saved snapshot. Newer edits remain in your draft.':'Published successfully. New visits to your portfolio will use these changes.');}
  catch(error){status(error.message);}
  finally{button.disabled=false;}
});
$('#sign-out').addEventListener('click',()=>{
  if(dirty && !confirm('Sign out? Your device draft is saved; unpublished edits are not live.'))return;
  session=null;base=null;selected=null;draft={schema:1,pages:{},colors:{}};iframe.src='about:blank';$('#editor-app').hidden=true;$('#login-panel').hidden=false;$('#admin-password').value='';dirty=false;loginStatus('Signed out.');
});
window.addEventListener('beforeunload',event=>{if(session&&dirty){event.preventDefault();event.returnValue='';}});

$('#project-category').addEventListener('change',()=>{const block=findBlock(selected);if(block?.matches('.project-card')){block.dataset.category=$('#project-category').value;capture();}});
$('#reset-page').addEventListener('click',()=>{if(!confirm('Discard this page’s draft edits and restore its published version?'))return;const name=selectedPage();if(base.site.pages[name])draft.pages[name]=structuredClone(base.site.pages[name]);else delete draft.pages[name];remember();loadFrame();});
$('#add-item').addEventListener('click',async()=>{
 if(loading||preview||selectedPage()!=='index'){status('Open the homepage in editing mode to add an item.');return;}
 try{const choices={project:['.project-card:not(.featured)','.projects-grid'],journal:['.journal-card','.journal-grid'],skill:['.skill-group','.skills-grid'],journey:['.timeline article','.timeline']};const [selector,parent]=choices[$('#new-item-type').value];const doc=iframe.contentDocument;let template=doc.querySelector(selector);if(!template){const result=await fetch('index.html',{cache:'no-store'});if(!result.ok)throw new Error('The content template could not be loaded.');template=new DOMParser().parseFromString(await result.text(),'text/html').querySelector(selector);}const clone=doc.importNode(template,true);clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));clone.querySelectorAll('[data-like]').forEach(el=>{el.dataset.like='note-'+Date.now();el.setAttribute('aria-pressed','false');el.querySelector('.like-count').textContent='0';});doc.querySelector(parent).append(clone);capture();loadFrame();status('Item added to the draft. Click it in the page to edit its content.');}catch(error){status(error.message);}
});

$('#password-reset').addEventListener('click',async()=>{const email=$('#admin-username');if(!email.reportValidity())return;const button=$('#password-reset');button.disabled=true;loginStatus('Requesting a password setup email…');try{await requestPasswordReset(email.value.trim());loginStatus('If an account matches this email, check your inbox and spam folder for a link to set your password.');}catch(error){loginStatus(error.message);}finally{button.disabled=false;}});
