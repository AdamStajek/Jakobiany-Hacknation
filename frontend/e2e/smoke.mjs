// Test dymny całego przepływu w przeglądarce: wyszukanie działki, klik na mapie, Dane → analiza → raport,
// PDF, widok Prosty/Zaawansowany, link do raportu, nawigacja powłoki. Uruchamia się w dwóch viewportach.
//
// Zmienne: WODO_URL (domyślnie http://127.0.0.1:8080), WODO_BROWSER (chromium|firefox|webkit),
// WODO_VIEWPORTS (np. "mobile" lub "desktop"; domyślnie oba), WODO_SHOTS (katalog na zrzuty ekranu),
// WODO_CAPTURE (nagranie wideo, tryb demonstracyjny), WODO_BROWSER_PATH.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const url = process.env.WODO_URL || 'http://127.0.0.1:8080';
const engine = process.env.WODO_BROWSER || 'chromium';
const capture = process.env.WODO_CAPTURE;
const shots = process.env.WODO_SHOTS ? resolve(process.env.WODO_SHOTS) : null;
const output = resolve('../submission/.capture', engine);
const VIEWPORTS = {mobile: {width: 390, height: 800}, desktop: {width: 1440, height: 900}};
const selected = (process.env.WODO_VIEWPORTS || 'mobile,desktop').split(',').map(v => v.trim()).filter(Boolean);
const matches = '301103_2.0009.549/7';
await mkdir(output, {recursive: true});
if (shots) await mkdir(shots, {recursive: true});

const browser = await {chromium, firefox, webkit}[engine].launch({
  ...(process.env.WODO_BROWSER_PATH ? {executablePath: process.env.WODO_BROWSER_PATH} : {}),
  ...(engine === 'chromium' ? {args: ['--no-sandbox']} : {}),
});

