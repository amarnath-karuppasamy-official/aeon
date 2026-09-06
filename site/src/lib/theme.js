// Manual dark/light toggle, layered on top of the prefers-color-scheme-aware
// CSS defaults. A nice-to-have, not load-bearing — every read/write is
// guarded so it degrades silently (falls back to the CSS media-query
// default) anywhere localStorage isn't available, including inside the
// Happy DOM environment @aeon-framework/ssr/ssg prerenders through.
const KEY = 'aeon-site-theme';

export function initTheme() {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch {
    // localStorage unavailable (SSR, privacy mode, ...) — CSS media-query default applies.
  }
}

export function toggleTheme() {
  try {
    const current =
      document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    window.localStorage.setItem(KEY, next);
  } catch {
    // best-effort only
  }
}
