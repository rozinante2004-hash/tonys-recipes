#!/usr/bin/env node
/**
 * Draw the TEST copy's app icons (v36.73) from the real ones, so the two apps
 * cannot be confused on a home screen or in a browser tab.
 *
 *     node tools/make-test-icons.mjs        (needs Playwright; run by hand, once)
 *
 * The brown background becomes teal, and an orange band — the colour of the
 * "TEST COPY" ribbon — says TEST across the bottom. Writes icons/test/*.png,
 * which are committed; tools/build.js puts them in place of icons/*.png when it
 * builds the test copy, and gives the tab icon (favicon) the same teal.
 * Re-run only if the real icons change.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envs = JSON.parse(fs.readFileSync(path.join(repo, 'tools', 'environments.json'), 'utf8'));
const brand = envs.test.brand;
fs.mkdirSync(path.join(repo, 'icons', 'test'), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [192, 512]) {
  const src = fs.readFileSync(path.join(repo, 'icons', 'icon-' + size + '.png')).toString('base64');
  const out = await page.evaluate(async ({ src, size, brand }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const from = hex(brand.iconFrom), to = hex(brand.color);
    // Recolour the background, and its anti-aliased edges in proportion.
    const im = x.getImageData(0, 0, size, size), px = im.data;
    for (let i = 0; i < px.length; i += 4) {
      const d = Math.hypot(px[i] - from[0], px[i + 1] - from[1], px[i + 2] - from[2]);
      const w = Math.max(0, 1 - d / 90);
      for (let k = 0; k < 3; k++) px[i + k] = Math.round(px[i + k] + w * (to[k] - from[k]));
    }
    x.putImageData(im, 0, 0);
    // The band, inside the circle only.
    x.save();
    x.beginPath(); x.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); x.clip();
    const top = size * 0.66, h = size * 0.2;
    x.fillStyle = brand.band; x.fillRect(0, top, size, h);
    x.fillStyle = '#FFFFFF';
    x.font = '800 ' + Math.round(h * 0.72) + 'px "DejaVu Sans", Arial, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('TEST', size / 2, top + h / 2 + h * 0.04);
    x.restore();
    return c.toDataURL('image/png').split(',')[1];
  }, { src, size, brand });
  fs.writeFileSync(path.join(repo, 'icons', 'test', 'icon-' + size + '.png'), Buffer.from(out, 'base64'));
  console.log('wrote icons/test/icon-' + size + '.png');
}
await browser.close();
