import { loadSite, applyPage, applyColors } from './content-store.js';
const editingFrame = window.parent !== window && new URLSearchParams(location.search).has('editor');
if (!editingFrame) {
  // The original static HTML remains a complete fallback if Firebase is offline.
  try { const {site}=await loadSite();const name=document.querySelector('main').dataset.page || 'index';if(site.pages[name])applyPage(document,site.pages[name]);applyColors(document,site.colors); } catch { /* Keep the local source content. */ }
  const runtime=document.createElement('script');runtime.src=new URL('./script.js',import.meta.url).href;document.body.append(runtime);
}
