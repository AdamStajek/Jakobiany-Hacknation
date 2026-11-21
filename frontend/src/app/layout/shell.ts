import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../core/theme/theme';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <a class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-contrast" href="#tresc">Przejdź do treści</a>
    <header class="sticky top-0 z-20 border-b border-surface bg-surface-50/95 backdrop-blur dark:bg-surface-900/90">
      <div class="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4">
        <a routerLink="/" class="pw-brand inline-flex shrink-0 items-center" aria-label="Pole Widzenia — strona główna">
          <picture>
            <source media="(max-width: 639px)" srcset="/assets/brand/pole_widzenia_bez_napisu_przezroczyste.png">
            <img src="/assets/brand/pole_widzenia_z_napisem_przezroczyste.png" alt="Pole Widzenia" width="722" height="344"
                 class="h-10 w-auto sm:h-12">
          </picture>
        </a>
        <nav aria-label="Nawigacja główna" class="flex gap-1 text-sm font-medium">
          <a routerLink="/" routerLinkActive="bg-surface-100 text-color border-b-2 border-orange-500 dark:bg-primary-950" [routerLinkActiveOptions]="{exact: true}"
             class="rounded-md px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-800">Analiza działki</a>
          <a routerLink="/paszporty" routerLinkActive="bg-surface-100 text-color border-b-2 border-orange-500 dark:bg-primary-950" class="rounded-md px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-800">Paszporty pól</a>
          <a routerLink="/metody" routerLinkActive="bg-surface-100 text-color border-b-2 border-orange-500 dark:bg-primary-950"
             class="rounded-md px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-800">Jak to działa</a>
        </nav>
        <button type="button" (click)="theme.cycle()" class="ml-auto rounded-md px-3 py-2 text-sm hover:bg-surface-100 dark:hover:bg-surface-800"
          [attr.aria-label]="'Motyw: ' + label() + '. Kliknij, aby zmienić.'">
          <i class="pi {{icon()}}" aria-hidden="true"></i><span class="ml-2 hidden sm:inline">{{label()}}</span>
        </button>
      </div>
    </header>
    <main id="tresc" class="mx-auto w-full max-w-[1400px] flex-1 px-4 py-4"><ng-content /></main>
    <footer class="border-t border-surface py-4 text-center text-xs text-muted-color">
      <strong>Pole Widzenia</strong> · Zespół Jakobiany · HackNation 2026 · KOWR
    </footer>
  `,
  host: {class: 'flex min-h-screen flex-col'},
})
export class Shell {
  protected readonly theme = inject(ThemeService);
  protected readonly label = computed(() => ({system: 'Motyw systemowy', light: 'Jasny', dark: 'Ciemny'})[this.theme.mode()]);
  protected readonly icon = computed(() => ({system: 'pi-desktop', light: 'pi-sun', dark: 'pi-moon'})[this.theme.mode()]);
}
