import { Routes } from '@angular/router';
import { PlaceholderData, PlaceholderPage } from './pages/placeholder.page';
import { Role } from './core/permissions';
import { roleGuard } from './core/role.guard';

const page = (path: string, data: PlaceholderData, roles?: Role[]) => ({
  path,
  component: PlaceholderPage,
  data: { ...data, roles },
  canActivate: [roleGuard],
  title: `${data.title} – Projekt Kompas`,
});

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
  page('import', {
    title: 'Import i źródła',
    subtitle: 'Wgrywanie danych i automatyczne wzbogacanie z publicznych źródeł',
    priority: 'P0',
    scope: [
      'Upload XLSX/CSV/PDF/DOCX',
      'Uruchomienie wzbogacania (BZP + drugie źródło) i ponowienie bez duplikatów',
      'Raport importu: znaleziono / dopasowano / do sprawdzenia / nie znaleziono / błąd',
      'Rejestr pobrań: adres, identyfikator, data, wersja',
    ],
  }, ['operator']),
  page('ekspert', {
    title: 'Expert Studio',
    subtitle: 'Weryfikacja połączeń, zdarzeń i wzorców',
    priority: 'P0',
    scope: [
      'Kolejka propozycji: dowód obok wniosku',
      'Akceptuj / popraw / odrzuć / wymaga dowodów',
      'Historia decyzji (kto, co, kiedy, stara i nowa wartość, powód)',
      'Zatwierdzanie Risk DNA',
    ],
  }, ['expert']),
  page('analiza', {
    title: 'Nowa inwestycja',
    subtitle: 'Analiza planowanego przedsięwzięcia',
    priority: 'P0',
    scope: [
      'Opis tekstowy lub dokumenty (PDF/DOCX)',
      'Project Twin: podobne inwestycje z uzasadnieniem',
      'Brakujące informacje, zagrożenie / kompletność / pewność',
      'Rekomendacje, przedziały odchyleń (tylko gdy próba wystarcza), Risk Graph',
      'Eksport JSON/CSV',
    ],
  }, ['analyst']),
  page('chaos-lab', {
    title: 'Chaos Lab',
    subtitle: 'Testy odporności z zatwierdzonych wzorców Risk DNA',
    priority: 'P1',
    scope: [
      'Scenariusze oparte na zatwierdzonych Risk DNA',
      'Jawne parametry testu (np. opóźnienie dostępu do działki)',
      'Wynik: odporne / częściowo / nieudokumentowane / luka krytyczna',
      'Checklista działań zapobiegawczych',
    ],
  }, ['analyst']),
  page('radar', {
    title: 'Epidemic Radar',
    subtitle: 'Kandydaci na powtarzalne wzorce błędów',
    priority: 'P1',
    scope: [
      'Grupy powtarzających się sekwencji ryzyk',
      'Liczebność próby i ostrzeżenie o ograniczeniach',
      'Dowody i decyzja eksperta',
    ],
  }, ['analyst', 'expert']),
  {
    path: 'ustawienia',
    loadChildren: () => import('./features/ustawienia/ustawienia.routes').then((m) => m.USTAWIENIA_ROUTES),
  },
  { path: '**', redirectTo: 'projekty' },
];
