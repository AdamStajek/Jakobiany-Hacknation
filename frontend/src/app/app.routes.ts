import { Routes } from '@angular/router';
import { roleGuard } from './core/role.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'projekty' },
  {
    path: 'projekty',
    title: 'Projekty – Projekt Kompas',
    loadComponent: () => import('./features/projects/projects.page').then((m) => m.ProjectsPage),
  },
  {
    path: 'projekty/:id',
    title: 'Karta projektu – Projekt Kompas',
    loadComponent: () => import('./features/projects/project-detail/project-detail.page').then((m) => m.ProjectDetailPage),
  },
  {
    path: 'import',
    title: 'Import i źródła – Projekt Kompas',
    canActivate: [roleGuard],
    data: { roles: ['operator'] },
    loadComponent: () => import('./features/imports/import.page').then((m) => m.ImportPage),
  },
  { path: 'ekspert', loadChildren: () => import('./features/ekspert/ekspert.routes').then((m) => m.EKSPERT_ROUTES) },
  { path: 'analiza', loadChildren: () => import('./features/analiza/analiza.routes').then((m) => m.ANALIZA_ROUTES) },
  {
    path: 'ustawienia',
    loadChildren: () => import('./features/ustawienia/ustawienia.routes').then((m) => m.USTAWIENIA_ROUTES),
  },
  {
    path: 'brak-dostepu',
    title: 'Brak dostępu – Projekt Kompas',
    loadComponent: () => import('./pages/access-denied.page').then((m) => m.AccessDeniedPage),
  },
  { path: '**', redirectTo: 'projekty' },
];
