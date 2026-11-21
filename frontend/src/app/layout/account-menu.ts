import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../core/state/auth.store';
import { loginQuery } from '../core/state/return-url';

/** Menu konta: w pasku bocznym (desktop) pełne, w górnym pasku (telefon) jako ikona. */
@Component({
  selector: 'app-account-menu',
  imports: [RouterLink],
  template: `
    @if (auth.status() !== 'loading') {
      @if (auth.user(); as user) {
        @if (variant() === 'header') {
          <a routerLink="/konto" [attr.aria-label]="'Konto: ' + user.username" class="relative grid h-10 w-10 place-items-center rounded-full hover:bg-surface-100 dark:hover:bg-surface-800">
            <i class="pi pi-user" aria-hidden="true"></i>
            @if (!user.email_verified) { <i class="pi pi-exclamation-circle absolute right-0 top-0 text-xs text-amber-700 dark:text-amber-400" aria-hidden="true"></i> }
          </a>
        } @else {
          <div class="flex items-center gap-1">
            <a routerLink="/konto" [attr.aria-current]="active() ? 'page' : null"
              class="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-surface-100 dark:hover:bg-surface-800"
              [class]="active() ? 'bg-primary-50 font-semibold text-primary dark:bg-primary-950' : ''">
              <i class="pi pi-user text-base" aria-hidden="true"></i><span class="truncate">{{user.username}}</span>
              @if (!user.email_verified) { <i class="pi pi-exclamation-circle text-amber-700 dark:text-amber-400" title="E-mail niepotwierdzony" aria-label="E-mail niepotwierdzony"></i> }
            </a>
            <button type="button" (click)="logout()" aria-label="Wyloguj się" title="Wyloguj się"
              class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-color hover:bg-surface-100 dark:hover:bg-surface-800">
              <i class="pi pi-sign-out" aria-hidden="true"></i>
            </button>
          </div>
        }
      } @else if (variant() === 'header') {
        <a routerLink="/zaloguj" [queryParams]="query()" aria-label="Zaloguj się" class="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-100 dark:hover:bg-surface-800">
          <i class="pi pi-sign-in" aria-hidden="true"></i>
        </a>
      } @else {
        <a routerLink="/zaloguj" [queryParams]="query()" class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-surface-100 dark:hover:bg-surface-800">
          <i class="pi pi-sign-in text-base" aria-hidden="true"></i>Zaloguj się
        </a>
      }
    }
  `,
})
export class AccountMenu {
  protected readonly auth = inject(AuthStore);

  readonly variant = input<'sidebar' | 'header'>('sidebar');
  /** Bieżący adres: po zalogowaniu wracamy na to samo miejsce. */
  readonly url = input('/');
  protected readonly query = computed(() => loginQuery(this.url()));
  protected readonly active = computed(() => this.url().startsWith('/konto'));

  protected async logout() {
    try { await this.auth.logout(); } catch { /* sesja i tak została zamknięta po stronie aplikacji */ }
  }
}
