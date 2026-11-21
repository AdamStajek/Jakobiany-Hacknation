import { TestBed } from '@angular/core/testing';
import { ThemeService, darkMode } from './theme';

describe('ThemeService', () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem('pw.consent.v1', 'granted'); document.documentElement.classList.remove('app-dark'); });

  it('domyślnie jasny; przełącza jasny → ciemny → system → jasny', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.mode()).toBe('light');
    theme.cycle(); expect(theme.mode()).toBe('dark');
    theme.cycle(); expect(theme.mode()).toBe('system');
    theme.cycle(); expect(theme.mode()).toBe('light');
  });

  it('ciemny motyw ustawia klasę na <html>, sygnał i zapis', () => {
    const theme = TestBed.inject(ThemeService);
    theme.set('dark');
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);
    expect(darkMode()).toBe(true);
    expect(localStorage.getItem('wodo-theme')).toBe('dark');
    theme.set('light');
    expect(document.documentElement.classList.contains('app-dark')).toBe(false);
    expect(darkMode()).toBe(false);
  });
});
