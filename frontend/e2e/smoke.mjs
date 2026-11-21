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
  
  await pause(3500);
  const input = page.getByLabel('Identyfikator działki');
  const searchButton = page.getByRole('button', {name:'Szukaj'});
  const selectParcel = async id => {
    if (capture) { await input.fill(''); await input.pressSequentially(id, {delay:90}); } else await input.fill(id);
    await pause();
    await searchButton.click();
    await page.getByRole('status').getByText(id, {exact:true}).waitFor({timeout:15000});
  };
  const chooseCrop = async label => {
    await page.getByLabel('Rodzaj uprawy').click();
    await page.getByRole('option', {name:label, exact:true}).click();
  };
  const analyze = page.getByRole('button', {name:'Analizuj gospodarowanie wodą'});
  const heading = page.getByRole('heading', {name:'Stan wody na Twojej działce'});

  await page.locator('.maplibregl-canvas').waitFor();
  await selectParcel(matches);
  await chooseCrop('Ziemniak');
  await page.getByLabel('Data analizy').fill('2024-07-05');
  if (capture) {
    await page.waitForTimeout(3000);
    await page.screenshot({path:resolve(output,'map.png')});
    await pause(3500);
  }
  await analyze.click();
  await heading.waitFor({timeout:60000}).catch(async error => {
    console.error('visible error:', await page.getByRole('alert').allTextContents());
    throw error;
  });
  await page.getByRole('heading', {name:'Opad i zapotrzebowanie uprawy'}).waitFor();
  await page.locator('[echarts] canvas').first().waitFor();
  assert(await page.locator('[echarts] canvas').count() >= 3, 'wykresy');
  assert(await page.getByText(/Ryzyko niedoboru wody/).isVisible());
  if (capture) await page.screenshot({path:resolve(output,'result.png')});
  await page.getByRole('heading', {name:'Co możesz zrobić?'}).scrollIntoViewIfNeeded();
  await page.getByRole('button', {name:'Dlaczego na tej działce?'}).first().click();
  await page.getByRole('heading', {name:'Dowody'}).waitFor();
  if (capture) {
    await page.screenshot({path:resolve(output,'recommendations.png')});
    await pause(6500);
  }
  await page.keyboard.press('Escape');
  await page.getByRole('heading', {name:'Skąd pochodzą dane?'}).scrollIntoViewIfNeeded();
  await pause(5000);
  const download = page.waitForEvent('download');
  await page.getByRole('link', {name:'Pobierz PDF'}).click();
  const file = await download;
  const downloaded = resolve(output, 'browser-report.pdf');
  await file.saveAs(downloaded);
  assert((await readFile(downloaded)).subarray(0,4).equals(Buffer.from('%PDF')));
  await heading.scrollIntoViewIfNeeded();
  await pause(3800);
  if (!capture) {
    const reportUrl = page.url();
    assert.match(reportUrl, /\/dzialka\/.+\/analiza\/[a-f0-9]{32}$/, 'adres raportu');
    await page.goto(reportUrl, {waitUntil:'domcontentloaded'});
    await heading.waitFor({timeout:30000});
    assert(await page.getByText('Pokaż dane wykresu').count() >= 3, 'tabele danych wykresów');
    await page.getByRole('link', {name:'Paszport działki'}).click();
    await page.getByRole('heading', {name:/Paszport działki/}).waitFor();
    await page.goto(reportUrl.replace(/\/analiza\/.*$/, ''), {waitUntil:'domcontentloaded'});
    await page.getByRole('status').getByText(matches, {exact:true}).waitFor({timeout:15000});
    const themeButton = page.getByRole('button', {name:/Motyw/});
    await themeButton.click();
    const light = await page.evaluate(() => !document.documentElement.classList.contains('app-dark'));
    await themeButton.click();
    assert(light && await page.evaluate(() => document.documentElement.classList.contains('app-dark')), 'przełącznik motywu');
    await page.getByRole('button', {name:'Narysuj granicę'}).click();
    await page.getByText(/Klikaj kolejne rogi/).waitFor();
    await page.getByRole('button', {name:'Anuluj rysowanie'}).click();
    const now = await (await context.request.get(url + '/health')).json();
    await selectParcel('280104_5.0006.98/2');
    await chooseCrop('Pszenica ozima');
    await page.getByLabel('Data analizy').fill(now.analysis_date_max);
    await analyze.click();
    await heading.waitFor({timeout:60000});
    assert((await page.locator('#wynik + p').innerText()).includes(now.analysis_date_max));
    await input.fill('!!!');
    await searchButton.click();
    await page.getByRole('alert').getByText(/Podaj identyfikator/).waitFor();
    await page.setViewportSize({width:390,height:844});
    const overflow = await page.evaluate(() => {
      if (document.documentElement.scrollWidth <= innerWidth) return [];
      return [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1)
        .filter(el => !el.closest('.p-datatable-table-container,.maplibregl-map')).map(el => el.className).slice(0,10);
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
