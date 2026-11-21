import { Component, ElementRef, OnDestroy, afterNextRender, effect, input, output, signal, viewChild } from '@angular/core';
import bbox from '@turf/bbox';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { TerraDraw } from 'terra-draw';
import { Geometry } from '../../core/api/types';
import { Basemap, MAP_STYLE, POLAND_CENTER } from './map-style';

const EMPTY = {type: 'FeatureCollection' as const, features: []};

/** Mapa MapLibre: wybór działki kliknięciem, granica działki, punkt stałej wody. */
@Component({
  selector: 'app-wodo-map',
  template: `
    <div #container class="h-full w-full" role="application"
      aria-label="Interaktywna mapa. Kliknij, aby wskazać działkę. Działkę możesz też wyszukać po identyfikatorze."></div>
    <div class="absolute right-3 top-3 z-10 flex flex-col gap-2" role="group" aria-label="Narzędzia mapy">
      <button type="button" (click)="setBasemap(basemap() === 'osm' ? 'orto' : 'osm')" [attr.aria-pressed]="basemap() === 'orto'"
        [attr.aria-label]="basemap() === 'orto' ? 'Przełącz na mapę' : 'Przełącz na ortofotomapę'" [title]="basemap() === 'orto' ? 'Mapa' : 'Ortofoto'"
        class="pw-card grid h-11 w-11 place-items-center shadow-md hover:bg-surface-100 dark:hover:bg-surface-800">
        <i class="pi pi-images" aria-hidden="true"></i>
      </button>
      <button type="button" (click)="toggleParcelLayer()" [attr.aria-pressed]="parcelLayer()" aria-label="Granice działek (od zbliżenia)" title="Granice działek"
        class="pw-card grid h-11 w-11 place-items-center shadow-md hover:bg-surface-100 dark:hover:bg-surface-800" [class.ring-2]="parcelLayer()" [class.ring-primary]="parcelLayer()">
        <i class="pi pi-table" aria-hidden="true"></i>
      </button>
      <button type="button" (click)="toggleDraw()" [attr.aria-pressed]="drawing()" [disabled]="!ready()"
        [attr.aria-label]="drawing() ? 'Anuluj rysowanie' : 'Narysuj granicę działki'" [title]="drawing() ? 'Anuluj rysowanie' : 'Narysuj granicę'"
        class="pw-card grid h-11 w-11 place-items-center shadow-md hover:bg-surface-100 disabled:opacity-50 dark:hover:bg-surface-800"
        [class.ring-2]="drawing()" [class.ring-primary]="drawing()">
        <i class="pi {{drawing() ? 'pi-times' : 'pi-pencil'}}" aria-hidden="true"></i>
      </button>
      <button type="button" (click)="locate()" [disabled]="!ready()" aria-label="Lokalizuj mnie na mapie" title="Moja lokalizacja"
        class="pw-card grid h-11 w-11 place-items-center shadow-md hover:bg-surface-100 disabled:opacity-50 dark:hover:bg-surface-800">
        <i class="pi pi-compass" aria-hidden="true"></i>
      </button>
    </div>
    @if (locateError()) {
      <p class="absolute left-3 right-16 top-16 z-10 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 shadow lg:right-auto lg:max-w-sm" role="alert">{{locateError()}}</p>
    }
    @if (drawing()) {
      <div class="absolute left-3 right-16 top-16 z-10 rounded-lg bg-primary px-3 py-2 text-sm text-primary-contrast shadow lg:right-auto lg:top-3 lg:max-w-sm" role="status">
        Klikaj kolejne rogi działki. Dwuklik lub kliknięcie ostatniego punktu kończy rysowanie.
      </div>
    }
    @if (!ready()) { <div class="absolute inset-0 grid place-items-center bg-surface-100 text-sm text-muted-color dark:bg-surface-800" role="status">Ładowanie mapy…</div> }
  `,
  host: {class: 'relative block h-full w-full'},
})
export class WodoMap implements OnDestroy {
  readonly geometry = input<Geometry | null>(null);
  /** [lon, lat] najbliższej stałej wody. */
  readonly waterPoint = input<[number, number] | null>(null);
  /** Dodatkowe punkty [lon, lat], np. oznaczone strefy problemowe. */
  readonly markers = input<[number, number][]>([]);
  /** Przy starcie, bez wskazanej działki, wyśrodkuj mapę na lokalizacji użytkownika. */
  readonly locateUser = input(false);
  readonly pointClicked = output<{lat: number; lon: number}>();
  /** Granica narysowana przez użytkownika (WGS 84). */
  readonly polygonDrawn = output<Geometry>();

  protected readonly basemap = signal<Basemap>('osm');
  protected readonly ready = signal(false);
  protected readonly drawing = signal(false);
  protected readonly locateError = signal('');
  protected readonly parcelLayer = signal(true);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  private map?: MapLibreMap;
  private draw_?: TerraDraw;
  private ignoreClicksUntil = 0;

  constructor() {
    afterNextRender(() => void this.init());
    effect(() => { this.geometry(); this.waterPoint(); this.markers(); this.ready(); this.draw(); });
  }

  protected setBasemap(id: Basemap) {
    this.basemap.set(id);
    this.map?.setLayoutProperty('osm', 'visibility', id === 'osm' ? 'visible' : 'none');
    this.map?.setLayoutProperty('orto', 'visibility', id === 'orto' ? 'visible' : 'none');
  }

