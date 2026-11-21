import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Zaproszenie do zalogowania w kontekście. Zawsze z wyjściem „Kontynuuj bez konta”; nie woła API ani store'ów. */
@Component({
  selector: 'app-login-prompt',
  imports: [RouterLink],
  template: `
    <section class="pw-card flex flex-col gap-3 p-4" [attr.aria-label]="title()">
      <div class="flex items-start gap-3">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-50 dark:bg-primary-950">
          <i class="pi {{icon()}} text-primary" aria-hidden="true"></i>
        </span>
        <div class="min-w-0">
          <h2 class="text-sm font-semibold">{{title()}}</h2>
          <p class="mt-1 text-sm text-muted-color">{{text()}}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <a routerLink="/zaloguj" [queryParams]="query()"
          class="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-contrast hover:opacity-90">
          <i class="pi pi-sign-in" aria-hidden="true"></i>Zaloguj się
        </a>
        <a routerLink="/rejestracja" [queryParams]="query()"
          class="inline-flex h-10 items-center gap-2 rounded-lg border border-surface px-4 text-sm font-medium hover:bg-surface-100 dark:hover:bg-surface-800">
          <i class="pi pi-user-plus" aria-hidden="true"></i>Załóż konto
        </a>
        <button type="button" (click)="dismissed.emit()"
          class="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted-color hover:bg-surface-100 dark:hover:bg-surface-800">
          Kontynuuj bez konta
        </button>
      </div>
    </section>
  `,
})
export class LoginPrompt {
  readonly title = input.required<string>();
  readonly text = input('');
  readonly icon = input('pi-user');
  /** Adres, na który wraca użytkownik po zalogowaniu (już zwalidowany przez `loginQuery`). */
  readonly query = input<{returnUrl?: string}>({});
  readonly dismissed = output<void>();
}
