import { Component, ElementRef, OnDestroy, afterNextRender, effect, input, output, signal, viewChild } from '@angular/core';
import bbox from '@turf/bbox';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { Geometry } from '../../core/api/types';
import { Basemap, MAP_STYLE, POLAND_CENTER } from './map-style';

const EMPTY = {type: 'FeatureCollection' as const, features: []};

/** Mapa MapLibre: wybór działki kliknięciem, granica działki, punkt stałej wody. */
@Component({
  selector: 'app-wodo-map',
  template: `
    <div #container class="h-full w-full" role="application"
      aria-label="Interaktywna mapa. Kliknij, aby wskazać działkę. Działkę możesz też wyszukać po identyfikatorze."></div>
    <div class="absolute left-3 top-3 z-10 flex overflow-hidden rounded-lg border border-surface bg-surface-0 text-sm shadow dark:bg-surface-900" role="group" aria-label="Podkład mapy">
      @for (item of basemaps; track item.id) {
        <button type="button" (click)="setBasemap(item.id)" [attr.aria-pressed]="basemap() === item.id"
          class="px-3 py-1.5 font-medium" [class]="basemap() === item.id ? 'bg-primary text-primary-contrast' : 'hover:bg-surface-100 dark:hover:bg-surface-800'">{{item.label}}</button>
      }
    </div>
    @if (!ready()) { <div class="absolute inset-0 grid place-items-center bg-surface-100 text-sm text-muted-color dark:bg-surface-800" role="status">Ładowanie mapy…</div> }
  `,
  host: {class: 'relative block h-full w-full'},
})
export class WodoMap implements OnDestroy {
  readonly geometry = input<Geometry | null>(null);
  /** [lon, lat] najbliższej stałej wody. */
  readonly waterPoint = input<[number, number] | null>(null);
  readonly pointClicked = output<{lat: number; lon: number}>();

  protected readonly basemaps: {id: Basemap; label: string}[] = [{id: 'osm', label: 'Mapa'}, {id: 'orto', label: 'Ortofoto'}];
  protected readonly basemap = signal<Basemap>('osm');
  protected readonly ready = signal(false);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  private map?: MapLibreMap;

  constructor() {
    afterNextRender(() => void this.init());
    effect(() => { this.geometry(); this.waterPoint(); this.ready(); this.draw(); });
  }

  protected setBasemap(id: Basemap) {
    this.basemap.set(id);
    this.map?.setLayoutProperty('osm', 'visibility', id === 'osm' ? 'visible' : 'none');
    this.map?.setLayoutProperty('orto', 'visibility', id === 'orto' ? 'visible' : 'none');
  }

  /** Wyśrodkowanie na działce lub na Polsce. */
  fit() {
    const geometry = this.geometry();
    if (!this.map) return;
    if (!geometry) { this.map.easeTo({center: POLAND_CENTER, zoom: 5.4}); return; }
    this.fitTo(geometry, this.waterPoint());
  }

  private async init() {
    const maplibregl = await import('maplibre-gl');
    // Worker serwowany jako zasób statyczny (bundler nie potrafi go wskazać samodzielnie).
    maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
    const map = new maplibregl.Map({
      container: this.container().nativeElement, style: MAP_STYLE, center: POLAND_CENTER, zoom: 5.4, minZoom: 4, maxZoom: 19,
      maxBounds: [[9, 46], [29, 58]], attributionControl: {compact: true},
    });
    map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'top-right');
    map.addControl(new maplibregl.ScaleControl({unit: 'metric'}), 'bottom-left');
    map.getCanvas().style.cursor = 'crosshair';
    map.on('click', (event) => this.pointClicked.emit({lat: event.lngLat.lat, lon: event.lngLat.lng}));
    map.on('load', () => {
      map.addSource('parcel', {type: 'geojson', data: EMPTY});
      map.addSource('water', {type: 'geojson', data: EMPTY});
      map.addLayer({id: 'parcel-fill', type: 'fill', source: 'parcel', paint: {'fill-color': '#10b981', 'fill-opacity': 0.35}});
      map.addLayer({id: 'parcel-line', type: 'line', source: 'parcel', paint: {'line-color': '#047857', 'line-width': 3}});
      map.addLayer({id: 'water-point', type: 'circle', source: 'water',
        paint: {'circle-radius': 7, 'circle-color': '#0369a1', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}});
      this.map = map;
      this.ready.set(true);
    });
  }

  private draw() {
    const map = this.map;
    if (!map || !this.ready()) return;
    const geometry = this.geometry();
    const water = this.waterPoint();
    const parcelSource = map.getSource('parcel') as GeoJSONSource;
    const waterSource = map.getSource('water') as GeoJSONSource;
    parcelSource.setData((geometry ? {type: 'Feature', properties: {}, geometry} : EMPTY) as GeoJSON.GeoJSON);
    waterSource.setData(water ? {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: water}} : EMPTY);
    if (geometry) this.fitTo(geometry, water);
  }

  private fitTo(geometry: Geometry, water: [number, number] | null) {
    const [west, south, east, north] = bbox({type: 'Feature', properties: {}, geometry} as never);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(west, water?.[0] ?? west), Math.min(south, water?.[1] ?? south)],
      [Math.max(east, water?.[0] ?? east), Math.max(north, water?.[1] ?? north)],
    ];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.map?.fitBounds(bounds, {padding: 56, maxZoom: 17, duration: reduced ? 0 : 600});
  }

  ngOnDestroy() { this.map?.remove(); }
}
