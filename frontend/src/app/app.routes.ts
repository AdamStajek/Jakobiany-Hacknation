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
    path: 'import', title: 'Import i źródła – Projekt Kompas',
    canActivate: [roleGuard], data: { roles: ['operator'] },
    loadComponent: () => import('./features/imports/import.page').then((m) => m.ImportPage),
  },
  {
    path: 'ekspert', title: 'Weryfikacja ekspercka – Projekt Kompas',
    canActivate: [roleGuard], data: { roles: ['expert'] },
    loadComponent: () => import('./features/expert/expert.page').then((m) => m.ExpertPage),
  },
  {
    path: 'analiza', title: 'Nowa inwestycja – Projekt Kompas',
    canActivate: [roleGuard], data: { roles: ['analyst'] },
    loadComponent: () => import('./features/analysis/analysis.page').then((m) => m.AnalysisPage),
  },
  {
    path: 'analiza/wynik/:id', title: 'Wynik analizy – Projekt Kompas',
    canActivate: [roleGuard], data: { roles: ['analyst'] },
    loadComponent: () => import('./features/analysis/assessment.page').then((m) => m.AssessmentPage),
  },
  {
    path: 'ustawienia', title: 'Wiedza sektorowa – Projekt Kompas',
    canActivate: [roleGuard], data: { roles: ['expert'] },
    loadComponent: () => import('./features/expert/rules.page').then((m) => m.RulesPage),
  },
  { path: '**', redirectTo: 'projekty' },
];
