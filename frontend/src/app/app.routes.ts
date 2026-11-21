import { Routes } from '@angular/router';

const analysis = () => import('./features/analysis/analysis-page').then((m) => m.AnalysisPage);

export const routes: Routes = [
  {path: '', title: 'Pole Widzenia · Analiza działki', loadComponent: analysis},
  {path: 'dzialka/:id', title: 'Pole Widzenia · Działka', loadComponent: analysis},
  {path: 'dzialka/:id/analiza/:analysisId', title: 'Pole Widzenia · Raport', loadComponent: analysis},
  {path: 'pola', title: 'Pole Widzenia · Moje pola', loadComponent: () => import('./features/fields/fields-page').then((m) => m.FieldsPage)},
  {path: 'paszporty', title: 'Pole Widzenia · Paszporty pól',
    loadComponent: () => import('./features/passport/passport-page').then((m) => m.PassportPage)},
  {path: 'dzialka/:id/paszport', title: 'Pole Widzenia · Paszport działki',
    loadComponent: () => import('./features/passport/passport-page').then((m) => m.PassportPage)},
  {path: 'eksperymenty', loadChildren: () => import('./features/experiments/experiments-page').then((m) => m.experimentRoutes)},
  {path: 'metody', title: 'Pole Widzenia · Jak to działa', loadComponent: () => import('./features/methods/methods-page').then((m) => m.MethodsPage)},
  {path: '**', redirectTo: ''},
];
