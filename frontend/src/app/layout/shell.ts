import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '../core/auth.service';
import { ROLES, Role } from '../core/permissions';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { EvidenceDrawer } from '../shared/evidence-drawer';
import { OfflineBanner } from '../shared/offline-banner';

function readInitialDark(): boolean {
  try {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
  } catch { /* ignoruj */ }
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

interface NavItem { label: string; icon: string; link: string; roles: Role[]; }
interface NavGroup { title: string; items: NavItem[]; }

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, EvidenceDrawer, FormsModule, SelectButtonModule, ToastModule, OfflineBanner],
  template: `
    <div class="min-h-screen flex">
      <aside class="w-64 shrink-0 flex flex-col gap-4 p-4 border-r border-surface bg-surface-0 dark:bg-surface-900">
        <div class="flex flex-col gap-1 px-2">
          <div class="text-xl font-extrabold tracking-wide">
            <span class="text-brand-navy">PROJEKT</span> <span class="text-primary">KOMPAS</span>
          </div>
          <div class="brand-bar"></div>
          <div class="text-xs text-muted-color mt-1">Risk Miner · inwestycje wod-kan</div>
        </div>

        <nav class="flex flex-col gap-4 grow">
          @for (g of groups(); track g.title) {
            <div class="flex flex-col gap-1">
              <div class="px-2 text-xs uppercase tracking-wider text-muted-color">{{ g.title }}</div>
              @for (i of g.items; track i.link) {
                <a [routerLink]="i.link" routerLinkActive="bg-primary-50 dark:bg-primary-950 text-primary font-semibold"
                   class="flex items-center gap-3 px-3 py-2 rounded-lg no-underline text-color hover:bg-surface-100 dark:hover:bg-surface-800">
                  <i [class]="i.icon"></i><span>{{ i.label }}</span>
                </a>
              }
            </div>
          }
        </nav>

        <div class="flex flex-col gap-1 px-1">
          <div class="text-xs uppercase tracking-wider text-muted-color">Rola · tryb demo</div>
          <p-selectbutton [options]="roles" optionLabel="label" optionValue="value" size="small"
                          [ngModel]="auth.role()" (ngModelChange)="auth.role.set($event)" [allowEmpty]="false" ariaLabel="Wybór roli" />
        </div>
        <p-button [label]="dark() ? 'Jasny motyw' : 'Ciemny motyw'" [icon]="dark() ? 'pi pi-sun' : 'pi pi-moon'"
                  severity="secondary" [text]="true" (onClick)="toggleDark()" />
      </aside>

      <div class="grow min-w-0 flex flex-col">
        <app-offline-banner />
        <main class="grow min-w-0 p-6 lg:p-8"><router-outlet /></main>
      </div>
    </div>
    <app-evidence-drawer />
    <p-toast />
  `,
})
export class Shell {
  readonly dark = signal(readInitialDark());

  constructor() {
    effect(() => {
      const role = this.auth.role();
      const path = this.router.url.split(/[?#]/)[0];
      const allowed = this.allGroups.flatMap((g) => g.items).filter((i) => i.roles.includes(role));
      const known = this.allGroups.flatMap((g) => g.items).some((i) => path.startsWith(i.link));
      if (known && !allowed.some((i) => path.startsWith(i.link))) void this.router.navigateByUrl(this.auth.home());
    });

    effect(() => {
      const d = this.dark();
      document.documentElement.classList.toggle('dark', d);
      try { localStorage.setItem('theme', d ? 'dark' : 'light'); } catch { /* brak dostępu do storage */ }
    });
  }

  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly roles = ROLES;

  private readonly allGroups: NavGroup[] = [
    {
      title: 'Wiedza',
      items: [
        { label: 'Projekty', icon: 'pi pi-folder', link: '/projekty', roles: ['analyst', 'expert', 'operator'] },
        { label: 'Import i źródła', icon: 'pi pi-cloud-download', link: '/import', roles: ['operator'] },
        { label: 'Expert Studio', icon: 'pi pi-verified', link: '/ekspert', roles: ['expert'] },
      ],
    },
    {
      title: 'Analiza',
      items: [
        { label: 'Nowa inwestycja', icon: 'pi pi-search', link: '/analiza', roles: ['analyst'] },
        { label: 'Chaos Lab', icon: 'pi pi-bolt', link: '/chaos-lab', roles: ['analyst'] },
        { label: 'Epidemic Radar', icon: 'pi pi-chart-scatter', link: '/radar', roles: ['analyst', 'expert'] },
      ],
    },
    {
      title: 'System',
      items: [{ label: 'Ustawienia', icon: 'pi pi-cog', link: '/ustawienia', roles: ['expert', 'operator'] }],
    },
  ];

  /** Menu zależne od roli; puste grupy znikają. */
  protected readonly groups = computed(() =>
    this.allGroups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(this.auth.role())) }))
      .filter((g) => g.items.length));

  toggleDark() {
    this.dark.update((d) => !d);
  }
}
