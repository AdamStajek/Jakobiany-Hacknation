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
  page('projekty/:id', {
    title: 'Karta projektu',
    subtitle: 'Postępowania, ogłoszenia, umowy, zmiany i zdarzenia',
    priority: 'P0',
    scope: [
      'Drzewo: projekt → postępowanie → część → ogłoszenie → umowa → zmiana',
      'Oś czasu i tabela zdarzeń/ryzyk R01–R15',
      'Kwoty z oznaczeniem netto/brutto, daty, źródła (Evidence Lens)',
    ],
  }),
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
  page('ustawienia', {
    title: 'Ustawienia i wiedza ekspercka',
    subtitle: 'Konfiguracja bez zmian w kodzie',
    priority: 'P0',
    scope: [
      'Katalog ryzyk R01–R15 i propozycje nowych kategorii',
      'Checklista informacji wg typu i fazy inwestycji',
      'Wagi podobieństwa',
      'Konfiguracja modelu i adresów źródeł',
    ],
  }, ['expert', 'operator']),
  { path: '**', redirectTo: 'projekty' },
];
