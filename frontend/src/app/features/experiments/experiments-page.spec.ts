import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';

describe('Instrukcje eksperymentów', () => {
  it('udostępnia wszystkie pięć instrukcji pod osobnymi adresami', async () => {
    TestBed.configureTestingModule({providers: [provideRouter(routes, withComponentInputBinding())]});
    const harness = await RouterTestingHarness.create('/eksperymenty');
    const slugs = ['wsiakanie-wody', 'wilgotnosc-gleby', 'struktura-gleby', 'brylki-w-wodzie', 'deszczomierz'];
    const cards = harness.routeNativeElement!.querySelectorAll<HTMLAnchorElement>('ul a');
    expect(Array.from(cards, (card) => card.getAttribute('href')))
      .toEqual(slugs.map((slug) => '/eksperymenty/' + slug));

    for (const [index, slug] of slugs.entries()) {
      await harness.navigateByUrl('/eksperymenty/' + slug);
      const page = harness.routeNativeElement!;
      expect(page.querySelector('h1')?.textContent).toBe(cards[index].querySelector('h2')?.textContent);
      expect(page.querySelectorAll('#kroki + ol > li')).toHaveLength(5);
      expect(page.querySelector('nav a')?.getAttribute('href')).toBe('/eksperymenty');
    }
  });
});
