import { Injectable, effect, inject, signal } from '@angular/core';
import { ConsentStore } from '../state/consent.store';

export type ThemeMode = 'system' | 'light' | 'dark';
const KEY = 'wodo-theme';

/** Czy aktualnie obowiązuje ciemny motyw (czytane reaktywnie przez wykresy). */
export const darkMode = signal(false);

/** Motyw jasny/ciemny/systemowy; wybór zapamiętany w localStorage (tylko za zgodą), klasa `app-dark` na <html>. */
@Injectable({providedIn: 'root'})
export class ThemeService {
  private readonly consent = inject(ConsentStore);
  readonly mode = signal<ThemeMode>(this.stored());
  private readonly query = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

  constructor() {
    this.apply();
    // Wybór zapamiętujemy tylko za zgodą (także gdy zgoda padnie po wyborze motywu).
    effect(() => { if (this.consent.storageAllowed()) this.consent.write(KEY, this.mode()); });
    this.query?.addEventListener('change', () => this.apply());
  }

  cycle() {
    const next: Record<ThemeMode, ThemeMode> = {system: 'light', light: 'dark', dark: 'system'};
    this.set(next[this.mode()]);
  }

  set(mode: ThemeMode) {
    this.mode.set(mode);
    this.consent.write(KEY, mode);
    this.apply();
  }

  private apply() {
    const mode = this.mode();
    const dark = mode === 'dark' || (mode === 'system' && !!this.query?.matches);
    document.documentElement.classList.toggle('app-dark', dark);
    darkMode.set(dark);
  }

  private stored(): ThemeMode {
    try {
      const value = this.consent.read(KEY);
      return value === 'system' || value === 'dark' ? value : 'light';
    } catch { return 'light'; }
  }
}
