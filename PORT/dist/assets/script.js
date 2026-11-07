'use strict';
// No framework or third-party runtime is required for core navigation and content.
(() => {
  const root = document.documentElement;
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* Optional persistence. */ } }
  };
  const themeButton = document.querySelector('#theme-toggle');
  const updateThemeLabel = () => themeButton?.setAttribute('aria-label', `Switch to ${root.dataset.theme === 'dark' ? 'light' : 'dark'} theme`);
  updateThemeLabel();
  themeButton?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    storage.set('theme', root.dataset.theme);
    updateThemeLabel();
  });
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  const menuButton = document.querySelector('#menu-btn');
  const nav = document.querySelector('#main-nav');
  if (menuButton && nav) {
    nav.dataset.collapsible = 'true';
    const closeMenu = () => { nav.classList.remove('is-open'); menuButton.setAttribute('aria-expanded', 'false'); };
    menuButton.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      menuButton.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
    document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) { closeMenu(); menuButton.focus(); }
    });
    const mobile = matchMedia('(max-width: 620px)');
    mobile.addEventListener('change', closeMenu);
  }

  const filters = document.querySelector('.filters');
  if (filters) {
    filters.hidden = false;
    const cards = [...document.querySelectorAll('.project-card')];
    const total = filters.querySelector('[data-filter=all] span');if(total)total.textContent=String(cards.length).padStart(2,'0');
    document.querySelector('#filter-status').textContent=String(cards.length).padStart(2,'0')+' PROJECT'+(cards.length===1?'':'S');
    filters.addEventListener('click', event => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      filters.querySelectorAll('button').forEach(item => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-pressed', String(item === button));
      });
      cards.forEach(card => { card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter; });
      const count = cards.filter(card => !card.hidden).length;
      document.querySelector('#filter-status').textContent = `${String(count).padStart(2, '0')} PROJECT${count === 1 ? '' : 'S'}`;
    });
  }

  const dialog = document.querySelector('#project-dialog');
  if (dialog && typeof dialog.showModal === 'function') {
    let opener;
    document.querySelectorAll('.project-details summary').forEach(summary => {
      summary.addEventListener('click', event => {
        event.preventDefault();
        opener = summary;
        const content = document.querySelector('#dialog-content');
        content.replaceChildren(...[...summary.nextElementSibling.children].map(node => node.cloneNode(true)));
        content.querySelector('h3').id = 'dialog-title';
        dialog.showModal();
        document.body.classList.add('dialog-open');
      });
    });
    dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => { document.body.classList.remove('dialog-open'); opener?.focus(); });
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } });
    }, { threshold: 0.08 });
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.project-card,.skill-group,.journal-card,.about-copy').forEach(el => { el.classList.add('reveal-ready'); observer.observe(el); });
    }
    const navObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        document.querySelectorAll('#main-nav a').forEach(link => {
          if (link.getAttribute('href') === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -55% 0px' });
    document.querySelectorAll('main > section[id]').forEach(el => navObserver.observe(el));
  }

  // Retain Formspree delivery; only report success after the service accepts it.
  const form = document.querySelector('#contact-form');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (form.elements._gotcha.value) return;
    const button = form.querySelector('[type=submit]');
    const status = document.querySelector('#form-status');
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = 'Sending your message…';
    try {
      const response = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Message not accepted');
      status.textContent = 'Thanks for reaching out. Your message has been sent.';
      form.reset();
    } catch {
      status.textContent = 'Delivery could not be confirmed. Your message is still here. Please email nhaddacpano@gmail.com directly.';
    } finally { button.disabled = false; }
  });

  // The recovered Firebase database currently denies reads. Preserve shared
  // counters when permitted, using ETag compare-and-swap to avoid lost updates.
  // A failed remote read/write leaves a clearly-labelled local heart instead.
  const likeButtons = [...document.querySelectorAll('[data-like]')];
  const database = 'https://leonard-51e3a-default-rtdb.firebaseio.com/blogLikes';
  const readCount = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  const syncStatus = () => {
    const status = document.querySelector('#like-status');
    if (status) status.textContent = likeButtons.every(button => button.dataset.shared === 'true')
      ? 'Shared appreciation counts. Your heart is remembered on this device.'
      : 'Hearts are saved on this device when shared likes are unavailable.';
  };
  likeButtons.forEach(button => {
    const id = button.dataset.like;
    const key = `portfolio:like:${id}`;
    const count = button.querySelector('.like-count');
    let liked = storage.get(key) === 'true';
    let remoteCount = 0;
    let shared = false;
    const paint = () => {
      button.setAttribute('aria-pressed', String(liked));
      button.querySelector('span').textContent = liked ? '♥' : '♡';
      count.textContent = String(shared ? remoteCount : Number(liked));
      button.title = shared ? 'Shared appreciation count' : 'Heart saved on this device';
    };
    button.hidden = false;
    paint();
    const remoteRead = fetch(`${database}/${id}.json`, { signal: AbortSignal.timeout(4000) })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Likes unavailable')))
      .then(value => { remoteCount = readCount(value); shared = true; button.dataset.shared = 'true'; paint(); syncStatus(); })
      .catch(() => { shared = false; button.dataset.shared = 'false'; paint(); syncStatus(); });
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      button.disabled = true;
      try {
        await remoteRead;
        if (shared) {
          try {
            for (let attempt = 0; attempt < 3; attempt++) {
              const current = await fetch(`${database}/${id}.json`, { headers: { 'X-Firebase-ETag': 'true' }, signal: AbortSignal.timeout(4000) });
              if (!current.ok || !current.headers.get('ETag')) throw new Error('Counter unavailable');
              const value = readCount(await current.json());
              const next = Math.max(0, value + (liked ? -1 : 1));
              const result = await fetch(`${database}/${id}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': current.headers.get('ETag') }, body: JSON.stringify(next), signal: AbortSignal.timeout(4000) });
              if (result.status === 412 && attempt < 2) continue;
              if (!result.ok) throw new Error('Counter update unavailable');
              remoteCount = next;
              break;
            }
          } catch { shared = false; button.dataset.shared = 'false'; }
        }
        liked = !liked;
        storage.set(key, String(liked));
        paint();
        syncStatus();
      } finally { button.disabled = false; }
    });
  });
})();
