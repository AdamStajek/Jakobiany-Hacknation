import { DatePipe, DecimalPipe, JsonPipe, KeyValuePipe, NgTemplateOutlet } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, HostListener, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { MultiPolygon, Polygon } from 'geojson';
import * as L from 'leaflet';
import { firstValueFrom } from 'rxjs';

import { ModelPage } from './model-page';

type PassportField = {
  field: string; label: string; source: string; unit?: string | null;
  status: string; value: unknown; detail?: string | null; provenance?: {source_id?: string};
};
type FarmerReport = {situation: string; next_check: string | null;
  steps: {when: string; action: string; why: string; condition?: string}[]};
type Passport = {farmer_report?: FarmerReport; parcel_id: string; analysis_as_of: string; fields: PassportField[]};

type Parcel = {
  id: string;
  source: string;
  commune: string | null;
  region: string | null;
  area_ha: number;
  centroid: [number, number];
  geometry: Polygon | MultiPolygon;
};
type Question = {field: string; label: string; question: string; format: string;
  table: string; sql_type: string; source: string; unit: string | null};
type Zone = {geometry: {type: 'Point'; coordinates: [number, number]}; type: string; date: string; description: string};
type Watering = {date: string; dose_mm: number | null};
type Season = {year: number; balance_mm: number; rain_mm: number; et0_mm: number};
type Recent = {start: string; end: string; rain_mm: number; et0_mm: number; etc_mm: number;
  crop_balance_mm: number; dry_spell_days: number; mean_temp_c: number | null; rain_anomaly_mm?: number; balance_anomaly_mm?: number; samples: number; days: number};
type Scene = {date: string; ndvi: number; ndmi: number; ndwi: number; clear_share: number; pixels: number; crop_stage?: string};
type Source = {
  key: string; name: string; url: string; kind: string; resolution: string; coverage?: string[];
  retrieved_at: string; publication_date: string | null; cached: boolean; attribution?: string;
  scene?: Scene; history?: Scene[]; classes?: {class: string; percent: number}[];
  layers?: ([number, number] | null)[]; layer_depths?: string[];
  elevation_m?: number; slope_pct?: number | null; relief_m?: number | null;
  nearest_water_m?: number | null; nearest_water_point?: [number, number] | null; search_m?: number;
  station?: string; river?: string; distance_km?: number; gauge_cm?: number;
  observations?: {label: string; value: number; date: string}[];
};
type Recommendation = {group: string; title: string; action: string; why: string;
  evidence: string; when: string; confidence: string; limits: string};
type Report = {
  parcel: Parcel; date: string; analysis_id: string; elapsed_ms: number;
  confidence: string; agricultural: boolean; situation?: string;
  daily: {rain_mm: number | null; et0_mm: number | null; temp_c: number | null};
  sources: Source[]; missing: Record<string, string>; recommendations: Recommendation[];
  scenario: {input_mm: number; depletion_reduction_mm: [number, number]; note: string} | null;
  metrics: {
    risk: string; kc: number; stage: string; crop: {label: string; root_m: number};
    weather_last_day: string | null; recent: Recent | null;
    root: {taw_mm: number; raw_mm: number; days: number;
      initially_wet: {depletion_mm: number}; initially_dry: {depletion_mm: number}} | null;
    history: {seasons: Season[]; negative_seasons: number; riskiest_months: string[];
      matched_years: number; matched_balance_mm: number | null; matched_rain_mm: number | null; median_season_mm: number | null};
    satellite_comparison?: {ndvi_delta: number; ndmi_delta: number; n: number; interpretation: string};
  };
};

@Component({
  selector: 'app-root',
  imports: [FormsModule, DatePipe, DecimalPipe, JsonPipe, KeyValuePipe, NgTemplateOutlet, ModelPage],
  templateUrl: './app.html',
})
export class App implements AfterViewInit {
  @ViewChild('map') private mapElement!: ElementRef<HTMLDivElement>;
  private readonly http = inject(HttpClient);
  private map?: L.Map;
  private feature?: L.GeoJSON;
  private water?: L.CircleMarker;
  private originalGeometry?: object;
  private timer?: ReturnType<typeof setInterval>;

