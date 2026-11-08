import { loadSite, applyPage, applyColors } from './content-store.js';

const editingFrame = window.parent !== window
  && new URLSearchParams(location.search).has('editor');

if (!editingFrame) {
  try {
    const { site } = await loadSite();
    const name = document.querySelector('main').dataset.page || 'index';

    if (site.pages[name]) applyPage(document, site.pages[name]);
    applyColors(document, site.colors);
  } catch {
    // Keep the complete bundled portfolio if saved content is unavailable.
  }

  // Older Firebase snapshots still reference the replaced Word CV.
  // Update both its destination and suggested download filename.
  for (const link of document.querySelectorAll('a[download]')) {
    const href = link.getAttribute('href');

    if (href === 'cv/MyCV.docx' || href === 'cv/LEONARD DACPANO CV.pdf') {
      link.setAttribute('href', 'cv/LEONARD DACPANO CV.pdf');
      link.setAttribute('download', 'Leonard-Dacpano-CV.pdf');

      const label = link.querySelector('.sr-only');
      if (label) {
        label.textContent = label.textContent.replace(/Word document/g, 'PDF');
      }
    }
  }

  const runtime = document.createElement('script');
  runtime.src = new URL('./script.js', import.meta.url).href;
  document.body.append(runtime);
}
