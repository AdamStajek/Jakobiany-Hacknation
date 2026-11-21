import { Routes } from '@angular/router';
import { authGuard } from './core/state/auth.guard';

const analysis = () => import('./features/analysis/analysis-page').then((m) => m.AnalysisPage);

export const routes: Routes = [
  {path: '', title: 'Pole Widzenia · Analiza działki', loadComponent: analysis},
  {path: 'dzialka/:id', title: 'Pole Widzenia · Działka', loadComponent: analysis},
  {path: 'dzialka/:id/analiza/:analysisId', title: 'Pole Widzenia · Raport', loadComponent: analysis},
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
  // Paszporty są widokiem „Moich pól”; stare adresy zostają jako przekierowania.
  {path: 'paszporty', redirectTo: 'pola?widok=paszporty'},
  {path: 'dzialka/:id/paszport', title: 'Pole Widzenia · Paszport działki',
    loadComponent: () => import('./features/fields/parcel-passport-page').then((m) => m.ParcelPassportPage)},
  {path: 'eksperymenty', loadChildren: () => import('./features/experiments/experiments-page').then((m) => m.experimentRoutes)},
  {path: 'metody', title: 'Pole Widzenia · Jak to działa', loadComponent: () => import('./features/methods/methods-page').then((m) => m.MethodsPage)},
  {path: '**', redirectTo: ''},
];
