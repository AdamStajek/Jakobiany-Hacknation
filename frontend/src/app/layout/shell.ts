import { Component, effect, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { EvidenceDrawer } from '../shared/evidence-drawer';

function readInitialDark(): boolean {
  try {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
  } catch { /* ignoruj */ }
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

interface NavItem { label: string; icon: string; link: string; }
interface NavGroup { title: string; items: NavItem[]; }

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, EvidenceDrawer],
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
          @for (g of groups; track g.title) {
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

        <p-button [label]="dark() ? 'Jasny motyw' : 'Ciemny motyw'" [icon]="dark() ? 'pi pi-sun' : 'pi pi-moon'"
                  severity="secondary" [text]="true" (onClick)="toggleDark()" />
      </aside>

      <main class="grow min-w-0 p-6 lg:p-8"><router-outlet /></main>
    </div>
    <app-evidence-drawer />
  `,
})
export class Shell {
  readonly dark = signal(readInitialDark());

  constructor() {
    effect(() => {
      const d = this.dark();
      document.documentElement.classList.toggle('dark', d);
      try { localStorage.setItem('theme', d ? 'dark' : 'light'); } catch { /* brak dostępu do storage */ }
    });
  }

  readonly groups: NavGroup[] = [
    {
      title: 'Wiedza',
      items: [
        { label: 'Projekty', icon: 'pi pi-folder', link: '/projekty' },
        { label: 'Import i źródła', icon: 'pi pi-cloud-download', link: '/import' },
        { label: 'Expert Studio', icon: 'pi pi-verified', link: '/ekspert' },
      ],
    },
    {
      title: 'Analiza',
      items: [
        { label: 'Nowa inwestycja', icon: 'pi pi-search', link: '/analiza' },
        { label: 'Chaos Lab', icon: 'pi pi-bolt', link: '/chaos-lab' },
        { label: 'Epidemic Radar', icon: 'pi pi-chart-scatter', link: '/radar' },
      ],
    },
    {
      title: 'System',
      items: [{ label: 'Ustawienia', icon: 'pi pi-cog', link: '/ustawienia' }],
    },
  ];

  toggleDark() {
    this.dark.update((d) => !d);
  }
}
