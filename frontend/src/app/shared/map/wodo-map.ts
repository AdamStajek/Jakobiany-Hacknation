import { Component, ElementRef, OnDestroy, afterNextRender, effect, input, output, signal, viewChild } from '@angular/core';
import bbox from '@turf/bbox';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { TerraDraw } from 'terra-draw';
import { Geometry } from '../../core/api/types';
import { Basemap, MAP_STYLE, POLAND_CENTER } from './map-style';

/** Poniżej tego przybliżenia klik w mapę nie wskazuje działki (zbyt duża niepewność punktu). */
const MIN_PICK_ZOOM = 12;
const EMPTY = {type: 'FeatureCollection' as const, features: []};

/** Pinezka pola widoczna po oddaleniu mapy (gdy granice działek są zbyt małe). */
export type FieldPin = {id: string; name: string; coordinates: [number, number]; color: string};

/** Powyżej tego przybliżenia pinezki znikają, bo widać już granice. */
const PIN_MAX_ZOOM = 14.5;

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
      <p class="absolute left-3 right-16 top-16 z-10 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 shadow lg:right-auto lg:max-w-sm dark:border-red-500 dark:bg-red-950 dark:text-red-100" role="alert">
        <i class="pi pi-exclamation-circle mt-0.5" aria-hidden="true"></i><span>{{locateError()}}</span>
      </p>
    }
    @if (zoomHint()) {
      <p class="absolute inset-x-3 bottom-20 z-10 mx-auto flex w-fit max-w-full items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 shadow-lg lg:bottom-12 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-100" role="status">
        <i class="pi pi-search-plus" aria-hidden="true"></i>Przybliż mapę, aby wybrać działkę
      </p>
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
  /** Pinezki pól: przy oddaleniu sąsiednie łączą się w grupy z licznikiem. */
  readonly pins = input<FieldPin[]>([]);
  readonly pinClicked = output<string>();
  readonly pointClicked = output<{lat: number; lon: number}>();
  /** Granica narysowana przez użytkownika (WGS 84). */
  readonly polygonDrawn = output<Geometry>();

  protected readonly basemap = signal<Basemap>('osm');
  protected readonly ready = signal(false);
  protected readonly drawing = signal(false);
  protected readonly locateError = signal('');
  protected readonly parcelLayer = signal(true);
  protected readonly zoomHint = signal(false);
  private zoomHintTimer?: ReturnType<typeof setTimeout>;
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  private map?: MapLibreMap;
  private draw_?: TerraDraw;
  private ignoreClicksUntil = 0;

  constructor() {
    afterNextRender(() => void this.init());
    effect(() => { this.geometry(); this.waterPoint(); this.markers(); this.pins(); this.ready(); this.draw(); });
  }

  private showZoomHint() {
    this.zoomHint.set(true);
    clearTimeout(this.zoomHintTimer);
    this.zoomHintTimer = setTimeout(() => this.zoomHint.set(false), 6000);
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
    map.on('click', (event) => {
      if (this.drawing() || Date.now() <= this.ignoreClicksUntil) return;
      if (map.getLayer('pin-points') && map.queryRenderedFeatures(event.point, {layers: ['pin-clusters', 'pin-points']}).length) return;
      if (map.getZoom() < MIN_PICK_ZOOM) { this.showZoomHint(); return; }
      this.zoomHint.set(false);
      this.pointClicked.emit({lat: event.lngLat.lat, lon: event.lngLat.lng});
    });
    map.on('zoomend', () => { if (map.getZoom() >= MIN_PICK_ZOOM) this.zoomHint.set(false); });
    map.on('load', () => {
      map.addSource('parcel', {type: 'geojson', data: EMPTY});
      map.addSource('water', {type: 'geojson', data: EMPTY});
      map.addSource('markers', {type: 'geojson', data: EMPTY});
      map.addSource('me', {type: 'geojson', data: EMPTY});
      map.addSource('pins', {type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 48, clusterMaxZoom: 13});
      map.addLayer({id: 'parcel-fill', type: 'fill', source: 'parcel', paint: {'fill-color': '#EE8106', 'fill-opacity': 0.16}});
      map.addLayer({id: 'parcel-line', type: 'line', source: 'parcel', paint: {'line-color': '#EE8106', 'line-width': 3}});
      map.addLayer({id: 'water-point', type: 'circle', source: 'water',
        paint: {'circle-radius': 7, 'circle-color': '#0369a1', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}});
      map.addLayer({id: 'marker-points', type: 'circle', source: 'markers',
        paint: {'circle-radius': 6, 'circle-color': '#944518', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}});
      map.addLayer({id: 'pin-clusters', type: 'circle', source: 'pins', filter: ['has', 'point_count'], maxzoom: PIN_MAX_ZOOM,
        paint: {'circle-color': '#944518', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3,
          'circle-radius': ['step', ['get', 'point_count'], 16, 5, 20, 15, 25]}});
      map.addLayer({id: 'pin-cluster-count', type: 'symbol', source: 'pins', filter: ['has', 'point_count'], maxzoom: PIN_MAX_ZOOM,
        layout: {'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Open Sans Regular'], 'text-size': 13, 'text-allow-overlap': true},
        paint: {'text-color': '#fff'}});
      map.addLayer({id: 'pin-points', type: 'circle', source: 'pins', filter: ['!', ['has', 'point_count']], maxzoom: PIN_MAX_ZOOM,
        paint: {'circle-color': ['get', 'color'], 'circle-radius': 9, 'circle-stroke-color': '#fff', 'circle-stroke-width': 3}});
      map.addLayer({id: 'pin-labels', type: 'symbol', source: 'pins', filter: ['!', ['has', 'point_count']], minzoom: 9, maxzoom: PIN_MAX_ZOOM,
        layout: {'text-field': ['get', 'name'], 'text-font': ['Open Sans Regular'], 'text-size': 12, 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-optional': true},
        paint: {'text-color': '#1f2937', 'text-halo-color': '#fff', 'text-halo-width': 1.5}});
      map.on('click', 'pin-clusters', (event) => {
        const feature = event.features?.[0];
        if (!feature || this.drawing()) return;
        const source = map.getSource('pins') as GeoJSONSource;
        void source.getClusterExpansionZoom(Number(feature.properties['cluster_id'])).then((zoom) =>
          map.easeTo({center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.5}));
      });
      map.on('click', 'pin-points', (event) => {
        const id = event.features?.[0]?.properties['id'];
        if (typeof id !== 'string' || this.drawing()) return;
        this.pinClicked.emit(id);
      });
      for (const layer of ['pin-clusters', 'pin-points']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = 'crosshair'; });
      }
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
    (map.getSource('pins') as GeoJSONSource).setData({type: 'FeatureCollection', features: this.pins().map((pin) =>
      ({type: 'Feature' as const, properties: {id: pin.id, name: pin.name, color: pin.color}, geometry: {type: 'Point' as const, coordinates: pin.coordinates}}))});
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

  ngOnDestroy() { clearTimeout(this.zoomHintTimer); this.draw_?.stop(); this.map?.remove(); }
}
