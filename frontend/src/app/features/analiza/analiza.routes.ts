import { Routes } from '@angular/router';
import { roleGuard } from '../../core/role.guard';

export const ANALIZA_ROUTES: Routes = [
  {
    path: '',
    title: 'Nowa inwestycja – Projekt Kompas',
    canActivate: [roleGuard],
    data: { roles: ['analyst'] },
    loadComponent: () => import('./wizard.page').then((m) => m.WizardPage),
  },
  {
    path: ':assessmentId',
    title: 'Wynik analizy – Projekt Kompas',
    canActivate: [roleGuard],
    data: { roles: ['analyst'] },
    loadComponent: () => import('./result/result.page').then((m) => m.ResultPage),
  },
];
