// Test dymny całego przepływu w przeglądarce: wyszukanie działki, klik na mapie, Dane → analiza → raport,
// PDF, link do raportu, nawigacja powłoki. Uruchamia się w dwóch viewportach.
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
  page.on('response', r => {
    if (r.status() === 401 && new URL(r.url()).pathname === '/api/me') return; // sesja gościa
    if (r.status() >= 400) failedResponses.push(`${r.status()} ${r.request().method()} ${r.url()}${expectFailure ? ' (oczekiwane)' : ''}`);
  });
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
  const form = page.getByRole('form', {name: 'Uprawa i data'});
  const analyze = form.getByRole('button', {name: 'Analizuj działkę'});
  const heading = page.getByRole('heading', {name: 'Analiza działki'});
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
    await page.getByRole('button', {name: 'Nie zapisuj'}).click();
    await page.locator('.maplibregl-canvas').first().waitFor();
    await pause(3000);
    await shot('01-start');

    // Nawigacja powłoki: pasek boczny (desktop) lub dolna nawigacja (telefon).
    const navs = page.getByRole('navigation', {name: 'Nawigacja główna'});
    const nav = navs.locator('visible=true').first();
    assert.equal(await nav.getByRole('link', {name: 'Eksperymenty'}).count(), 0);
    for (const [label, path] of [['Moje pola', /\/pola$/], ['Jak to działa', /\/metody$/], ['Analizuj pole', /\/sprawdz$/]]) {
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
        const numbers = await catalog.locator('ol').evaluateAll(lists => lists.flatMap(list =>
          Array.from(list.children, (item, index) => item.hasAttribute('value') ? item.value : list.start + index),
        ));
        assert.deepEqual(numbers, Array.from({length: 60}, (_, index) => index + 1));
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
      await link.and(page.locator('[aria-current=page]')).waitFor();
    }
    await page.locator('.maplibregl-canvas').first().waitFor();

    // 1. Wyszukanie po numerze.
    await selectParcel(matches);
    await shot('02-wyszukanie');

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
    await selectParcel(matches);

    // 3. „Dalej” → Dane.
    if (mobile) {
      await page.getByRole('button', {name: 'Dalej'}).click();
      await isActive('Dane', 'Dalej otwiera widok Dane');
    }
    await shot('04-dane');

    // 4. Formularz i analiza.
    await chooseCrop('Ziemniak');
    await page.locator('#day').fill('2024-07-05');
    await form.getByRole('button', {name: /^Zaawansowane/}).click();
    await form.getByRole('button', {name: /Gleba i woda/}).click();
    await form.getByLabel('Co rosło na tym polu w poprzednim sezonie głównym?').fill('Rzepak');
    await form.getByText('Wybierz warunki dla pola', {exact: true}).click();
    await page.getByLabel('Szukaj warunku dla pola').fill('dach');
    await page.getByRole('option', {name: /Jest dostępny dach/}).click();
    await form.getByRole('heading', {name: 'Dodatkowe informacje o polu'}).click();
    await form.locator('p-multiselect[inputid="field-confirmations"]').click();
    await page.getByLabel('Szukaj warunku dla pola').fill('zdecydować');
    await page.getByRole('option', {name: /Trzeba niedługo zdecydować/}).click();
    await form.getByRole('combobox', {name: 'Warunki zaobserwowane na całym polu'}).press('Escape');
    await form.getByLabel(/Czy podczas ulewy woda widocznie spływa/).selectOption('Często');
    await analyze.click();
    await heading.waitFor({timeout: 90000}).catch(async error => {
      console.error('widoczny błąd:', await page.getByRole('alert').allTextContents());
      throw error;
    });
    await page.waitForURL(/\/analiza\/[a-f0-9]{32}$/);
    const report = await (await context.request.get(url + '/api/analysis/' + page.url().split('/').at(-1))).json();
    assert.equal(report.farmer_answers?.previous_crop, 'Rzepak');
    const buffer = report.recommendations.find(action => action.id === 15);
    assert.equal(buffer?.scope, 'site');
    assert(report.recommendations.some(action => action.id === 18));
    assert(buffer.sources.length > 0);
    await page.getByRole('button', {name: 'Ukryj propozycję'}).click();
    await shot('05-raport');
    assert.match(page.url(), /\/dzialka\/.+\/analiza\/[a-f0-9]{32}$/, 'adres raportu');
    await isActive('Raport', 'raport aktywny po analizie');
    const steps = page.getByRole('navigation', {name: 'Kroki raportu'});
    for (const [index, name] of ['1. Analiza', '2. Eksperymenty', '3. Co możesz zrobić'].entries()) {
      assert.equal(await steps.getByRole('button', {name, exact: true}).getAttribute('aria-controls'), 'krok-' + (index + 1));
    }
    const waterAnalysis = page.getByRole('region', {name: 'Analiza', exact: true});
    const verdict = waterAnalysis.getByRole('heading', {name: report.evidence.headline, exact: true});
    await verdict.waitFor();
    assert.equal(await waterAnalysis.getByText(/^Pewność:/).count(), 0);
    await waterAnalysis.getByRole('button', {name: /^Spływ wody z pola/}).press('Enter');
    await waterAnalysis.getByText('Spływ wody po powierzchni podczas ulewy: Często.').waitFor();
    await noOverflow('raport');

    // 5. Oba widoki odnoszą się do tej samej diagnozy.
    const balance = waterAnalysis.getByRole('button', {name: /^Bilans wodny uprawy/});
    await balance.press('Space');
    await balance.and(page.locator('[aria-expanded=true]')).waitFor();
    await waterAnalysis.locator('#bilans').getByText('Metoda oceny').waitFor();
    await shot('07-prosty');
    const mode = waterAnalysis.getByRole('group', {name: 'Widok raportu'});
    await mode.getByRole('button', {name: 'Zaawansowany'}).click();
    await verdict.waitFor();
    if (report.metrics.recent) {
      await waterAnalysis.locator('#bilans canvas').waitFor();
      await waterAnalysis.locator('#bilans summary').press('Enter');
      await waterAnalysis.locator('#bilans table').waitFor();
    }
    await balance.press('Enter');
    await balance.and(page.locator('[aria-expanded=false]')).waitFor();
    await noOverflow('zaawansowany');
    await waterAnalysis.getByText(report.experiments[0].title, {exact: false}).waitFor();
    await waterAnalysis.getByRole('button', {name: 'Zobacz eksperyment'}).press('Enter');
    await page.getByRole('heading', {name: 'Eksperymenty', exact: true}).waitFor();
    assert.equal(await steps.getByRole('button', {name: '2. Eksperymenty'}).getAttribute('aria-current'), 'step');
    await page.getByRole('link', {name: 'Instrukcja — ' + report.experiments[0].title + ' (nowa karta)'}).waitFor();

    const trial = report.experiments[0];
    await page.getByRole('combobox', {name: 'Wynik — ' + trial.title}).selectOption(trial.options[0].value);
    await page.getByRole('button', {name: 'Zapisz wynik — ' + trial.title}).click();
    const saved = page.locator('#krok-2 [role=status]');
    await saved.getByText(trial.options[0].conclusion, {exact: false}).waitFor();
    assert.equal(await steps.getByRole('button', {name: '2. Eksperymenty'}).getAttribute('aria-current'), 'step');

    const dismissPrompt = page.getByRole('button', {name: 'Ukryj propozycję'});
    if (await dismissPrompt.isVisible()) await dismissPrompt.click();

    // 6. Zalecenia z dowodami.
    await steps.getByRole('button', {name: '3. Co możesz zrobić'}).click();
    const recommendations = page.getByRole('region', {name: 'Co możesz zrobić?'});
    await recommendations.getByRole('heading', {name: 'Co możesz zrobić?'}).scrollIntoViewIfNeeded();
    const recommendation = recommendations.locator('article').filter({has: page.getByRole('heading', {name: buffer.title})});
    if (await recommendation.count() === 0) await recommendations.getByRole('button', {name: /Pokaż więcej/}).click();
    await recommendation.getByText(buffer.location, {exact: true}).waitFor();
    await recommendation.getByText(/200\s*–\s*320 zł netto za ha pasa/).waitFor();
    assert.equal(await recommendation.getByText(/^Pewność:/).count(), 0);
    await recommendation.getByRole('button', {name: 'Dlaczego to pasuje? ' + buffer.title}).click();
    await page.getByRole('heading', {name: 'Dlaczego na tej działce?'}).waitFor();
    await page.getByRole('heading', {name: 'Jak to może pomóc?'}).waitFor();
    await shot('08-dowody');
    await page.keyboard.press('Escape');

    const measurement = report.recommendations.find(action => action.id === 52);
    const mapButton = recommendations.getByRole('button', {name: 'Pokaż na mapie: ' + measurement.title});
    if (await mapButton.count() === 0) await recommendations.getByRole('button', {name: /Pokaż więcej/}).click();
    await mapButton.press('Enter');
    await page.getByRole('application', {name: 'Mapa miejsc objętych zaleceniem'}).waitFor();
    await page.getByRole('list', {name: 'Punkty na mapie'}).getByText('Proponowane miejsce pomiaru', {exact: false}).waitFor();
    await page.keyboard.press('Escape');

    // 7. PDF.
    await page.locator('summary[aria-label="Zapis i wydruk"]').click();
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
    await verdict.waitFor();
    await page.locator('summary[aria-label="Zapis i wydruk"]').click();
    await shot('09-link-raportu');
    await page.getByRole('region', {name: 'Mapa i raport'}).getByRole('link', {name: 'Dane działki', exact: true}).click();
    await page.getByRole('heading', {name: 'Dane działki'}).waitFor();
    const passport = page.getByRole('article', {name: /Dane działki:/});
    await passport.getByText(matches).first().waitFor({timeout: 120000});
    assert.deepEqual(await passport.locator('dt').allTextContents(), [
      'Powierzchnia działki', 'Rodzaj uprawy', 'Rodzaj gleby', 'Zdolność gleby do zatrzymywania wody',
      'Ukształtowanie terenu', 'Nachylenie terenu', 'Aktualna wilgotność gleby',
    ]);
    await shot('10-dane-dzialki');

    // 9. Link do samej działki, motyw, rysowanie granicy.
    await page.goto(reportUrl.replace(/\/analiza\/.*$/, ''), {waitUntil: 'domcontentloaded'});
    await selectedCard(matches).waitFor({timeout: 20000});
    await page.getByRole('button', {name: /^Menu/}).locator('visible=true').first().click();
    await page.getByRole('button', {name: 'Ciemny'}).click();
    await page.waitForTimeout(300);
    await shot('11-motyw');
    if (!mobile) {
      await page.getByRole('button', {name: /Rysuj działkę/}).click();
      const drawing = page.getByRole('region', {name: 'Rysowanie działki'});
      await drawing.getByText(/Dotykaj kolejnych rogów/).waitFor();
      await drawing.getByRole('button', {name: 'Anuluj'}).click();
    }

    // 10. Bieżąca data i błąd walidacji.
    const now = await (await context.request.get(url + '/api/health')).json();
    await selectParcel('280104_5.0006.98/2');
    if (mobile) await goView('Dane');
    await chooseCrop('Pszenica ozima');
    await page.locator('#day').fill(now.analysis_date_max);
    await analyze.click();
    await heading.waitFor({timeout: 90000});
    assert.equal(await page.locator('app-report-dashboard header time').getAttribute('datetime'), now.analysis_date_max);
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
