import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';

describe('Instrukcje eksperymentów', () => {
  it('udostępnia wszystkie pięć instrukcji w „Jak to działa” i przekierowuje stare adresy', async () => {
    TestBed.configureTestingModule({providers: [provideRouter(routes, withComponentInputBinding())]});
    const harness = await RouterTestingHarness.create('/eksperymenty');
    const router = TestBed.inject(Router);
    const catalogUrl = '/metody/eksperymenty';
    expect(router.url).toBe(catalogUrl);
    expect(harness.routeNativeElement!.querySelector('nav[aria-label="Jak to działa"] a[aria-current="page"]')?.textContent?.trim()).toBe('Eksperymenty');

    const slugs = ['wsiakanie-wody', 'wilgotnosc-gleby', 'struktura-gleby', 'brylki-w-wodzie', 'deszczomierz'];
    const illustrationFiles = ['wsiakanie-wody', 'wilgotnosc-gleby', 'struktura-gleby', 'brylki-gleby'];
    const cards = harness.routeNativeElement!.querySelectorAll<HTMLAnchorElement>('ul a');
    expect(Array.from(cards, (card) => card.getAttribute('href')))
      .toEqual(slugs.map((slug) => `${catalogUrl}/${slug}`));

    for (const [index, slug] of slugs.entries()) {
      await harness.navigateByUrl(`${catalogUrl}/${slug}`);
      const page = harness.routeNativeElement!;
      expect(page.querySelector('h1')?.textContent).toBe(cards[index].querySelector('h2')?.textContent);
      expect(page.querySelectorAll('#kroki + ol > li')).toHaveLength(5);
      expect(page.querySelector('article nav a')?.getAttribute('href')).toBe(catalogUrl);

      const illustration = page.querySelector('section[aria-labelledby="wizualizacja"]');
      const file = illustrationFiles[index];
      if (file) {
        const src = 'assets/experiments/eks-' + file + '.png';
        expect(illustration?.querySelector('img')?.getAttribute('src')).toBe(src);
        expect(illustration?.querySelector('a')?.getAttribute('href')).toBe(src);
        expect(illustration?.nextElementSibling?.getAttribute('aria-labelledby')).toBe('metoda-proby');
      } else {
        expect(illustration).toBeNull();
      }
    }

    await harness.navigateByUrl('/eksperymenty/wsiakanie-wody');
    expect(router.url).toBe(`${catalogUrl}/wsiakanie-wody`);
    expect(harness.routeNativeElement!.querySelector('section[aria-labelledby="wynik-proby"] a')?.getAttribute('href'))
      .toBe(`${catalogUrl}/struktura-gleby`);
  });
});
