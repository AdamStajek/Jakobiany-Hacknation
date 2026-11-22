import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const submission = resolve('../submission');
const capture = resolve(submission, '.capture/chromium');
const data = JSON.parse(await readFile(resolve(submission, 'live-verification.json')));
const images = Object.fromEntries(await Promise.all(['map','result','recommendations'].map(async name => [
  name, 'data:image/png;base64,' + (await readFile(resolve(capture, name + '.png'))).toString('base64'),
])));
const first = data[0];
const second = data[1];
const mm = value => new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1}).format(value);
const timing = run => mm(run.client_ms / 1000) + ' s';
const photo = (name, alt) => '<img src="' + images[name] + '" alt="' + alt + '">';
const source = text => '<footer>' + text + '</footer>';
const tile = (label, value, unit = '') => '<div class="tile"><strong>' + value + ' <i>' + unit + '</i></strong><p>' + label + '</p></div>';
const section = (title, content) => '<section><header><div class="mark">Pole Widzenia</div><h2>' + title + '</h2></header>' + content + '</section>';

const slides = [
  '<section class="cover"><div class="mark">Jakobiany · HackNation 2026 / KOWR</div><div class="split"><div><h1>Pole<br>widzenia<span>.</span></h1><p>Asystent gospodarowania wodą w rolnictwie</p></div>'
    + photo('map','Granica działki w działającej aplikacji') + '</div>' + source('Bydgoszcz · 21–22 listopada 2026') + '</section>',
  section('Woda na konkretnym polu',
    '<div class="pair">' + tile('Opad w 30 dni',mm(first.recent.rain_mm),'mm')
    + tile('Zapotrzebowanie ziemniaka',mm(first.recent.etc_mm),'mm') + '</div>'
    + '<p class="caption">Działka ' + first.parcel_id + ' · gmina Kościan · ' + first.date + '</p>'
    + source('Wynik działającej aplikacji. Pogoda NASA POWER, obliczenia FAO-56. Wybrana uprawa jest scenariuszem.')),
  section('Od granicy do decyzji',
    '<div class="split"><div class="sequence"><p>1 &nbsp; Wskaż działkę</p><p>2 &nbsp; Wybierz uprawę i datę</p><p>3 &nbsp; Otwórz dowody i zapisz raport</p></div>'
    + photo('map','Formularz i granica zweryfikowanej działki') + '</div>'
    + source('Prototyp. Granice GUGiK / ULDK, mapa OpenStreetMap.')),
  section('Pięć kategorii danych',
    '<div class="evidence"><span>Pogoda<small>NASA POWER i IMGW</small></span><span>Satelita<small>Sentinel-2</small></span><span>Gleba<small>SoilGrids</small></span><span>Hydrologia<small>WorldCover i IMGW</small></span><span>Teren i działka<small>EU-DEM, WorldCover, GUGiK</small></span></div>'
    + '<p class="caption">Wynik podaje pokrycie, rozdzielczość i jawne braki.</p>'
    + source('Źródła i licencje opisane w dokumentacji.')),
  section('Jak liczymy niedobór',
    '<div class="sequence math"><p>Opad − ET₀ × Kc</p><p>↓</p><p>Porównanie z zapasem wody przy korzeniach</p><p>↓</p><p>Ubytek, próg łatwej dostępności i zalecenia</p></div>'
    + source('FAO-56, rozdziały 4, 6 i 8. Kc zależy od fazy wybranej uprawy.')),
  section('Dlaczego na tej działce?',
    '<div class="split"><div class="sequence"><p>Sprawdź wilgotność w profilu</p><p>Zaplanuj osłonę gleby</p><p>Obejrzyj odpływ po deszczu</p></div>'
    + photo('recommendations','Zalecenia i uzasadnienie z żywego raportu') + '</div>'
    + source('Każde zalecenie ma dowód, termin i zakres stosowalności.')),
  section('Dwa pola, dwa wyniki',
    '<div class="pair">' + tile('Wielkopolskie · bilans 30 dni',mm(first.recent.crop_balance_mm),'mm')
    + tile('Lubelskie · bilans 30 dni',mm(second.recent.crop_balance_mm),'mm') + '</div>'
    + '<p class="caption">Porównywalne okna historyczne: ' + first.years + ' lat na każdej działce.</p>'
    + source('Różne daty i uprawy. Porównanie pokazuje dwa raporty, bez porównywania samego wpływu regionu.')),
  section('Gotowość do próby na żywo',
    '<div class="split"><div class="sequence"><p>3 regiony sprawdzone na danych</p><p>' + timing(first.runs[0]) + ' na zimno · ' + timing(first.runs[1]) + ' z cache w przykładzie</p><p>Polski raport PDF i dostęp do źródeł</p></div>'
    + photo('result','Wynik i historia z działającej aplikacji') + '</div>'
    + source('Pomiar pojedynczych wywołań. Pełna tabela i braki źródeł w live-verification.json.')),
];

