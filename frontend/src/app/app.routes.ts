import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { authGuard } from './core/state/auth.guard';

const analysis = () => import('./features/analysis/analysis-page').then((m) => m.AnalysisPage);

/**
 * Jedna trasa dla /sprawdz, /dzialka/:id i /dzialka/:id/analiza/:analysisId: dzięki temu zmiana działki lub
 * pojawienie się raportu (zmiana adresu) nie niszczy i nie odtwarza strony z mapą (to powodowało migotanie).
 */
export function analysisMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  const [first, , mid] = segments.map((s) => s.path);
  if (segments.length === 1 && first === 'sprawdz') return {consumed: segments};
  if (first !== 'dzialka') return null;
  if (segments.length === 2) return {consumed: segments, posParams: {id: segments[1]}};
  if (segments.length === 4 && mid === 'analiza') return {consumed: segments, posParams: {id: segments[1], analysisId: segments[3]}};
  return null;
}

export const routes: Routes = [
  {path: '', pathMatch: 'full', title: 'Pole Widzenia · Start', loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage)},
  {matcher: analysisMatcher, title: 'Pole Widzenia · Analizuj pole', loadComponent: analysis},
  {path: 'pola', title: 'Pole Widzenia · Moje pola', loadComponent: () => import('./features/fields/fields-page').then((m) => m.FieldsPage)},
  {path: 'zaloguj', title: 'Pole Widzenia · Logowanie', loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage)},
  {path: 'rejestracja', title: 'Pole Widzenia · Rejestracja', loadComponent: () => import('./features/auth/register-page').then((m) => m.RegisterPage)},
  // Linki z wiadomości e-mail (bez strażnika: otwierane także bez sesji).
  {path: 'konto/potwierdz', title: 'Pole Widzenia · Potwierdzenie e-maila',
    loadComponent: () => import('./features/auth/verify-email-page').then((m) => m.VerifyEmailPage)},
  {path: 'konto/reset', title: 'Pole Widzenia · Nowe hasło', loadComponent: () => import('./features/auth/reset-page').then((m) => m.ResetPage)},
  {path: 'zapomniane-haslo', title: 'Pole Widzenia · Odzyskiwanie hasła', loadComponent: () => import('./features/auth/forgot-page').then((m) => m.ForgotPage)},
  {path: 'konto', title: 'Pole Widzenia · Konto', canActivate: [authGuard],
    loadComponent: () => import('./features/auth/account-page').then((m) => m.AccountPage)},
  // Dane działek są widokiem „Moich pól”; stare adresy zostają jako przekierowania.
  {path: 'paszporty', redirectTo: 'pola?widok=paszporty'},
  {path: 'dzialka/:id/paszport', title: 'Pole Widzenia · Dane działki',
    loadComponent: () => import('./features/fields/parcel-passport-page').then((m) => m.ParcelPassportPage)},
  {path: 'eksperymenty', pathMatch: 'full', redirectTo: 'metody/eksperymenty'},
  {path: 'eksperymenty/:slug', pathMatch: 'full', redirectTo: 'metody/eksperymenty/:slug'},
  {path: 'powiadomienia', title: 'Pole Widzenia · Powiadomienia',
    loadComponent: () => import('./features/notifications/notifications-page').then((m) => m.NotificationsPage)},
  {path: 'metody', loadComponent: () => import('./features/methods/methods-layout').then((m) => m.MethodsLayout), children: [
    {path: '', pathMatch: 'full', title: 'Pole Widzenia · Jak to działa',
      loadComponent: () => import('./features/methods/methods-page').then((m) => m.MethodsPage)},
    {path: 'eksperymenty', loadChildren: () => import('./features/experiments/experiments-page').then((m) => m.experimentRoutes)},
  ]},
  {path: 'prywatnosc', title: 'Pole Widzenia · Polityka prywatności',
    loadComponent: () => import('./features/legal/privacy-page').then((m) => m.PrivacyPage)},
  {path: '**', redirectTo: ''},
];
