import { Injectable, computed, signal } from '@angular/core';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { Geometry, ProblemZone } from '../api/types';

export const MAX_ZONES = 30;
export const OUTSIDE_NOTICE = 'To miejsce jest poza działką. Dotknij wewnątrz zaznaczonego obszaru.';
export const LIMIT_NOTICE = `Masz już ${MAX_ZONES} miejsc. Usuń któreś, aby dodać kolejne.`;
/** `value` to kontrakt z backendem (`ProblemZone.type`), `label` to tekst na kafelku. */
export const ZONE_TYPES = [
  {value: 'Przesuszenie', label: 'Przesuszenie'}, {value: 'Zastoiska', label: 'Zastój wody'}, {value: 'Erozja', label: 'Erozja'},
  {value: 'Słaby plon', label: 'Słaby plon'}, {value: 'Inne', label: 'Inne'},
];

export type ZoneDraft = {id: number; coordinates: [number, number]; type: string; date: string; description: string; recommendation_observations: string[]};

/** Miejsca problemowe zaznaczone na mapie Analizy; ten sam stan czyta lista w „Dodatkowych informacjach o polu”. */
@Injectable({providedIn: 'root'})
export class ZonesStore {
  readonly zones = signal<ZoneDraft[]>([]);
  /** Tryb mapy „Zaznacz miejsca problemowe”. */
  readonly marking = signal(false);
  /** Komunikat ostatniej próby (poza działką, limit); pusty, gdy wszystko w porządku. */
  readonly notice = signal('');
  readonly markers = computed(() => this.zones().map((zone) => zone.coordinates));
  /** Id działki, do której należą zaznaczone miejsca; pozwala je zachować, gdy formularz powstaje na nowo. */
  parcelKey: string | null = null;
  private nextId = 1;

  /** Dodaje punkt tylko wewnątrz granicy i do limitu; w przeciwnym razie ustawia komunikat (tryb zostaje włączony). */
  add(coordinates: [number, number], boundary: Geometry | null): boolean {
    if (this.zones().length >= MAX_ZONES) { this.notice.set(LIMIT_NOTICE); return false; }
    if (!boundary || !booleanPointInPolygon(coordinates, boundary as Parameters<typeof booleanPointInPolygon>[1])) {
      this.notice.set(OUTSIDE_NOTICE);
      return false;
    }
    this.zones.update((zones) => [...zones, {id: this.nextId++, coordinates, type: '', date: '', description: '', recommendation_observations: []}]);
    this.notice.set('');
    return true;
  }

  update(id: number, patch: Partial<Omit<ZoneDraft, 'id' | 'coordinates'>>) {
    this.zones.update((zones) => zones.map((zone) => (zone.id === id ? {...zone, ...patch} : zone)));
  }

  remove(id: number) {
    this.zones.update((zones) => zones.filter((zone) => zone.id !== id));
    this.notice.set('');
  }

  undo() {
    this.zones.update((zones) => zones.slice(0, -1));
    this.notice.set('');
  }

  clear() {
    this.zones.set([]);
    this.notice.set('');
  }

  startMarking() { this.marking.set(true); this.notice.set(''); }

  stopMarking() { this.marking.set(false); this.notice.set(''); }

  /** Nowa działka: wszystko od zera. */
  reset() { this.clear(); this.stopMarking(); }

  /** Kontrakt `problem_zones` (typ i data uzupełniane później przez `normalizeZones`). */
  toProblemZones(): ProblemZone[] {
    return this.zones().map(({coordinates, type, date, description, recommendation_observations}) =>
      ({geometry: {type: 'Point', coordinates}, type, date, description, recommendation_observations}));
  }
}
