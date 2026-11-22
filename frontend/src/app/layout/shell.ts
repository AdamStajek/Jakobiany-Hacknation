import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthStore } from '../core/state/auth.store';
import { FieldsStore } from '../core/state/fields.store';
import { ThemeService } from '../core/theme/theme';
import { AccountMenu } from './account-menu';
import { ConsentBanner } from './consent-banner';
import { ReportPrompt } from './report-prompt';

type Section = 'start' | 'analiza' | 'pola' | 'metody';
type NavItem = {id: Section; path: string; label: string; short: string; icon: string};

const NAV: NavItem[] = [
  {id: 'start', path: '/', label: 'Start', short: 'Start', icon: 'pi-home'},
  {id: 'analiza', path: '/sprawdz', label: 'Analizuj pole', short: 'Analizuj', icon: 'pi-map'},
  {id: 'pola', path: '/pola', label: 'Moje pola', short: 'Pola', icon: 'pi-th-large'},
  {id: 'metody', path: '/metody', label: 'Jak to działa', short: 'Jak działa', icon: 'pi-book'},
];

/** Powłoka aplikacji: pasek boczny na desktopie, górny pasek i dolna nawigacja na telefonie. */
@Component({
  selector: 'app-shell',
  imports: [RouterLink, AccountMenu, ConsentBanner, ReportPrompt],
  template: `
    <a class="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-contrast" href="#tresc">Przejdź do treści</a>

    <aside class="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-surface bg-surface-0 px-3 py-4 print:hidden lg:flex dark:bg-surface-900">
      <a routerLink="/" class="mb-6 flex items-center gap-3 rounded-lg px-2 py-1" aria-label="Pole Widzenia — strona główna">
        <img src="/assets/brand/pole_widzenia_bez_napisu_przezroczyste.png" alt="" width="321" height="344" class="h-10 w-auto">
        <span class="text-lg font-extrabold leading-tight tracking-tight">Pole<br>Widzenia</span>
      </a>
      <nav aria-label="Nawigacja główna" class="flex flex-col gap-1">
        @for (item of nav; track item.path) {
          <a [routerLink]="item.path" [attr.aria-current]="section() === item.id ? 'page' : null"
             class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-surface-100 dark:hover:bg-surface-800"
             [class]="section() === item.id ? 'bg-primary-50 font-semibold text-primary dark:bg-primary-950' : ''">
            <i class="pi {{item.icon}} text-base" aria-hidden="true"></i>{{item.label}}
          </a>
        }
      </nav>
      <div class="mt-auto space-y-3">
        <app-account-menu variant="sidebar" [url]="url()" />
        <button type="button" (click)="theme.cycle()" [attr.aria-label]="label() + '. Kliknij, aby zmienić.'"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-surface-100 dark:hover:bg-surface-800">
          <i class="pi {{icon()}} text-base" aria-hidden="true"></i>{{label()}}
        </button>
        <p class="px-3 text-xs leading-snug text-muted-color">Zespół Jakobiany<br>HackNation 2026 · KOWR</p>
      </div>
    </aside>

    <header class="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-surface bg-surface-0/95 px-4 backdrop-blur print:hidden lg:hidden dark:bg-surface-900/95">
      <a routerLink="/" class="flex items-center gap-2" aria-label="Pole Widzenia — strona główna">
        <img src="/assets/brand/pole_widzenia_bez_napisu_przezroczyste.png" alt="" width="321" height="344" class="h-8 w-auto">
        <span class="text-base font-extrabold tracking-tight">Pole Widzenia</span>
      </a>
      <app-account-menu class="ml-auto" variant="header" [url]="url()" />
      <button type="button" (click)="theme.cycle()" [attr.aria-label]="label() + '. Kliknij, aby zmienić.'"
        class="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-100 dark:hover:bg-surface-800">
        <i class="pi {{icon()}}" aria-hidden="true"></i>
      </button>
    </header>

    <main id="tresc" class="lg:pl-60"><ng-content /></main>
    <app-consent-banner />
    <app-report-prompt [active]="section() === 'analiza'" [url]="url()" />

    <nav aria-label="Nawigacja główna" class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-surface bg-surface-0/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden lg:hidden dark:bg-surface-900/95">
      @for (item of nav; track item.path) {
        <a [routerLink]="item.path" [attr.aria-current]="section() === item.id ? 'page' : null" [attr.aria-label]="item.label"
           class="flex h-16 min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-sm"
           [class]="section() === item.id ? 'font-semibold text-primary' : 'text-muted-color'">
          <i class="pi {{item.icon}} text-xl" aria-hidden="true"></i>{{item.short}}
        </a>
      }
    </nav>
  `,
})
export class Shell {
  protected readonly theme = inject(ThemeService);
  /** Tworzony od startu, aby każdy raport z analizy odświeżał status zapisanych pól. */
  private readonly fields = inject(FieldsStore);
  /** Sesję sprawdzamy od startu, aby menu konta i pola od razu znały źródło danych. */
  private readonly auth = inject(AuthStore);
  protected readonly nav = NAV;
  constructor() { void this.auth.init(); }
  protected readonly label = computed(() => ({system: 'Motyw systemowy', light: 'Motyw jasny', dark: 'Motyw ciemny'})[this.theme.mode()]);
  protected readonly icon = computed(() => ({system: 'pi-desktop', light: 'pi-sun', dark: 'pi-moon'})[this.theme.mode()]);
  private readonly router = inject(Router);
  protected readonly url = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)),
    {initialValue: this.router.url});
  /** Aktywna sekcja nawigacji (paszport działki leży pod /dzialka/:id/paszport i należy do „Moich pól”). */
  protected readonly section = computed<Section>(() => {
    const url = this.url().split(/[?#]/)[0];
    if (url.startsWith('/metody')) return 'metody';
    if (url === '/' || url === '') return 'start';
    return url.startsWith('/pola') || url.startsWith('/paszporty') || url.endsWith('/paszport') ? 'pola' : 'analiza';
  });
}
