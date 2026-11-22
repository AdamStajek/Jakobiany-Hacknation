import { Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../core/state/auth.store';
import { loginQuery } from '../core/state/return-url';
import { ThemeMode, ThemeService } from '../core/theme/theme';

const THEMES: {mode: ThemeMode; label: string; icon: string}[] = [
  {mode: 'system', label: 'Systemowy', icon: 'pi-desktop'},
  {mode: 'light', label: 'Jasny', icon: 'pi-sun'},
  {mode: 'dark', label: 'Ciemny', icon: 'pi-moon'},
];

/** Menu konta (ikona użytkownika): konto, hasło, powiadomienia, motyw i wylogowanie; dla gościa logowanie. */
@Component({
  selector: 'app-account-menu',
  imports: [RouterLink],
  templateUrl: './account-menu.html',
  host: {'(document:click)': 'outside($event)', '(keydown.escape)': 'escape()'},
})
export class AccountMenu {
  protected readonly auth = inject(AuthStore);
  protected readonly theme = inject(ThemeService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  readonly variant = input<'sidebar' | 'header'>('sidebar');
  /** Bieżący adres: po zalogowaniu wracamy na to samo miejsce; zmiana adresu zamyka menu. */
  readonly url = input('/');
  protected readonly open = signal(false);
  protected readonly themes = THEMES;
  protected readonly item = 'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-surface-100 dark:hover:bg-surface-800';
  protected readonly query = computed(() => loginQuery(this.url()));
  protected readonly triggerLabel = computed(() => {
    const user = this.auth.user();
    return user ? `Menu konta: ${user.username}` : 'Menu: logowanie i ustawienia';
  });

  constructor() {
    effect(() => { this.url(); untracked(() => this.open.set(false)); });
  }

  protected toggle() { this.open.update((value) => !value); }
  protected close() { this.open.set(false); }

  protected escape() {
    if (!this.open()) return;
    this.open.set(false);
    this.trigger()?.nativeElement.focus();
  }

  protected outside(event: Event) {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  protected async logout() {
    this.open.set(false);
    try { await this.auth.logout(); } catch { /* sesja i tak została zamknięta po stronie aplikacji */ }
  }
}
