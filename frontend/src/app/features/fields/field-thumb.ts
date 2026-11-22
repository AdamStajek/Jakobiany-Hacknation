import { Component, computed, input } from '@angular/core';
import type { FieldParcel } from '../../core/state/fields.store';

const SIZE = 56;
const PAD = 4;

type Ring = number[][];

const ringsOf = (parcels: FieldParcel[]): Ring[] => parcels.flatMap(({geometry}) =>
  (geometry.type === 'MultiPolygon' ? geometry.coordinates.flat() : geometry.coordinates) as Ring[]);

/** Ścieżka SVG (viewBox 56×56) z obrysem działek pola; pusta, gdy brak geometrii. Rzutowanie równoprzedziałkowe z korektą na szerokość geograficzną. */
export function thumbPath(parcels: FieldParcel[]): string {
  const rings = ringsOf(parcels).filter((ring) => ring.length > 2);
  const points = rings.flat();
  if (!points.length) return '';
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const minLon = Math.min(...lons), minLat = Math.min(...lats);
  const k = Math.cos((((minLat + Math.max(...lats)) / 2) * Math.PI) / 180);
  const width = (Math.max(...lons) - minLon) * k;
  const height = Math.max(...lats) - minLat;
  const scale = (SIZE - 2 * PAD) / (Math.max(width, height) || 1);
  const offX = (SIZE - width * scale) / 2;
  const offY = (SIZE - height * scale) / 2;
  const at = ([lon, lat]: number[]) => `${(offX + (lon - minLon) * k * scale).toFixed(1)} ${(SIZE - offY - (lat - minLat) * scale).toFixed(1)}`;
  return rings.map((ring) => `M${ring.map(at).join('L')}Z`).join('');
}

/** Miniatura obrysu pola (dekoracyjna; informacja o polu jest w tekście karty). */
@Component({
  selector: 'app-field-thumb',
  host: {class: 'block'},
  template: `
    @if (path(); as d) {
      <svg viewBox="0 0 56 56" class="h-9 w-9" aria-hidden="true" focusable="false">
        <path [attr.d]="d" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
      </svg>
    }
  `,
})
export class FieldThumb {
  readonly parcels = input.required<FieldParcel[]>();
  protected readonly path = computed(() => thumbPath(this.parcels()));
}
