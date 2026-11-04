import type { AppContainer } from '../service-provider/index.js';

const HIGHLIGHTED = ['application_url', 'application_language', 'application_timezone', 'application_date_format', 'application_time_format'];

/** Escape text for an HTML text/attribute context. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Placeholder home page (stands for `DashboardController::show`) listing the application settings. */
export async function renderHome(container: AppContainer): Promise<string> {
  const settings = await container.get('configModel').getAll();
  const names = Object.keys(settings).sort((a, b) => {
    const ia = HIGHLIGHTED.indexOf(a);
    const ib = HIGHLIGHTED.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });

  const rows = names
    .map((name) => `<tr><th scope="row">${escapeHtml(name)}</th><td>${escapeHtml(settings[name])}</td></tr>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Kanboard</title>
</head>
<body>
<h1>Kanboard</h1>
<p>Version ${escapeHtml(container.get('config').APP_VERSION)}</p>
<h2>Application settings</h2>
<table>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>
`;
}
