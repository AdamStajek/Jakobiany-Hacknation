import { ProblemZone } from '../../core/api/types';
import { normalizeSources, normalizeWatering, normalizeZones } from './field-answers';

const zone = (type: string, date: string): ProblemZone => ({geometry: {type: 'Point', coordinates: [1, 2]}, type, date, description: ''});

describe('field-answers', () => {
  it('strefa bez typu i daty dostaje „Inne” i dzień analizy', () => {
    const {items, warnings} = normalizeZones([zone('', '')], '2026-05-01');
    expect(items[0].type).toBe('Inne');
    expect(items[0].date).toBe('2026-05-01');
    expect(warnings.length).toBe(1);
  });
  it('poprawna strefa przechodzi bez zmian i bez komunikatu', () => {
    const {items, warnings} = normalizeZones([zone('Erozja', '2026-04-01')], '2026-05-01');
    expect(items[0].type).toBe('Erozja');
    expect(items[0].date).toBe('2026-04-01');
    expect(warnings).toEqual([]);
  });
  it('data strefy z przyszłości zamieniana na dzień analizy', () => {
    expect(normalizeZones([zone('Erozja', '2026-06-01')], '2026-05-01').items[0].date).toBe('2026-05-01');
  });
  it('pomija zdarzenia nawadniania bez poprawnej daty', () => {
    const {items, warnings} = normalizeWatering([
      {date: '', dose_mm: 3}, {date: '2026-06-01', dose_mm: 1}, {date: '2026-04-30', dose_mm: -2}], '2026-05-01');
    expect(items).toEqual([{date: '2026-04-30', dose_mm: null}]);
    expect(warnings.length).toBe(1);
  });
  it('„brak dostępu” wygrywa z innymi źródłami', () => {
    expect(normalizeSources(['Studnia', 'Brak dostępu']).items).toEqual(['Brak dostępu']);
    expect(normalizeSources(['Studnia']).warnings).toEqual([]);
  });
});
