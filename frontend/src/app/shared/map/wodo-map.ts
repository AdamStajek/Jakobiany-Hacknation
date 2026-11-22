import { Component, computed, ElementRef, OnDestroy, afterNextRender, effect, input, output, signal, viewChild } from '@angular/core';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { TerraDraw } from 'terra-draw';
import { Geometry } from '../../core/api/types';
import { MapDrawBar } from './map-draw-bar';
import { MapEventHandlers, registerMapClicks, registerPinEvents } from './map-events';
import { FieldShape, fieldsFeatureCollection } from './map-fields';
import { startPolygonDraw } from './map-draw';
import { addMapLayers } from './map-layers';
import { requestUserLocation } from './map-locate';
import { Basemap, MAP_STYLE, POLAND_CENTER } from './map-style';
import { fitMapTo, FieldPin, syncMapData } from './map-sync';
import { MapTools } from './map-tools';
import { MapZoneBar } from './map-zone-bar';

/** Pinezka pola jest zdefiniowana w map-sync; re-eksport zachowuje dotychczasowy import z wodo-map. */
export type { FieldPin };

/** Mapa MapLibre: wybór działki kliknięciem, granica działki, punkt stałej wody. */
@Component({
  selector: 'app-wodo-map',
  imports: [MapTools, MapDrawBar, MapZoneBar],
  templateUrl: './wodo-map.html',
  host: {class: 'relative block h-full w-full'},
})
export class WodoMap implements OnDestroy {
  readonly geometry = input<Geometry | null>(null);
  /** [lon, lat] najbliższej stałej wody. */
  readonly waterPoint = input<[number, number] | null>(null);
  /** Dodatkowe punkty [lon, lat], np. oznaczone strefy problemowe. */
  readonly markers = input<[number, number][]>([]);
  /** Numeruje znaczniki 1, 2, 3… w kolejności listy. */
  readonly numberedMarkers = input(false);
  /** Tryb „Zaznacz miejsca problemowe”: klik w mapę zawsze emituje `pointClicked` (bez wyboru pól, pinezek i limitu zbliżenia). */
  readonly markMode = input(false);
  /** Czy pokazać przycisk trybu (np. gdy jest wybrana działka). */
  readonly markAvailable = input(false);
  /** Komunikat w pasku trybu (np. punkt poza działką); niepusty podświetla obrys działki. */
  readonly markNotice = input('');
  readonly markToggle = output();
  readonly markUndo = output();
  readonly markClear = output();
  readonly markDone = output();
  /** Wyciszona warstwa pól (cienki obrys + nazwa), by nie mylić jej z działką wybraną do analizy. */
  readonly fieldsMuted = input(false);
  /** Przycisk „Pokaż moje pola” (rodzic decyduje, czy jest widoczny i czy włączony). */
  readonly fieldsToggleVisible = input(false);
  readonly fieldsShown = input(false);
  readonly fieldsToggle = output();
  /** Przy starcie, bez wskazanej działki, wyśrodkuj mapę na lokalizacji użytkownika. */
  readonly locateUser = input(false);
  /** Pinezki pól: przy oddaleniu sąsiednie łączą się w grupy z licznikiem. */
  readonly pins = input<FieldPin[]>([]);
  readonly pinClicked = output<string>();
  /** Pola z własnym kolorem i nazwą: rysowane osobno (wypełnienie, obrys, etykieta od zbliżenia ~12). */
  readonly fields = input<FieldShape[]>([]);
  /** Wybrane pole: grubszy obrys, pozostałe przygaszone. */
  readonly selectedFieldId = input<string | null>(null);
  /** Kliknięcie w granicę pola. */
  readonly fieldClicked = output<string>();
  /** Granica, do której mapa ma się dopasować (bez rysowania jej jako wybranej działki). */
  readonly fitGeometry = input<Geometry | null>(null);
  readonly hintText = input('Dotknij działki na mapie, żeby ją wybrać. Przybliż mapę, jeśli nic się nie dzieje.');
  readonly drawEnabled = input(true);
  readonly mapLabel = input('Interaktywna mapa. Kliknij, aby wskazać działkę. Działkę możesz też wyszukać po identyfikatorze.');
  readonly pointClicked = output<{lat: number; lon: number}>();
  /** Granica narysowana przez użytkownika (WGS 84). */
  readonly polygonDrawn = output<Geometry>();
  /** Czy wskazówka pierwszej wizyty była już zamknięta (zapamiętuje rodzic, np. za zgodą w ConsentStore). */
  readonly hintSeen = input(false);
  readonly hintDismissed = output();

