// Visual smoke test: node tools/screenshot.mjs [outDir]  (serves the folder itself)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'tools', 'shots');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  try {
    const p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
const shot = async (n) => (await page.waitForTimeout(450), page.screenshot({ path: join(out, `${n}.png`) }));
const overflow = async (n) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  if (w > 390) errors.push(`${n}: horizontal overflow ${w}px`);
};
await shot('1-title'); await overflow('title');
await page.click('text=Play');
await shot('2-select'); await overflow('select');
await page.click('[data-a=start]');
await shot('3-help');
await page.click('.modal [data-a=close]');
await shot('4-board'); await overflow('board');
await page.click('.cell.target >> nth=0');
await shot('5-cards'); await overflow('cards');
await page.click('.card:not(.cant) >> nth=0').catch(() => page.click('[data-a=closet]'));
await shot('6-place');
await page.click('[data-a=place]');
await shot('7-placed');
// Let the bot-like loop play to the end through the UI hooks.
for (let i = 0; i < 200; i++) {
  const phase = await page.evaluate(() => window.__floorplan.ui.run?.phase);
  if (!phase || phase === 'won' || phase === 'lost') break;
  if (phase === 'door') await page.click((await page.$('.cell.target:not(.locked)')) ? '.cell.target:not(.locked) >> nth=0' : '.cell.target >> nth=0');
  else if (phase === 'card') { if (await page.$('.card:not(.cant)')) await page.click('.card:not(.cant) >> nth=0'); else if (await page.$('[data-a=closet]')) await page.click('[data-a=closet]'); else await page.click('[data-a=reroll]'); }
  else if (phase === 'place') await page.click('[data-a=place]');
  else if (phase === 'shop') { await shot('8-shop'); await page.click('[data-a=leave]'); }
  else if (phase === 'heirloom') { await shot('8-heirloom'); await page.click('[data-a=heir] >> nth=0'); }
}
await shot('9-result'); await overflow('result');
if (await page.$('[data-a=keep]')) { await page.click('[data-a=keep] >> nth=0'); await shot('9b-kept'); }
await page.click('[data-a=resultBoard]').catch(() => {});
await shot('10-final-board');
await page.click('[data-a=showResult]').catch(() => {});
await page.click('[data-a=goSelect]').catch(() => {});
await page.goto(url);
await page.click('text=Archive');
await shot('11-archive'); await overflow('archive');
await page.click('[data-a=tab][data-id=blueprints]'); await shot('12-blueprints');
await page.click('[data-a=go][data-to=title]'); await page.click('text=New run').catch(() => page.click('text=Play')); await shot('13-select-loadout');
await browser.close();
server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('ok', out);