  protected toggleParcelLayer() {
    const visible = !this.parcelLayer();
    this.parcelLayer.set(visible);
    this.map?.setLayoutProperty('ewidencja', 'visibility', visible ? 'visible' : 'none');
  }

  protected async toggleDraw() {
    if (this.drawing()) { this.stopDraw(); return; }
    const map = this.map;
    if (!map) return;
    this.drawing.set(true);
    const [{TerraDraw, TerraDrawPolygonMode}, {TerraDrawMapLibreGLAdapter}] = await Promise.all([
      import('terra-draw'), import('terra-draw-maplibre-gl-adapter')]);
    if (!this.drawing()) return; // anulowano w trakcie ładowania
    const draw = new TerraDraw({adapter: new TerraDrawMapLibreGLAdapter({map}), modes: [new TerraDrawPolygonMode()]});
    draw.start();
    draw.setMode('polygon');
    draw.on('finish', (id) => {
      const feature = draw.getSnapshot().find((f) => f.id === id);
      this.stopDraw();
      if (feature && (feature.geometry.type === 'Polygon')) this.polygonDrawn.emit(feature.geometry as Geometry);
    });
    this.draw_ = draw;
  }

  private stopDraw() {
    const draw = this.draw_;
    this.draw_ = undefined;
    this.ignoreClicksUntil = Date.now() + 500; // ostatnie kliknięcie rysowania nie jest wyborem działki
    this.drawing.set(false);
    if (!draw) return;
    // Zatrzymanie w kolejnej turze: nie niszczymy rysunku w trakcie obsługi jego własnego zdarzenia.
    setTimeout(() => { draw.clear(); draw.stop(); });
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
    // Przyciski zbliżania tylko dla myszy; na telefonie wystarcza szczypanie.
    if (matchMedia('(pointer: fine)').matches) map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({unit: 'metric'}), 'bottom-left');
    map.getCanvas().style.cursor = 'crosshair';
    map.on('click', (event) => !this.drawing() && Date.now() > this.ignoreClicksUntil && this.pointClicked.emit({lat: event.lngLat.lat, lon: event.lngLat.lng}));
    map.on('load', () => {
      map.addSource('parcel', {type: 'geojson', data: EMPTY});
      map.addSource('water', {type: 'geojson', data: EMPTY});
      map.addSource('markers', {type: 'geojson', data: EMPTY});
      map.addSource('me', {type: 'geojson', data: EMPTY});
      map.addLayer({id: 'parcel-fill', type: 'fill', source: 'parcel', paint: {'fill-color': '#EE8106', 'fill-opacity': 0.16}});
      map.addLayer({id: 'parcel-line', type: 'line', source: 'parcel', paint: {'line-color': '#EE8106', 'line-width': 3}});
      map.addLayer({id: 'water-point', type: 'circle', source: 'water',
        paint: {'circle-radius': 7, 'circle-color': '#0369a1', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}});
      map.addLayer({id: 'marker-points', type: 'circle', source: 'markers',
        paint: {'circle-radius': 6, 'circle-color': '#944518', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}});
      // Niebieska kropka „tu jesteś” jak w Google Maps: półprzezroczysta poświata + kropka z białą obwódką.
      map.addLayer({id: 'me-halo', type: 'circle', source: 'me', paint: {'circle-radius': 16, 'circle-color': '#4285f4', 'circle-opacity': 0.25}});
      map.addLayer({id: 'me-dot', type: 'circle', source: 'me',
        paint: {'circle-radius': 7, 'circle-color': '#4285f4', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3}});
      this.map = map;
      this.ready.set(true);
      this.centerOnUser(map);
    });
  }

  private centerOnUser(map: MapLibreMap) {
    if (this.locateUser() && !this.geometry()) this.requestLocation(map, false);
  }

  protected locate() { if (this.map) this.requestLocation(this.map, true); }

  private requestLocation(map: MapLibreMap, explicit: boolean) {
    this.locateError.set('');
    if (!navigator.geolocation) { if (explicit) this.locateError.set('Ta przeglądarka nie obsługuje geolokalizacji.'); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      (map.getSource('me') as GeoJSONSource).setData({type: 'Feature', properties: {},
        geometry: {type: 'Point', coordinates: [pos.coords.longitude, pos.coords.latitude]}});
      if (!explicit && this.geometry()) return; // użytkownik zdążył już wybrać działkę
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      map.easeTo({center: [pos.coords.longitude, pos.coords.latitude], zoom: 14, duration: reduced ? 0 : 800});
    }, (err) => {
      if (!explicit) return;
      this.locateError.set(err.code === err.PERMISSION_DENIED
        ? 'Lokalizacja jest zablokowana. Kliknij ikonę kłódki obok adresu i zezwól na lokalizację.'
        : 'Nie udało się ustalić lokalizacji (włącz usługi lokalizacji w systemie).');
    }, {timeout: 8000, maximumAge: 300000});
  }

  private draw() {
    const map = this.map;
    if (!map || !this.ready()) return;
    const geometry = this.geometry();
    const water = this.waterPoint();
    const parcelSource = map.getSource('parcel') as GeoJSONSource;
    const waterSource = map.getSource('water') as GeoJSONSource;
    const markerSource = map.getSource('markers') as GeoJSONSource;
    markerSource.setData({type: 'FeatureCollection', features: this.markers().map((coordinates) =>
      ({type: 'Feature' as const, properties: {}, geometry: {type: 'Point' as const, coordinates}}))});
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

  ngOnDestroy() { this.draw_?.stop(); this.map?.remove(); }
}