  protected readonly basemap = signal<Basemap>('osm');
  protected readonly ready = signal(false);
  protected readonly drawing = signal(false);
  protected readonly locateError = signal('');
  protected readonly parcelLayer = signal(true);
  protected readonly zoomHint = signal(false);
  protected readonly drawPoints = signal(0);
  private readonly hintClosed = signal(false);
  protected readonly hintVisible = computed(() => !this.hintSeen() && !this.hintClosed());
  private zoomHintTimer?: ReturnType<typeof setTimeout>;
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  private map?: MapLibreMap;
  private draw_?: TerraDraw;
  private ignoreClicksUntil = 0;
  private fitted: {geometry: Geometry | null; water: [number, number] | null} = {geometry: null, water: null};

  private readonly handlers: MapEventHandlers = {
    clicksBlocked: () => this.drawing() || Date.now() <= this.ignoreClicksUntil,
    drawing: this.drawing,
    markMode: this.markMode,
    onPoint: (point) => this.pointClicked.emit(point),
    onField: (id) => this.fieldClicked.emit(id),
    onPin: (id) => this.pinClicked.emit(id),
    onZoomHint: () => this.showZoomHint(),
    onZoomHintClear: () => this.zoomHint.set(false),
  };

  constructor() {
    afterNextRender(() => void this.init());
    effect(() => { this.geometry(); this.waterPoint(); this.markers(); this.numberedMarkers(); this.pins(); this.ready(); this.draw(); });
    effect(() => { if (this.markMode() && this.drawing()) this.stopDraw(); });
    effect(() => {
      const alert = !!this.markNotice();
      if (this.ready()) this.map?.setPaintProperty('parcel-line', 'line-color', alert ? '#dc2626' : '#EE8106');
    });
    effect(() => { this.fields(); this.selectedFieldId(); this.fieldsMuted(); this.ready(); this.drawFields(); });
    effect(() => { const geometry = this.fitGeometry(); if (this.ready() && geometry) this.fitTo(geometry, null); });
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

  protected closeHint() { this.hintClosed.set(true); this.hintDismissed.emit(); }

  protected zoomBy(direction: number) { if (direction > 0) this.map?.zoomIn(); else this.map?.zoomOut(); }

  protected undoPoint() { this.draw_?.undo(); }

  /** Terra Draw nie ma publicznego `finish()`; wysyłamy klawisz kończący (Enter) na płótno mapy, jak z klawiatury. */
  protected finishDraw() {
    this.map?.getCanvas().dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter'}));
  }

  protected async toggleDraw() {
    if (this.drawing()) { this.stopDraw(); return; }
    const map = this.map;
    if (!map) return;
    this.drawPoints.set(0);
    this.drawing.set(true);
    const draw = await startPolygonDraw(map, (count) => this.drawPoints.set(count), (geometry) => {
      this.stopDraw();
      if (geometry) this.polygonDrawn.emit(geometry);
    });
    if (!this.drawing()) { draw.stop(); return; } // anulowano w trakcie ładowania
    this.draw_ = draw;
  }

  protected stopDraw() {
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
    map.addControl(new maplibregl.ScaleControl({unit: 'metric'}), 'bottom-left');
    map.getCanvas().style.cursor = 'crosshair';
    registerMapClicks(map, this.handlers);
    map.on('load', () => {
      addMapLayers(map);
      registerPinEvents(map, this.handlers);
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
    // Przy starcie użytkownik mógł już wybrać działkę: wtedy nie przesuwamy mapy.
    requestUserLocation(map, explicit, () => explicit || !this.geometry(), (message) => this.locateError.set(message));
  }

  private drawFields() {
    const map = this.map;
    if (!map || !this.ready()) return;
    (map.getSource('fields') as GeoJSONSource).setData(fieldsFeatureCollection(this.fields(), this.selectedFieldId(), this.fieldsMuted()));
  }

  private draw() {
    const map = this.map;
    if (!map || !this.ready()) return;
    const geometry = this.geometry();
    const water = this.waterPoint();
    syncMapData(map, {geometry, water, markers: this.markers(), numberedMarkers: this.numberedMarkers(), pins: this.pins()});
    // Dopasowanie tylko przy zmianie działki lub wody (nie przy każdym dodanym znaczniku).
    if (geometry && (geometry !== this.fitted.geometry || water !== this.fitted.water)) this.fitTo(geometry, water);
    this.fitted = {geometry, water};
  }

  private fitTo(geometry: Geometry, water: [number, number] | null) {
    if (this.map) fitMapTo(this.map, geometry, water);
  }

  ngOnDestroy() { clearTimeout(this.zoomHintTimer); this.draw_?.stop(); this.map?.remove(); }
}
