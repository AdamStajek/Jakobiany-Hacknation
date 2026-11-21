import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';
const KEY = 'wodo-theme';

/** Czy aktualnie obowiązuje ciemny motyw (czytane reaktywnie przez wykresy). */
export const darkMode = signal(false);

/** Motyw jasny/ciemny/systemowy; wybór zapamiętany w localStorage, klasa `app-dark` na <html>. */
@Injectable({providedIn: 'root'})
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.stored());
  private readonly query = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

  constructor() {
    this.apply();
    this.query?.addEventListener('change', () => this.apply());
  }

  cycle() {
    const next: Record<ThemeMode, ThemeMode> = {system: 'light', light: 'dark', dark: 'system'};
    this.set(next[this.mode()]);
  }

  set(mode: ThemeMode) {
    this.mode.set(mode);
    try { localStorage.setItem(KEY, mode); } catch { /* tryb prywatny: motyw tylko na sesję */ }
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
      const value = localStorage.getItem(KEY);
      return value === 'light' || value === 'dark' ? value : 'system';
    } catch { return 'system'; }
  }
}