  private readonly activeHash = signal(window.location.hash);
  protected readonly passportsTab = computed(() => this.activeHash() === '#paszporty');
  protected readonly modelTab = computed(() => this.activeHash() === '#metody');

  @HostListener('window:hashchange')
  protected updateTab() {
    const wasModelTab = this.modelTab();
    this.activeHash.set(window.location.hash);
    if (this.modelTab()) {
      requestAnimationFrame(() => document.getElementById('model-title')?.focus());
    } else if (wasModelTab) {
      requestAnimationFrame(() => this.map?.invalidateSize());
    }
    this.markingZone = false;
  }

  protected readonly parcel = signal<Parcel | null>(null);
  protected readonly choices = signal<Parcel[]>([]);
  protected readonly crops = signal<{id: string; label: string}[]>([]);
  protected readonly loadingParcel = signal(false);
  protected readonly loadingPassport = signal(false);
  protected readonly passport = signal<Passport | null>(null);
  protected readonly availablePassportFields = computed(() =>
    this.passport()?.fields.filter(({field, status, value}) =>
      status === 'ok' && value != null && value !== '' &&
      (!Array.isArray(value) || value.length > 0 || field === 'irrigation_events')) ?? []);
  protected readonly passportOverview = computed(() => {
    const fields = this.availablePassportFields();
    return [
      {key: 'parcel_area_ha', label: 'Powierzchnia pola', unit: 'ha'},
      {key: 'climatic_water_balance_30d_mm', label: 'Bilans wody z pogody w ostatnich 30 dniach', unit: 'mm',
        hint: 'Wynik poniżej zera oznacza, że opady nie pokryły ilości wody, która mogła wyparować.'},
      {key: 'nearest_waterbody_distance_m', label: 'Odległość do najbliższego zbiornika wodnego', unit: 'm'},
    ].map((item) => ({
      ...item, value: fields.find((field) => field.field === item.key && typeof field.value === 'number')?.value,
    })).filter((item) => item.value != null);
  });
  protected readonly farmerDeclarations = computed(() =>
    this.availablePassportFields().filter((field) => field.provenance && 'declared_at' in field.provenance));

  protected readonly progress = signal('');
  protected readonly error = signal('');
  protected readonly report = signal<Report | null>(null);
  protected readonly dateRange = signal({analysis_date_min: '', analysis_date_max: ''});
  protected readonly questions = signal<Question[]>([]);
  protected answers: Record<string, string> = {};
  protected waterSources: string[] = [];
  protected irrigationHistory = '';
  protected watering: Watering[] = [];
  protected zones: Zone[] = [];
  protected markingZone = false;
  private readonly zoneMarkers = L.layerGroup();
  protected query = '';
  protected crop = 'wheat';
  protected day = '';
  protected stage: number | null = null;
  protected sowing = '';
  protected irrigation = false;
  protected irrigationMm: number | null = null;
  protected scenario: number | null = null;
  protected confirmLand = false;
  protected soilObservation: string | null = null;
  protected readonly entries = Object.entries;
  protected readonly stages = ['Początek wzrostu', 'Rozwój', 'Pełnia wzrostu', 'Dojrzewanie', 'Poza sezonem'];

  constructor() {
    this.http.get<{analysis_date_min: string; analysis_date_max: string}>('/api/health').subscribe({
      next: (range) => { this.dateRange.set(range); this.day = range.analysis_date_max; },
      error: () => this.error.set('Serwer analizy jest niedostępny. Spróbuj odświeżyć stronę.'),
    });
    this.http.get<{id: string; label: string}[]>('/api/crops').subscribe({
      next: (list) => this.crops.set(list),
      error: () => this.error.set('Nie udało się wczytać listy upraw.'),
    });
  }

