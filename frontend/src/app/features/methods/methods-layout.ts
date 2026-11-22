import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-methods-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="mx-auto max-w-6xl px-4 pt-4 pb-24 lg:px-8 lg:pt-8 lg:pb-8">
      <nav aria-label="Jak to działa" class="mb-5 flex flex-wrap gap-x-3 border-b border-surface print:hidden">
        @for (tab of tabs; track tab.path) {
          <a [routerLink]="tab.path" routerLinkActive="font-semibold" [routerLinkActiveOptions]="{exact: tab.exact}"
            ariaCurrentWhenActive="page"
            class="inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm text-muted-color hover:text-color aria-[current=page]:border-primary aria-[current=page]:text-primary">
            {{tab.label}}
          </a>
        }
      </nav>
      <router-outlet />
    </div>
  `,
})
export class MethodsLayout {
  protected readonly tabs = [
    {path: '/metody', label: 'Metody', exact: true},
    {path: '/metody/eksperymenty', label: 'Eksperymenty', exact: false},
  ];
}
