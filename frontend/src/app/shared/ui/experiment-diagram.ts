import { Component, computed, input } from '@angular/core';

/**
 * Schemat pola podzielonego na dwa fragmenty: „Test” (tu zmieniamy) i „Kontrola” (tu nic nie zmieniamy).
 * Własny SVG bez zewnętrznych zasobów; kolory z tokenów motywu, więc działa w jasnym i ciemnym motywie.
 */
@Component({
  selector: 'app-experiment-diagram',
  template: `
    <figure class="m-0">
      <svg viewBox="0 0 320 170" role="img" [attr.aria-label]="alt()" class="h-auto w-full max-w-md">
        <title>{{alt()}}</title>
        <rect x="8" y="8" width="304" height="154" rx="10" class="fill-surface-50 stroke-surface-400 dark:fill-surface-900 dark:stroke-surface-500" stroke-width="2" />
        <rect x="16" y="16" width="140" height="106" rx="6" class="fill-primary/20 stroke-primary" stroke-width="3" />
        <rect x="164" y="16" width="140" height="106" rx="6" class="fill-surface-100 stroke-surface-500 dark:fill-surface-800 dark:stroke-surface-400" stroke-width="3" stroke-dasharray="8 5" />
        <g class="fill-primary" aria-hidden="true">
          <circle cx="50" cy="48" r="5" /><circle cx="86" cy="70" r="5" /><circle cx="122" cy="48" r="5" />
          <circle cx="50" cy="96" r="5" /><circle cx="122" cy="96" r="5" />
        </g>
        <g class="stroke-surface-500 dark:stroke-surface-400" stroke-width="2" aria-hidden="true">
          <line x1="190" y1="40" x2="278" y2="40" /><line x1="190" y1="69" x2="278" y2="69" /><line x1="190" y1="98" x2="278" y2="98" />
        </g>
        <g class="fill-surface-900 font-semibold dark:fill-surface-0" text-anchor="middle" font-size="16">
          <text x="86" y="148">Test</text>
          <text x="234" y="148">Kontrola</text>
        </g>
      </svg>
      <figcaption class="mt-1 text-sm text-muted-color">{{caption()}}</figcaption>
    </figure>
  `,
})
export class ExperimentDiagram {
  /** Co zmieniamy w fragmencie „Test” (krótko). */
  readonly change = input('');
  protected readonly alt = computed(() =>
    'Schemat pola podzielonego na dwa fragmenty obok siebie: Test, w którym wprowadzasz zmianę, i Kontrola, w której nic nie zmieniasz.');
  protected readonly caption = computed(() => this.change()
    ? `Test: ${this.change()}. Kontrola: bez zmian, ta sama gleba i uprawa.`
    : 'Test: tu wprowadzasz zmianę. Kontrola: bez zmian, ta sama gleba i uprawa.');
}
