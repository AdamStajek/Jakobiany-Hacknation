import { Routes } from '@angular/router';

const analysis = () => import('./features/analysis/analysis-page').then((m) => m.AnalysisPage);

export const routes: Routes = [
  {path: '', title: 'WodoStrażnik · Analiza działki', loadComponent: analysis},
  {path: 'dzialka/:id', title: 'WodoStrażnik · Działka', loadComponent: analysis},
  {path: 'dzialka/:id/analiza/:analysisId', title: 'WodoStrażnik · Raport', loadComponent: analysis},
  {path: 'paszporty', title: 'WodoStrażnik · Paszporty pól',
    loadComponent: () => import('./features/passport/passport-page').then((m) => m.PassportPage)},
  {path: 'dzialka/:id/paszport', title: 'WodoStrażnik · Paszport działki',
    loadComponent: () => import('./features/passport/passport-page').then((m) => m.PassportPage)},
  {path: 'metody', title: 'WodoStrażnik · Jak to działa', loadComponent: () => import('./features/methods/methods-page').then((m) => m.MethodsPage)},
  {path: '**', redirectTo: ''},
];
