/**
 * Inline script that runs before hydration to apply the saved theme,
 * preventing the flash-of-wrong-theme on first paint.
 */
export function ThemeScript() {
  const code = `
    try {
      var stored = localStorage.getItem('cabinet-theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var dark = stored ? stored === 'dark' : prefersDark;
      if (dark) document.documentElement.classList.add('dark');
    } catch (_) {}
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
