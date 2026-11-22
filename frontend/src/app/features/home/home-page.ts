import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type Step = {title: string; text: string};

const STEPS: Step[] = [
  {title: 'Wybierz pole', text: 'Wskaż działkę na mapie lub wpisz jej numer.'},
  {title: 'Powiedz, co rośnie', text: 'Wybierz uprawę i datę.'},
  {title: 'Zobacz, co zrobić', text: 'Dostaniesz prosty wynik i podpowiedzi.'},
];

/** Strona startowa: cel aplikacji, dwa duże przyciski i trzy kroki. */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  template: `
    <article class="mx-auto flex max-w-3xl flex-col gap-8 px-4 pb-8 pt-6 text-base lg:px-8 lg:pt-12">
      <header class="flex flex-col gap-3">
        <h1 class="text-3xl font-extrabold tracking-tight lg:text-4xl">Pole Widzenia</h1>
        <p class="text-lg leading-snug">Sprawdź, czy Twojemu polu nie zabraknie wody, i dowiedz się, co możesz zrobić.</p>
      </header>

      <div class="flex flex-col gap-3 sm:flex-row">
        <a routerLink="/sprawdz"
          class="inline-flex min-h-14 flex-1 items-center justify-center gap-3 rounded-xl bg-primary px-6 py-3 text-lg font-bold text-primary-contrast hover:bg-primary-emphasis">
          <i class="pi pi-search" aria-hidden="true"></i>Sprawdź pole
        </a>
        <a routerLink="/pola"
          class="inline-flex min-h-14 flex-1 items-center justify-center gap-3 rounded-xl border-2 border-primary px-6 py-3 text-lg font-bold text-primary hover:bg-primary-50 dark:hover:bg-primary-950">
          <i class="pi pi-th-large" aria-hidden="true"></i>Moje pola
        </a>
      </div>

      <section aria-labelledby="kroki" class="flex flex-col gap-3">
        <h2 id="kroki" class="text-xl font-bold">Jak to działa</h2>
        <ol class="flex flex-col gap-3">
          @for (step of steps; track step.title; let i = $index) {
            <li class="pw-card flex items-start gap-4 p-4">
              <span class="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-lg font-bold text-primary-contrast" aria-hidden="true">{{i + 1}}</span>
              <div class="min-w-0">
                <p class="text-lg font-semibold">{{i + 1}}. {{step.title}}</p>
                <p class="text-muted-color">{{step.text}}</p>
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
