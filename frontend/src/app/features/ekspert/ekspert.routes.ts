import { Routes } from '@angular/router';
import { roleGuard } from '../../core/role.guard';

export const EKSPERT_ROUTES: Routes = [
  {
    path: '',
    title: 'Expert Studio – Projekt Kompas',
    data: { roles: ['expert'] },
    canActivate: [roleGuard],
    loadComponent: () => import('./ekspert.page').then((m) => m.EkspertPage),
  },
];
