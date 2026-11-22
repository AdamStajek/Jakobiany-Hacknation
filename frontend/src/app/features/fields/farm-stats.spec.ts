import type { Field } from '../../core/state/fields.store';
import { farmStats } from './farm-stats';

import type { Geometry } from '../../core/api/types';
const geometry: Geometry = {type: 'Polygon', coordinates: []};
const status = (risk: string, over: Partial<NonNullable<Field['status']>> = {}) =>
  ({risk, date: '2026-11-10', savedAt: '2026-11-10T10:00:00Z', analysisId: 'a', parcelId: 'p', dryDays: null, balanceMm: null, ...over});
const field = (id: string, over: Partial<Field> = {}): Field =>
  ({id, name: `Pole ${id}`, color: 'green', crop: null, parcels: [{id: `${id}.1`, area_ha: 2, geometry}], status: null, ...over});
const label = (id: string) => ({wheat: 'Pszenica'}[id as 'wheat'] ?? '');
const NOW = Date.parse('2026-11-12T00:00:00Z');

describe('farmStats', () => {
  it('liczy pola, działki i powierzchnię', () => {
    const s = farmStats([field('a'), field('b', {parcels: [{id: 'b1', area_ha: 1.5, geometry}, {id: 'b2', area_ha: 0.5, geometry}]})], label, NOW);
    expect([s.fields, s.parcels, s.totalAreaHa]).toEqual([2, 3, 4]);
  });

  it('nie podaje sumy, gdy powierzchnia nieznana dla którejś działki', () => {
    const s = farmStats([field('a'), field('b', {parcels: [{id: 'b1', geometry}]})], label, NOW);
    expect(s.totalAreaHa).toBeNull();
  });

  it('grupuje uprawy z etykietami i brakiem uprawy', () => {
    const s = farmStats([field('a', {crop: 'wheat'}), field('b', {crop: 'wheat'}), field('c')], label, NOW);
    expect(s.crops.map((c) => [c.label, c.fields, c.areaHa])).toEqual([['Pszenica', 2, 4], ['Uprawa nieokreślona', 1, 2]]);
  });

  it('bierze powody uwagi, brak raportu i nieaktualność ze stanu pól', () => {
    const s = farmStats([
      field('a', {status: status('Podwyższone')}),
      field('b'),
      field('c', {status: status('Niskie', {savedAt: '2026-10-01T00:00:00Z', date: '2026-10-01'})}),
    ], label, NOW);
    expect(s.attention).toEqual([{id: 'a', name: 'Pole a', reasons: ['Ryzyko: Podwyższone']}]);
    expect(s.withoutReport).toEqual(['Pole b']);
    expect(s.stale).toEqual(['Pole c']);
    expect(s.lastReportDate).toBe('2026-11-10');
  });

  it('dla braku pól zwraca puste podsumowanie', () => {
    const s = farmStats([], label, NOW);
    expect([s.fields, s.totalAreaHa, s.lastReportDate]).toEqual([0, null, null]);
  });
});