  ngAfterViewInit() {
    this.map = L.map(this.mapElement.nativeElement, {
      center: [52.05, 19.2], zoom: 6, minZoom: 5, maxZoom: 19, scrollWheelZoom: false, zoomControl: false,
      maxBounds: [[47, 10], [57, 28]],
    });
    L.control.zoom({position: 'topright', zoomInTitle: 'Powiększ', zoomOutTitle: 'Pomniejsz'}).addTo(this.map);
    L.control.scale({imperial: false}).addTo(this.map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · Granice © GUGiK',
    }).addTo(this.map);
    this.zoneMarkers.addTo(this.map);
    this.map.on('click', (event: L.LeafletMouseEvent) => {
      if (this.markingZone) return;
      const {lat, lng} = event.latlng;
      void this.find('/api/parcels/by-point', {lat, lon: lng});
    });
  }

  protected async find(path = '/api/parcels/search', params?: {lat: number; lon: number}) {
    if (this.loadingParcel() || this.progress()) return;
    this.error.set('');
    this.choices.set([]);
    if (!params && !this.query.trim()) {
      this.error.set('Wpisz numer działki lub wybierz ją na mapie.');
      return;
    }
    this.loadingParcel.set(true);
    try {
      const result = await firstValueFrom(this.http.get<{parcels: Parcel[]}>(path, {
        params: params ?? {query: this.query.trim()},
      }));
      if (result.parcels.length === 1) this.select(result.parcels[0]);
      else this.choices.set(result.parcels);
    } catch (error) {
      this.showError(error);
    } finally {
      this.loadingParcel.set(false);
    }
  }

  protected select(parcel: Parcel, geojson?: object) {
    if (geojson || this.parcel()?.id !== parcel.id) {
      this.answers = {};
      this.waterSources = [];
      this.irrigationHistory = '';
      this.watering = [];
      this.zones = [];
      this.zoneMarkers.clearLayers();
    }
    this.markingZone = false;
    this.originalGeometry = geojson;
    this.passport.set(null);
    this.parcel.set(parcel);
    this.choices.set([]);
    this.report.set(null);
    this.query = geojson ? '' : parcel.id;
    this.confirmLand = false;
    if (!this.map) return;
    this.feature?.remove();
    this.water?.remove();
    this.feature = L.geoJSON(parcel.geometry, {
      style: {color: '#006a50', weight: 3, fillColor: '#70b995', fillOpacity: .55},
    }).addTo(this.map);
    this.feature.on('click', (event: L.LeafletMouseEvent) => {
      if (!this.markingZone) return;
      L.DomEvent.stopPropagation(event);
      const {lng, lat} = event.latlng;
      this.zones.push({geometry: {type: 'Point', coordinates: [lng, lat]}, type: '', date: '', description: ''});
      this.markingZone = false;
      this.refreshZoneMarkers();
    });
    this.map.fitBounds(this.feature.getBounds(), {padding: [48, 48], maxZoom: 17});
    if (!this.questions().length) {
      this.http.get<Question[]>('/api/passport/questions').subscribe({
        next: (questions) => this.questions.set(questions),
        error: () => this.error.set('Nie udało się wczytać pytań do paszportu. Wybierz działkę ponownie.'),
      });
    }
  }

  protected refreshZoneMarkers() {
    this.zoneMarkers.clearLayers();
    for (const {geometry: {coordinates: [lng, lat]}} of this.zones) {
      L.circleMarker([lat, lng], {radius: 6, color: '#944518', interactive: false}).addTo(this.zoneMarkers);
    }
  }

  protected resetMap() {
    if (this.feature) this.map?.fitBounds(this.feature.getBounds(), {padding: [48, 48], maxZoom: 17});
    else this.map?.setView([52.05, 19.2], 6);
  }

  protected async importFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.loadingParcel() || this.progress()) return;
    this.error.set('');
    if (file.size > 600_000) { this.error.set('Plik GeoJSON musi mieć mniej niż 600 kB.'); return; }
    this.loadingParcel.set(true);
    try {
      const geojson: object = JSON.parse(await file.text());
      const parcel = await firstValueFrom(this.http.post<Parcel>('/api/parcels/import', geojson));
      this.select(parcel, geojson);
    } catch (error) {
      this.showError(error, 'Nie udało się odczytać prawidłowego pliku GeoJSON.');
    } finally {
      this.loadingParcel.set(false);
    }
  }

  protected async openPassport() {
    const parcel = this.parcel();
    if (!parcel || !this.day || this.loadingPassport()) return;
    this.error.set('');
    if (this.waterSources.length > 1 && this.waterSources.some((source) => source.toLowerCase() === "brak dostępu")) {
      this.error.set("Wybierz brak dostępu albo wskaż dostępne źródła wody.");
      return;
    }
    if (this.zones.some((zone) => !zone.type || !zone.date) ||
        (this.irrigationHistory === 'events' && (!this.watering.length || this.watering.some(
          (event) => !event.date || event.date > this.day || (event.dose_mm !== null && event.dose_mm < 0))))) {
      this.error.set('Uzupełnij typ i datę każdej strefy oraz datę i ewentualną dawkę każdego nawadniania.');
      return;
    }
    const answers: Record<string, unknown> = {
      ...Object.fromEntries(Object.entries(this.answers).map(([key, value]) => [key, value.trim()])),
      problem_zones: this.zones.length ? this.zones : undefined,
      irrigation_water_source: this.waterSources.length ? this.waterSources : undefined,
      irrigation_events: this.irrigationHistory === 'events' ? this.watering :
        this.irrigationHistory === 'none' ? [] : this.irrigationHistory === 'unknown' ? null : undefined,
    };
    const farmerFields = this.questions().flatMap(({question, format, ...field}) => {
      const value = answers[field.field];
      return value === undefined || value === '' ? [] : [{
        ...field, value, status: value === null ? 'missing' : 'ok',
        provenance: {source_id: field.source, declared_at: new Date().toISOString()},
      }];
    });
    this.loadingPassport.set(true);
    try {
      const params = {as_of: this.day, crop: this.crop,
        ...(this.sowing ? {sowing: this.sowing} : {}), ...(this.stage !== null ? {stage: this.stage} : {}),
        irrigation_mm: this.irrigation ? this.irrigationMm ?? 0 : 0};
      const data = await firstValueFrom(this.originalGeometry
        ? this.http.post<Passport>('/api/passport', this.originalGeometry, {params})
        : this.http.get<Passport>('/api/passport', {params: {...params, parcel_id: parcel.id}}));
      if (this.parcel() !== parcel) return;
      this.passport.set({...data, fields: [...farmerFields, ...data.fields.filter(
        (field) => !farmerFields.some((answer) => answer.field === field.field))]});
      requestAnimationFrame(() => document.getElementById('passport-summary')?.focus());
    } catch (error) {
      this.showError(error);
    } finally {
      this.loadingPassport.set(false);
    }
  }

  protected structuredPassportValue(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') return null;
    if (Array.isArray(value)) return Object.fromEntries(value.map((item, index) => [String(index + 1), item]));
    return value as Record<string, unknown>;
  }

  protected passportValue(value: unknown): string {
    if (typeof value === 'number') return value.toLocaleString('pl-PL', {maximumFractionDigits: 6});
    if (typeof value === 'boolean') return value ? 'Tak' : 'Nie';
    return value == null || value === '' ? 'Brak danych' : String(value);
  }

  protected declarationLines(field: PassportField): string[] {
    const value = field.value;
    if (field.field === 'irrigation_events') {
      if (!Array.isArray(value)) return ['Nie wiem'];
      if (!value.length) return ['Pole nie było nawadniane'];
      return (value as Watering[]).map(({date, dose_mm}) =>
        `${this.polishDate(date)} · ${dose_mm === null ? 'Dawka nieznana' : this.passportValue(dose_mm) + ' mm'}`);
    }
    if (field.field === 'problem_zones') {
      return (value as Zone[]).map(({type, date, description}) =>
        [type, this.polishDate(date), description].filter(Boolean).join(' · '));
    }
    return [Array.isArray(value) ? value.join(', ') : this.passportValue(value)];
  }

  private polishDate(date: string): string {
    return date.split('-').reverse().join('.');
  }

  protected downloadPassport() {
    const data = this.passport();
    if (data) this.downloadJson(data, 'paszport-pola.json', 'application/json');
  }

  protected downloadParcelGeoJson(parcel: Parcel) {
    const feature = {
      type: 'Feature',
      geometry: parcel.geometry,
      properties: {parcel_id: parcel.id, commune: parcel.commune, area_ha: parcel.area_ha, source: parcel.source},
    };
    const filename = parcel.id.replace(/[^a-zA-Z0-9_.-]/g, '-');
    this.downloadJson(feature, `dzialka-${filename}.geojson`, 'application/geo+json');
  }

  private downloadJson(data: object, filename: string, type: string) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type}));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  protected async analyze() {
    const parcel = this.parcel();
    if (!parcel || !this.day || this.progress() || this.loadingParcel()) return;
    this.error.set('');
    this.report.set(null);
    this.water?.remove();
    const steps = ['Pobieramy pogodę i historię opadów…', 'Sprawdzamy zdjęcia, glebę i otoczenie…',
                   'Łączymy dane i przygotowujemy zalecenia…'];
    let step = 0;
    this.progress.set(steps[step]);
    this.timer = setInterval(() => this.progress.set(steps[Math.min(++step, steps.length - 1)]), 4200);
    try {
      const result = await firstValueFrom(this.http.post<Report>('/api/analysis', {
        ...(this.originalGeometry ? {geojson: this.originalGeometry} : {parcel_id: parcel.id}),
        crop: this.crop, date: this.day, stage: this.stage, sowing: this.sowing || null,
        irrigation: this.irrigation, irrigation_mm: this.irrigation ? this.irrigationMm ?? 0 : 0,
        scenario_mm: this.scenario ?? 0, confirm_land: this.confirmLand, soil_observation: this.soilObservation,
      }));
      this.report.set(result);
      const water = this.source(result, 'land')?.nearest_water_point;
      if (water && this.map) {
        this.water = L.circleMarker([water[1], water[0]], {radius: 6, color: '#075985', fillOpacity: .8})
          .bindTooltip('Stała woda według ESA WorldCover 2021').addTo(this.map);
        if (this.feature) {
          const view = this.feature.getBounds();
          view.extend([water[1], water[0]]);
          this.map.fitBounds(view, {padding: [48, 48], maxZoom: 17});
        }
      }
      setTimeout(() => {
        const heading = document.getElementById('wynik');
        heading?.focus({preventScroll: true});
        heading?.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
      });
    } catch (error) {
      this.showError(error);
    } finally {
      clearInterval(this.timer);
      this.progress.set('');
    }
  }

  protected source(report: Report, key: string) { return report.sources.find((source) => source.key === key); }
  protected chartHeight(seasons: Season[], balance: number) {
    return 45 * Math.abs(balance) / Math.max(1, ...seasons.map((season) => Math.abs(season.balance_mm)));
  }
  protected print() { window.print(); }

  private showError(error: unknown, fallback = 'Nie udało się pobrać danych. Spróbuj ponownie.') {
    const detail = error instanceof HttpErrorResponse ? error.error?.detail : null;
    this.error.set(typeof detail === 'string' ? detail :
      Array.isArray(detail) ? String(detail[0]?.msg ?? fallback).replace(/^Value error, /, '') : fallback);
  }
}
