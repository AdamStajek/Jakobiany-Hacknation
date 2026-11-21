import { DatePipe, DecimalPipe, JsonPipe, KeyValuePipe, NgTemplateOutlet } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { firstValueFrom } from 'rxjs';
import type { Parcel } from '../../core/api/types';
import { ParcelStore } from '../../core/state/parcel.store';
import { WodoMap } from '../../shared/map/wodo-map';

type PassportField = {
  field: string; label: string; source: string; unit?: string | null;
  status: string; value: unknown; detail?: string | null; provenance?: {source_id?: string};
};
type FarmerReport = {situation: string; next_check: string | null;
  steps: {when: string; action: string; why: string; condition?: string}[]};
type Passport = {farmer_report?: FarmerReport; parcel_id: string; analysis_as_of: string; fields: PassportField[]};

type Question = {field: string; label: string; question: string; format: string;
  table: string; sql_type: string; source: string; unit: string | null};
type Zone = {geometry: {type: 'Point'; coordinates: [number, number]}; type: string; date: string; description: string};
type Watering = {date: string; dose_mm: number | null};
@Component({
  selector: 'app-passport-page',
  imports: [FormsModule, WodoMap, DatePipe, DecimalPipe, JsonPipe, KeyValuePipe, NgTemplateOutlet],
  templateUrl: './passport-page.html',
  styleUrl: './passport-page.css',
})
export class PassportPage implements OnInit {
  private readonly wodoMap = viewChild.required(WodoMap);
  private readonly selectedParcel = inject(ParcelStore);
  private readonly http = inject(HttpClient);
  private originalGeometry?: object;
  readonly id = input<string>();

  protected readonly parcel = signal<Parcel | null>(null);
  protected readonly choices = signal<Parcel[]>([]);
  protected readonly crops = signal<{id: string; label: string}[]>([]);
  protected readonly loadingParcel = signal(false);
  protected readonly loadingPassport = signal(false);
  protected readonly zoneMarkers = signal<[number, number][]>([]);
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

  protected readonly error = signal('');
  protected readonly dateRange = signal({analysis_date_min: '', analysis_date_max: ''});
  protected readonly questions = signal<Question[]>([]);
  protected answers: Record<string, string> = {};
  protected waterSources: string[] = [];
  protected irrigationHistory = '';
  protected watering: Watering[] = [];
  protected zones: Zone[] = [];
  protected markingZone = false;
  protected query = '';
  protected crop = 'wheat';
  protected day = '';
  protected stage: number | null = null;
  protected sowing = '';
  protected irrigation = false;
  protected irrigationMm: number | null = null;
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

  ngOnInit() {
    const id = this.id();
    if (!id) return;
    const selected = this.selectedParcel.parcel();
    if (selected && selected.id === id) {
      this.select(selected, this.selectedParcel.importedGeometry() ?? undefined);
    } else {
      this.query = id;
      void this.find();
    }
  }

  protected onMapClick({lat, lon}: {lat: number; lon: number}) {
    if (!this.markingZone) {
      void this.find('/api/parcels/by-point', {lat, lon});
      return;
    }
    const geometry = this.parcel()?.geometry;
    if (!geometry || !booleanPointInPolygon([lon, lat], {type: 'Feature', properties: {}, geometry} as never)) return;
    this.zones.push({geometry: {type: 'Point', coordinates: [lon, lat]}, type: '', date: '', description: ''});
    this.markingZone = false;
    this.refreshZoneMarkers();
  }

  protected async onPolygonDrawn(geometry: object) {
    if (this.loadingParcel()) return;
    this.error.set('');
    this.loadingParcel.set(true);
    try {
      const geojson = {type: 'Feature', properties: {}, geometry};
      this.select(await firstValueFrom(this.http.post<Parcel>('/api/parcels/import', geojson)), geojson);
    } catch (error) {
      this.showError(error, 'Nie udało się użyć narysowanej granicy.');
    } finally {
      this.loadingParcel.set(false);
    }
  }

  protected async find(path = '/api/parcels/search', params?: {lat: number; lon: number}) {
    if (this.loadingParcel()) return;
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
      this.refreshZoneMarkers();
    }
    this.markingZone = false;
    this.originalGeometry = geojson;
    this.passport.set(null);
    this.parcel.set(parcel);
    this.choices.set([]);
    this.query = geojson ? '' : parcel.id;
    if (!this.questions().length) {
      this.http.get<Question[]>('/api/passport/questions').subscribe({
        next: (questions) => this.questions.set(questions),
        error: () => this.error.set('Nie udało się wczytać pytań do paszportu. Wybierz działkę ponownie.'),
      });
    }
  }

  protected refreshZoneMarkers() {
    this.zoneMarkers.set(this.zones.map(({geometry}) => geometry.coordinates));
  }

  protected resetMap() {
    this.wodoMap().fit();
  }

  protected async importFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.loadingParcel()) return;
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
    const farmerFields = this.questions().flatMap((item) => {
      const {field: name, label, table, sql_type, source, unit} = item;
      const field = {field: name, label, table, sql_type, source, unit};
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

  protected print() { window.print(); }

  private showError(error: unknown, fallback = 'Nie udało się pobrać danych. Spróbuj ponownie.') {
    const detail = error instanceof HttpErrorResponse ? error.error?.detail : null;
    this.error.set(typeof detail === 'string' ? detail :
      Array.isArray(detail) ? String(detail[0]?.msg ?? fallback).replace(/^Value error, /, '') : fallback);
  }
}
