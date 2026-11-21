import { Routes } from '@angular/router';
import { roleGuard } from '../../core/role.guard';

export const USTAWIENIA_ROUTES: Routes = [
  {
    path: '',
    title: 'Ustawienia i wiedza ekspercka – Projekt Kompas',
    data: { roles: ['expert', 'operator'] },
    canActivate: [roleGuard],
    loadComponent: () => import('./ustawienia.page').then((m) => m.UstawieniaPage),
  },
];
