import { DecimalPipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { MultiPolygon, Polygon } from 'geojson';
import * as L from 'leaflet';
import { firstValueFrom } from 'rxjs';

type Parcel = {
  id: string;
  source: string;
  commune: string | null;
  region: string | null;
  area_ha: number;
  centroid: [number, number];
  geometry: Polygon | MultiPolygon;
};
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
  confidence: string; agricultural: boolean;
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
  imports: [FormsModule, DecimalPipe],
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

  protected readonly parcel = signal<Parcel | null>(null);
  protected readonly choices = signal<Parcel[]>([]);
  protected readonly crops = signal<{id: string; label: string}[]>([]);
  protected readonly loadingParcel = signal(false);
  protected readonly progress = signal('');
  protected readonly error = signal('');
  protected readonly report = signal<Report | null>(null);
  protected readonly dateRange = signal({analysis_date_min: '', analysis_date_max: ''});
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
    this.map.on('click', (event: L.LeafletMouseEvent) => {
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
    this.originalGeometry = geojson;
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
    this.map.fitBounds(this.feature.getBounds(), {padding: [48, 48], maxZoom: 17});
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
