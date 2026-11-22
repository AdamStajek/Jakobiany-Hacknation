import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type Step = {title: string; text: string};

const STEPS: Step[] = [
  {title: 'Wybierz pole', text: 'Na mapie lub po numerze działki.'},
  {title: 'Wskaż uprawę', text: 'I datę siewu.'},
  {title: 'Zobacz wynik', text: 'Zapas wody i co zrobić.'},
];

/** Strona startowa: cel aplikacji, dwa duże przyciski i trzy kroki. */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  template: `
    <article class="mx-auto flex max-w-3xl flex-col gap-8 px-4 pb-8 pt-6 text-base lg:px-8 lg:pt-12">
      <header class="flex flex-col gap-3">
        <h1 class="text-3xl font-extrabold tracking-tight lg:text-4xl">Pole Widzenia</h1>
        <p class="text-xl font-semibold text-primary lg:text-2xl">Dane, które dają plony.</p>
      </header>

      <div class="flex flex-col gap-3 sm:flex-row">
        <a routerLink="/sprawdz"
          class="inline-flex min-h-14 flex-1 items-center justify-center gap-3 rounded-xl bg-primary px-6 py-3 text-lg font-bold text-primary-contrast hover:bg-primary-emphasis">
          <i class="pi pi-search" aria-hidden="true"></i>Analizuj pole
        </a>
        <a routerLink="/pola"
          class="inline-flex min-h-14 flex-1 items-center justify-center gap-3 rounded-xl border-2 border-primary px-6 py-3 text-lg font-bold text-primary hover:bg-primary-50 dark:hover:bg-primary-950">
          <i class="pi pi-th-large" aria-hidden="true"></i>Moje pola
        </a>
      </div>

      <section aria-labelledby="kroki" class="flex flex-col gap-3">
        <h2 id="kroki" class="pw-h2">3 kroki</h2>
        <ol class="flex flex-col gap-3">
          @for (step of steps; track step.title; let i = $index) {
            <li class="pw-card flex items-center gap-4 p-3">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-base font-bold text-primary-contrast" aria-hidden="true">{{i + 1}}</span>
              <div class="min-w-0">
                <p class="font-semibold">{{step.title}}</p>
                <p class="text-sm text-muted-color">{{step.text}}</p>
              </div>
            </li>
          }
        </ol>
      </section>
    </article>
  `,
})
export class HomePage {
  protected readonly steps = STEPS;
}