async function run(name) {
  const viewport = VIEWPORTS[name];
  const mobile = name === 'mobile';
  const context = await browser.newContext({
    viewport, locale: 'pl-PL', reducedMotion: 'reduce', acceptDownloads: true,
    ...(capture ? {recordVideo: {dir: output, size: viewport}} : {}),
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Odpowiedzi 4xx/5xx zapisujemy z adresem; błąd walidacji z kroku „!!!” jest oczekiwany i jest odfiltrowywany.
  let expectFailure = false;
  const failedResponses = [];
  page.on('response', r => { if (r.status() >= 400) failedResponses.push(`${r.status()} ${r.request().method()} ${r.url()}${expectFailure ? ' (oczekiwane)' : ''}`); });
  page.on('console', msg => { if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) errors.push('console: ' + msg.text()); });
  const pause = async (ms = 1800) => { if (capture) await page.waitForTimeout(ms); };
  const shot = async step => { if (shots) await page.screenshot({path: resolve(shots, `${name}-${step}.png`)}); };

  // Przełączniki widoków: telefon ma Mapa/Dane/Raport u góry; desktop tylko Mapa/Raport nad prawą stroną.
  const views = page.getByRole('group', {name: mobile ? 'Widok' : 'Mapa lub raport'});
  const goView = label => views.getByRole('button', {name: label, exact: true}).click();
  const isActive = async (label, message) => {
    const button = views.getByRole('button', {name: label, exact: true});
    await button.and(page.locator('[aria-pressed=true]')).waitFor({timeout: 5000}).catch(() => assert.fail(message));
  };
  const searchInput = () => page.locator(mobile ? '#parcel-id-map' : '#parcel-id');
  const searchButton = () => (mobile ? page.locator('app-parcel-picker[variant=search], section[aria-label="Wyszukiwanie działki"]') : page.locator('section[aria-labelledby="picker-title"]'))
    .getByRole('button', {name: 'Szukaj działki'});
  const selectedCard = id => page.getByRole('status').getByText(id, {exact: true}).first();
  const details = page.getByRole('dialog', {name: 'Dodaj informacje o polu'});
  const closeDetails = async () => {
    await details.getByRole('button', {name: 'Gotowe'}).click();
    await details.waitFor({state: 'hidden'});
  };
  const analyze = details.getByRole('button', {name: 'Analizuj', exact: true});
  const heading = page.getByRole('heading', {name: 'Stan wody na Twojej działce'});
  const chooseCrop = async label => {
    await page.locator('#crop').click();
    await page.getByRole('option', {name: label, exact: true}).click();
  };
  const selectParcel = async id => {
    if (mobile) await goView('Mapa');
    await searchInput().fill(id);
    await pause();
    await searchButton().click();
    await selectedCard(id).waitFor({timeout: 20000});
  };
  const noOverflow = async step => {
    const overflow = await page.evaluate(() => {
      if (document.documentElement.scrollWidth <= innerWidth) return [];
      return [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1)
        .filter(el => !el.closest('.p-datatable-table-container,.maplibregl-map')).map(el => el.className).slice(0, 10);
    });
    assert.deepEqual(overflow, [], `${name}/${step}: poziome przewijanie strony`);
  };

  try {
    await page.goto(url + '/sprawdz', {waitUntil: 'domcontentloaded'});
    await page.locator('.maplibregl-canvas').first().waitFor();
    await pause(3000);
    await shot('01-start');

    // Nawigacja powłoki: pasek boczny (desktop) lub dolna nawigacja (telefon).
    const navs = page.getByRole('navigation', {name: 'Nawigacja główna'});
    const nav = navs.locator('visible=true').first();
    assert.equal(await nav.getByRole('link', {name: 'Eksperymenty'}).count(), 0);
    for (const [label, path] of [['Moje pola', /\/pola$/], ['Jak to działa', /\/metody$/], ['Sprawdź pole', /\/sprawdz$/]]) {
      const link = nav.getByRole('link', {name: label});
      await link.click();
      await page.waitForURL(path);
      if (label === 'Jak to działa') {
        const catalog = page.getByRole('region', {name: 'Katalog działań', exact: true});
        const actions = catalog.locator('ol > li');
        const action = actions.filter({hasText: 'Utworzenie trawiastych pasów buforowych'});
        const title = action.getByText('Utworzenie trawiastych pasów buforowych', {exact: true});
        const category = catalog.getByText('Retencja i infrastruktura', {exact: true});
        await category.waitFor();
        assert.equal(await actions.count(), 60);
        assert.equal(await action.getAttribute('value'), '15');
        assert.equal(await catalog.locator('details[open]').count(), 0);
        assert.equal(await title.isVisible(), false);
        await category.press('Enter');
        await title.waitFor();
        assert.equal(await catalog.locator('details[open]').count(), 1);
        await title.press('Enter');
        await action.getByText(/Pas trawy na drodze spływu/).waitFor();
        assert(await action.getByRole('link', {name: /Borin/}).isVisible());
        const conditions = action.getByText(/Rolnik czasami lub często widzi/);
        assert.equal(await conditions.isVisible(), false);
        await action.getByText('Warunki, termin i koszt', {exact: true}).click();
        await conditions.waitFor();
        await action.getByText(/200\s*–\s*320 zł netto za ha pasa/).waitFor();
        assert(await action.getByRole('link', {name: /Grenas/}).isVisible());

        const experiments = page.getByRole('navigation', {name: 'Jak to działa'}).getByRole('link', {name: 'Eksperymenty'});
        await experiments.click();
        await page.waitForURL(/\/metody\/eksperymenty$/);
        await page.getByRole('link', {name: /Wsiąkanie wody/}).click();
        await page.waitForURL(/\/metody\/eksperymenty\/wsiakanie-wody$/);
        assert.equal(await experiments.getAttribute('aria-current'), 'page');
      }
      assert.equal(await link.getAttribute('aria-current'), 'page', `${name}: aria-current dla ${label}`);
    }
    await page.locator('.maplibregl-canvas').first().waitFor();

    // 1. Wyszukanie po numerze.
    await selectParcel(matches);
    await shot('02-wyszukanie');
    await closeDetails();

    // 2. Klik na mapie (po wyszukaniu mapa jest wycentrowana na działce, środek płótna leży w jej obrębie).
    if (mobile) await goView('Mapa');
    else await goView('Mapa');
    await page.waitForTimeout(2500);
    const box = await page.locator('.maplibregl-canvas').first().boundingBox();
    const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2 - (mobile ? 40 : 0)];
    await page.mouse.click(cx, cy);
    await page.waitForResponse(r => r.url().includes('/api/parcels') && r.request().method() !== 'OPTIONS', {timeout: 15000}).catch(() => {});
    await page.waitForTimeout(1000);
    await shot('03-klik-mapa');
    // Wróć do znanej działki, niezależnie od trafienia kliknięcia.
    if (await details.isVisible()) await closeDetails();
    await selectParcel(matches);
    if (await details.isVisible()) await closeDetails();

    // 3. „Dalej” → Dane.
    if (mobile) {
      await page.getByRole('button', {name: 'Dalej'}).click();
      await isActive('Dane', 'Dalej otwiera widok Dane');
    }
    await shot('04-dane');

    // 4. Formularz i analiza.
    await page.getByRole('button', {name: 'Dodaj informacje o polu'}).click();
    await chooseCrop('Ziemniak');
    await page.locator('#day').fill('2024-07-05');
    await details.getByLabel('Co rosło na tym polu w poprzednim sezonie głównym?').fill('Rzepak');
    await details.getByText('Wybierz warunki dla pola', {exact: true}).click();
    await page.getByLabel('Szukaj warunku dla pola').fill('dach');
    await page.getByRole('option', {name: /Jest dostępny dach/}).click();
    await details.getByRole('combobox', {name: 'Warunki zaobserwowane na całym polu'}).press('Escape');
    await details.getByLabel(/Czy podczas ulewy woda widocznie spływa/).selectOption('Często');
    await analyze.click();
    await heading.waitFor({timeout: 90000}).catch(async error => {
      console.error('widoczny błąd:', await page.getByRole('alert').allTextContents());
      throw error;
    });
    await page.waitForURL(/\/analiza\/[a-f0-9]{32}$/);
    const report = await (await context.request.get(url + '/api/analysis/' + page.url().split('/').at(-1))).json();
    assert.equal(report.farmer_answers?.previous_crop, 'Rzepak');
    const buffer = report.recommendations.find(action => action.id === 15);
    assert.equal(buffer?.scope, 'field');
    assert(report.recommendations.some(action => action.id === 18));
    assert(buffer.sources.length > 0);
    await shot('05-raport');
    assert.match(page.url(), /\/dzialka\/.+\/analiza\/[a-f0-9]{32}$/, 'adres raportu');
    await isActive('Raport', 'raport aktywny po analizie');
    assert(await page.getByText(/Ryzyko niedoboru wody/).isVisible());
    await noOverflow('raport');

    // 5. Prosty / Zaawansowany.
    const mode = page.getByRole('group', {name: 'Widok raportu'});
    await mode.getByRole('button', {name: 'Zaawansowany'}).click();
    await page.getByRole('heading', {name: 'Skąd pochodzą dane?'}).scrollIntoViewIfNeeded();
    await page.locator('[echarts] canvas').first().waitFor();
    assert(await page.locator('[echarts] canvas').count() >= 3, 'wykresy w widoku zaawansowanym');
    await shot('06-zaawansowany');
    await noOverflow('zaawansowany');
    await mode.getByRole('button', {name: 'Prosty'}).click();
    await page.getByRole('heading', {name: 'Na czym opieramy wynik?'}).waitFor();
    await shot('07-prosty');

    // 6. Zalecenia z dowodami.
    await page.getByRole('heading', {name: 'Co możesz zrobić?'}).scrollIntoViewIfNeeded();
    await page.locator('article').filter({has: page.getByRole('heading', {name: buffer.title})})
      .getByRole('button', {name: 'Dlaczego na tej działce?'}).click();
    await page.getByRole('heading', {name: 'Dowody'}).waitFor();
    await shot('08-dowody');
    await page.keyboard.press('Escape');

    // 7. PDF.
    const download = page.waitForEvent('download');
    await page.getByRole('link', {name: 'PDF', exact: true}).click();
    const file = await download;
    const downloaded = resolve(output, `browser-report-${name}.pdf`);
    await file.saveAs(downloaded);
    assert((await readFile(downloaded)).subarray(0, 4).equals(Buffer.from('%PDF')), 'PDF');

    // 8. Link do raportu: kopiowanie i ponowne otwarcie adresu.
    const reportUrl = page.url();
    await page.getByRole('button', {name: 'Kopiuj link'}).click();
    if (engine === 'chromium') assert.equal(await page.evaluate(() => navigator.clipboard.readText()), reportUrl, 'schowek');
    await page.goto(reportUrl, {waitUntil: 'domcontentloaded'});
    await heading.waitFor({timeout: 30000});
    await page.getByRole('group', {name: 'Widok raportu'}).getByRole('button', {name: 'Zaawansowany'}).click();
    await page.getByText('Pokaż dane wykresu').nth(2).waitFor({state: 'attached', timeout: 10000}).catch(() => assert.fail('tabele danych wykresów (min. 3)'));
    await shot('09-link-raportu');
    await page.getByRole('region', {name: 'Mapa i raport'}).getByRole('link', {name: 'Paszport', exact: true}).click();
    await page.getByRole('heading', {name: 'Paszport działki'}).waitFor();
    await page.getByRole('article', {name: /Paszport:/}).getByText(matches).first().waitFor({timeout: 20000});
    await shot('10-paszport');

    // 9. Link do samej działki, motyw, rysowanie granicy.
    await page.goto(reportUrl.replace(/\/analiza\/.*$/, ''), {waitUntil: 'domcontentloaded'});
    await selectedCard(matches).waitFor({timeout: 20000});
    await closeDetails();
    const themeButton = page.getByRole('button', {name: /Motyw/}).locator('visible=true').first();
    await themeButton.click();
    await page.waitForTimeout(300);
    await shot('11-motyw');
    if (!mobile) {
      await page.getByRole('button', {name: 'Narysuj granicę'}).click();
      await page.getByText(/Klikaj kolejne rogi/).waitFor();
      await page.getByRole('button', {name: 'Anuluj rysowanie'}).click();
    }

    // 10. Bieżąca data i błąd walidacji.
    const now = await (await context.request.get(url + '/api/health')).json();
    await selectParcel('280104_5.0006.98/2');
    await chooseCrop('Pszenica ozima');
    await page.locator('#day').fill(now.analysis_date_max);
    await analyze.click();
    await heading.waitFor({timeout: 90000});
    assert((await heading.locator('xpath=following-sibling::p').innerText()).includes(now.analysis_date_max), 'data bieżąca w raporcie');
    if (mobile) await goView('Mapa');
    expectFailure = true;
    await searchInput().fill('!!!');
    await searchButton().click();
    await page.getByRole('alert').getByText(/Podaj identyfikator/).waitFor();
    await shot('12-blad');
    await noOverflow('koniec');
    assert.deepEqual(errors, []);
    assert.deepEqual(failedResponses.filter(r => !r.endsWith('(oczekiwane)')), [], `${name}: odpowiedzi HTTP z błędem`);
    console.log(engine, name, 'OK');
  } catch (error) {
    await shot('FAIL').catch(() => {});
    console.error(engine, name, 'BŁĄD, błędy strony:', errors, 'odpowiedzi z błędem:', failedResponses);
    throw error;
  } finally {
    const video = page.video();
    await context.close();
    if (capture && video) { await video.saveAs(resolve(output, `demo-${name}.webm`)); await video.delete(); }
  }
}

let failed = false;
for (const name of selected) {
  try { await run(name); } catch (error) { failed = true; console.error(error); }
}
await browser.close();
if (failed) process.exit(1);