const style = [
  '@page{size:13.3333in 7.5in;margin:0}*{box-sizing:border-box}',
  'body{margin:0;background:#142d24;color:#eaf1e8;font:20px system-ui,sans-serif}',
  'section{width:1280px;height:720px;padding:55px 74px 62px;position:relative;page-break-after:always;overflow:hidden;background:#142d24}',
  'section:last-child{page-break-after:auto}.mark{font-size:15px;font-weight:750;color:#a7d8b6;letter-spacing:.045em}',
  'h1,h2,p{margin:0}h1,h2{line-height:1.04;letter-spacing:-.055em}h2{font-size:59px;margin-top:20px}',
  'h1{font:800 107px/.86 Georgia,serif;letter-spacing:-.08em}h1 span{color:#84c69f}.cover p{font-size:29px;margin-top:23px;color:#c6ddce}',
  '.split{display:grid;grid-template-columns:1fr 1.25fr;gap:32px;align-items:center;margin-top:48px}.cover .split{margin-top:63px}',
  'img{display:block;width:100%;height:382px;object-fit:contain;border-radius:14px;background:#eaf1e8}',
  '.pair{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:85px}.tile{padding:24px 28px;border-radius:16px;background:#254839}',
  '.tile strong{font-size:85px;line-height:1.1;letter-spacing:-.055em;color:#d3f0d5}.tile i{font-size:29px;font-style:normal}.tile p{font-size:23px;color:#f0f7ef}',
  '.caption{margin-top:31px;font-size:24px;color:#c6ddce}.sequence{font-size:32px;font-weight:650;display:grid;gap:18px}',
  '.sequence p{border-left:3px solid #75b994;padding-left:13px}.math{margin-top:63px;text-align:center;font-size:36px;gap:10px}.math p{border:0;padding:0}',
  '.evidence{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:57px}.evidence span{display:block;background:#254839;padding:20px;border-radius:12px;font-size:29px;font-weight:700}',
  '.evidence small{display:block;font-size:20px;font-weight:500;color:#c6ddce;margin-top:4px}',
  'footer{position:absolute;bottom:43px;left:74px;right:74px;font-size:17px;color:#c6ddce;border-top:1px solid #466957;padding-top:12px}',
].join('');
const browser = await chromium.launch({args:['--no-sandbox']});
try {
  const page = await browser.newPage({viewport:{width:1280,height:720}});
  await page.setContent('<!doctype html><html lang="pl"><meta charset="utf-8"><title>Pole Widzenia</title><style>'
    + style + '</style><body>' + slides.join('') + '</body></html>');
  await page.evaluate(() => Promise.all([...document.images].map(img => img.decode())));
  await page.pdf({path:resolve(submission,'Pole-widzenia-prezentacja.pdf'),printBackground:true,preferCSSPageSize:true});
  console.log(slides.length + ' slides exported');
} finally { await browser.close(); }
