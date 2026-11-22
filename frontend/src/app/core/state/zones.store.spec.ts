import { TestBed } from '@angular/core/testing';
import { Geometry } from '../api/types';
import { LIMIT_NOTICE, MAX_ZONES, OUTSIDE_NOTICE, ZonesStore } from './zones.store';

const SQUARE: Geometry = {type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]};

describe('ZonesStore', () => {
  let zones: ZonesStore;
  beforeEach(() => { zones = TestBed.inject(ZonesStore); });

  it('dodaje punkty wewnątrz działki i udostępnia je jako znaczniki', () => {
    expect(zones.add([1, 1], SQUARE)).toBe(true);
    expect(zones.add([2, 2], SQUARE)).toBe(true);
    expect(zones.markers()).toEqual([[1, 1], [2, 2]]);
    expect(zones.notice()).toBe('');
  });

  it('punkt poza działką daje komunikat i nie jest dodany', () => {
    expect(zones.add([20, 20], SQUARE)).toBe(false);
    expect(zones.zones().length).toBe(0);
    expect(zones.notice()).toBe(OUTSIDE_NOTICE);
    expect(zones.add([1, 1], null)).toBe(false);
  });

  it('limit 30 miejsc z komunikatem', () => {
    for (let i = 0; i < MAX_ZONES; i++) zones.add([1, 1], SQUARE);
    expect(zones.add([1, 1], SQUARE)).toBe(false);
    expect(zones.zones().length).toBe(MAX_ZONES);
    expect(zones.notice()).toBe(LIMIT_NOTICE);
  });

  it('cofnij, usuń i wyczyść oraz kontrakt problem_zones', () => {
    zones.add([1, 1], SQUARE); zones.add([2, 2], SQUARE); zones.add([3, 3], SQUARE);
    zones.undo();
    expect(zones.zones().length).toBe(2);
    zones.update(zones.zones()[0].id, {type: 'Erozja', description: 'rów'});
    expect(zones.toProblemZones()[0]).toEqual({geometry: {type: 'Point', coordinates: [1, 1]}, type: 'Erozja', date: '', description: 'rów', recommendation_observations: []});
    zones.remove(zones.zones()[0].id);
    expect(zones.markers()).toEqual([[2, 2]]);
    zones.startMarking();
    zones.reset();
    expect(zones.zones()).toEqual([]);
    expect(zones.marking()).toBe(false);
  });
});
