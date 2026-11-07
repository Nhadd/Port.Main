// Apply a saved theme before the stylesheet paints the page. Storage is optional.
try { const saved = localStorage.getItem('theme'); if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved; } catch { /* Private browsing still gets the default theme. */ }
