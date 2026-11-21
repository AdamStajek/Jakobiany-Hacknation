import { Component } from '@angular/core';

@Component({
  selector: 'app-methods-page',
  template: `
    <article class="max-w-3xl space-y-3">
      <h1 class="text-2xl font-bold tracking-tight">Jak to działa?</h1>
      <p>Porównujemy opad z zapotrzebowaniem uprawy na wodę (ET₀ FAO-56 × Kc), uwzględniamy pojemność wodną gleby (SoilGrids),
        obrazy Sentinel-2, rzeźbę terenu i pokrycie terenu. Gdy źródło jest niedostępne, raport pokazuje brak i obniża pewność.</p>
      <p>Wyniki pomagają zdecydować, co sprawdzić na polu. Przed nawadnianiem lub pracami retencyjnymi potwierdź warunki w terenie.</p>
      <p class="text-sm text-muted-color">Pełny opis metod: docs/DATA_LIMITATIONS.md.</p>
    </article>
  `,
})
export class MethodsPage {}
