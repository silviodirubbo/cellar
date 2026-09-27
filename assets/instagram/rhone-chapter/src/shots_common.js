// Shared Playwright setup for capturing the locally built site: Google Fonts
// is answered with the same families served from local @fontsource files,
// and any other external host is blocked so nothing waits on the network.
const fs = require('fs');
const path = require('path');
// Fonts from the @fontsource npm packages, via FONTSOURCE_DIR or ./node_modules.
const FS = process.env.FONTSOURCE_DIR || path.join(process.cwd(), 'node_modules/@fontsource');
function b64(p) { return fs.readFileSync(p).toString('base64'); }
function fontCss() {
  const faces = [];
  for (const [w, s] of [[300, 'normal'], [400, 'normal'], [300, 'italic'], [400, 'italic']])
    faces.push(`@font-face{font-family:'Cormorant Garamond';font-style:${s};font-weight:${w};font-display:block;src:url(data:font/woff2;base64,${b64(`${FS}/cormorant-garamond/files/cormorant-garamond-latin-${w}-${s}.woff2`)}) format('woff2');}`);
  for (const w of [300, 400])
    faces.push(`@font-face{font-family:'DM Mono';font-style:normal;font-weight:${w};font-display:block;src:url(data:font/woff2;base64,${b64(`${FS}/dm-mono/files/dm-mono-latin-${w}-normal.woff2`)}) format('woff2');}`);
  return faces.join('\n');
}
async function setup(context) {
  const css = fontCss();
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: css });
    if (u.hostname === '127.0.0.1') return route.continue();
    return route.abort();
  });
}
module.exports = { setup };
