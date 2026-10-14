/* Public appearance is selected by the owner; visitors have no theme controls. */
(() => {
  'use strict';
  const root = document.documentElement;
  const script = document.currentScript;
  const base = new URL('../', script.src);
  const themes = new Set(['original', 'fall', 'christmas']);
  const endpoint = 'https://echocraft-music-admin.echocraft-aimusic.workers.dev/api/site-theme';
  let refreshing = false;
  function apply(theme) {
    if (!themes.has(theme)) return;
    root.dataset.siteTheme = theme;
    document.querySelectorAll('.home-logo img').forEach(img => {
      if (!img.dataset.originalSrc) img.dataset.originalSrc = img.getAttribute('src');
      img.src = theme === 'original' ? img.dataset.originalSrc : new URL('assets/themes/gold-logo.png', base).href;
    });
    const nativity = document.getElementById('seasonalNativity');
    if (nativity) nativity.hidden = theme !== 'christmas';
  }
  async function read(url) {
    const response = await fetch(url, {cache: 'no-store', signal: AbortSignal.timeout(6000)});
    if (!response.ok) throw new Error('Appearance is unavailable');
    const data = await response.json();
    if (!themes.has(data.theme)) throw new Error('Unknown appearance');
    return data.theme;
  }
  async function refresh() {
    if (refreshing || document.hidden) return;
    refreshing = true;
    try {
      apply(await read(endpoint));
    } catch {
      // Static fallback keeps the established site usable during a backend outage.
      // Retain an already-applied seasonal theme instead of resetting it on failure.
      if (!root.dataset.siteTheme) {
        try { apply(await read(new URL('site-settings.json', base))); }
        catch { apply('original'); }
      }
    } finally { refreshing = false; }
  }
  refresh();
  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', refresh);
})();
