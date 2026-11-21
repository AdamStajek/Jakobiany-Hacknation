const DATE_TIME = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw',
});
const DATE = new Intl.DateTimeFormat('pl-PL', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'});

/** Czytelna data i godzina po polsku (czas polski), np. „21 listopada 2026, 23:16”. Nieczytelną wartość zwraca bez zmian. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_TIME.format(date);
}

/** Czytelna data (bez godziny) po polsku z wartości „RRRR-MM-DD” lub ISO; brak lub błąd zwraca bez zmian. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE.format(date);
}
