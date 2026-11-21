import { Routes } from '@angular/router';

export const routes: Routes = [
  {path: '', title: 'WodoStrażnik · Analiza działki', loadComponent: () => import('./features/analysis/analysis-page').then((m) => m.AnalysisPage)},
  {path: 'metody', title: 'WodoStrażnik · Jak to działa', loadComponent: () => import('./features/methods/methods-page').then((m) => m.MethodsPage)},
  {path: '**', redirectTo: ''},
];
