import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <a class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-contrast" href="#tresc">Przejdź do treści</a>
    <header class="sticky top-0 z-20 border-b border-surface bg-surface-0/90 backdrop-blur dark:bg-surface-900/90">
      <div class="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4">
        <a routerLink="/" class="flex items-center gap-2 text-lg font-extrabold tracking-tight text-primary" aria-label="WodoStrażnik — strona główna">
          <i class="pi pi-compass" aria-hidden="true"></i> WodoStrażnik
        </a>
        <nav aria-label="Nawigacja główna" class="flex gap-1 text-sm font-medium">
          <a routerLink="/" routerLinkActive="bg-primary-50 text-primary dark:bg-primary-950" [routerLinkActiveOptions]="{exact: true}"
             class="rounded-md px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-800">Analiza działki</a>
          <a routerLink="/metody" routerLinkActive="bg-primary-50 text-primary dark:bg-primary-950"
             class="rounded-md px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-800">Jak to działa</a>
        </nav>
      </div>
    </header>
    <main id="tresc" class="mx-auto w-full max-w-[1400px] flex-1 px-4 py-4"><ng-content /></main>
    <footer class="border-t border-surface py-4 text-center text-xs text-muted-color">
      <strong>WodoStrażnik</strong> · Zespół Jakobiany · HackNation 2026 · KOWR
    </footer>
  `,
  host: {class: 'flex min-h-screen flex-col'},
})
export class Shell {}
