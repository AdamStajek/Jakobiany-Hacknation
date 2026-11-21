import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const url = process.env.WODO_URL || 'http://127.0.0.1:8080';
const engine = process.env.WODO_BROWSER || 'chromium';
const capture = process.env.WODO_CAPTURE;
const output = resolve('../submission/.capture', engine);
await mkdir(output, { recursive: true });
const browser = await {chromium, firefox, webkit}[engine].launch({
  ...(process.env.WODO_BROWSER_PATH ? {executablePath: process.env.WODO_BROWSER_PATH} : {}),
  ...(engine === 'chromium' ? {args: ['--no-sandbox']} : {}),
});
const context = await browser.newContext({
  viewport: {width: 1360, height: 920}, locale: 'pl-PL', reducedMotion: 'reduce',
  ...(capture ? {recordVideo: {dir: output, size: {width: 1360, height: 920}}} : {}),
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const pause = async (ms = 1800) => { if (capture) await page.waitForTimeout(ms); };
const matches = '301103_2.0009.549/7';

try {
  await page.goto(url, {waitUntil:'domcontentloaded'});
  await page.getByRole('heading', {name:'Mapa działek'}).waitFor();
  await page.getByRole('option', {name:'Ziemniak'}).waitFor({state:'attached'});
  await pause(3500);
  const input = page.getByLabel('Identyfikator działki');
  if (capture) await input.pressSequentially(matches, {delay:90});
  else await input.fill(matches);
  await pause();
  await page.getByRole('button', {name:'Szukaj'}).click();
  await page.locator('.selected').getByText(matches, {exact:true}).waitFor({timeout:15000});
  await page.locator('.leaflet-overlay-pane path').waitFor();
  await page.getByLabel('Rodzaj uprawy').selectOption('potato');
  await page.getByLabel('Data analizy').fill('2024-07-05');
  if (capture) {
    await page.locator('.leaflet-tile-loaded').first().waitFor({timeout:6000}).catch(() => {});
    await page.screenshot({path:resolve(output,'map.png')});
    await pause(3500);
  }
  const choice = page.getByRole('button', {name:'Analizuj gospodarowanie wodą'});
  await choice.click();
  await page.getByRole('heading', {name:'Stan wody na Twojej działce'}).waitFor({timeout:44000}).catch(async error => {
    console.error('visible error:', await page.locator('[role=alert]').allTextContents());
    throw error;
  });
  await page.getByRole('heading', {name:'Historia suszy'}).waitFor();
  assert(await page.locator('.timeline .year').count() >= 7);
  if (capture) await page.screenshot({path:resolve(output,'result.png')});
  await page.getByRole('heading', {name:'Co możesz zrobić?'}).scrollIntoViewIfNeeded();
  const why = page.getByText('Dlaczego na tej działce?', {exact:true}).first();
  await why.click();
  assert(await page.locator('.recommendation details[open] p').count() >= 3);
  if (capture) {
    await page.screenshot({path:resolve(output,'recommendations.png')});
    await pause(6500);
  }
  await page.getByRole('heading', {name:'Historia suszy'}).scrollIntoViewIfNeeded();
  await pause(5000);
  const download = page.waitForEvent('download');
  await page.getByRole('link', {name:'Pobierz PDF'}).click();
  const file = await download;
  const downloaded = resolve(output, 'browser-report.pdf');
  await file.saveAs(downloaded);
  assert((await readFile(downloaded)).subarray(0,4).equals(Buffer.from('%PDF')));
  await page.getByRole('heading', {name:'Stan wody na Twojej działce'}).scrollIntoViewIfNeeded();
  await pause(3800);
  if (!capture) {
    const now = await (await context.request.get(url + '/health')).json();
    await input.fill('280104_5.0006.98/2');
    await page.getByRole('button', {name:'Szukaj'}).click();
    await page.locator('.selected').getByText('280104_5.0006.98/2', {exact:true}).waitFor({timeout:15000});
    await page.getByLabel('Rodzaj uprawy').selectOption('wheat');
    await page.getByLabel('Data analizy').fill(now.analysis_date_max);
    await choice.click();
    await page.getByRole('heading', {name:'Stan wody na Twojej działce'}).waitFor({timeout:44000});
    assert((await page.locator('.report-heading').innerText()).includes(now.analysis_date_max));
    await input.fill('!!!');
    await page.getByRole('button', {name:'Szukaj'}).click();
    await page.getByRole('alert').getByText(/Podaj identyfikator/).waitFor();
    await page.setViewportSize({width:390,height:844});
    const overflow = await page.evaluate(() => {
      if (document.documentElement.scrollWidth <= innerWidth) return [];
      return [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1)
        .filter(el => !el.closest('.map,.timeline')).map(el => el.className).slice(0,10);
    });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify(overflow));
  }
  assert.deepEqual(errors, []);
  console.log(engine, capture ? 'recorded historical analysis and PDF export' : 'historical/current, error, mobile width and PDF export passed');
} finally {
  const video = page.video();
  await context.close();
  if (capture && video) {
    await video.saveAs(resolve(output,'demo.webm'));
    await video.delete();
  }
  await browser.close();
}
