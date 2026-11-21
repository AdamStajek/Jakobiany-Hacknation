import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MultiSelectModule } from 'primeng/multiselect';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { FarmerAnswers, FarmerQuestion, Parcel, ProblemZone, RecommendationCatalog } from '../../core/api/types';
import { WodoMap } from '../map/wodo-map';

const CROP_FIELDS = ['current_crop', 'sowing_date', 'growth_stage'];

@Component({
  selector: 'app-field-declarations',
  imports: [ReactiveFormsModule, MultiSelectModule, WodoMap],
  templateUrl: './field-declarations.html',
  host: {class: 'block'},
})
export class FieldDeclarations {
  readonly questions = input.required<FarmerQuestion[]>();
  readonly parcel = input.required<Parcel | null>();
  readonly day = input.required<string>();
  readonly recommendationCatalog = input<RecommendationCatalog | null>(null);
  readonly active = input(false);
  protected readonly zonesTypes = ['Przesuszenie', 'Zastoiska', 'Erozja', 'Słaby plon', 'Inne'];
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly questionsWithControls = computed(() => this.questions()
    .filter(({field}) => !CROP_FIELDS.includes(field))
    .map(question => ({
      ...question,
      control: this.fb.control(''),
      options: question.format.replace(' (wielokrotny wybór)', '').split('; '),
    })));
  protected readonly observations = this.fb.control<string[]>([]);
  protected readonly sources = this.fb.control<string[]>([]);
  protected readonly history = this.fb.control('');
  protected readonly watering = this.fb.array<ReturnType<FieldDeclarations['wateringGroup']>>([]);
  protected readonly zones = this.fb.array<ReturnType<FieldDeclarations['zoneGroup']>>([]);
  protected readonly mapVisible = signal(false);
  protected readonly markers = signal<[number, number][]>([]);
  protected readonly error = signal('');

  constructor() {
    let previous: Parcel | null = null;
    effect(() => {
      const parcel = this.parcel();
      const same = parcel?.id === previous?.id && (parcel?.source !== 'Import użytkownika' || parcel?.geometry === previous?.geometry);
      previous = parcel;
      if (same) return;
      untracked(() => {
        for (const question of this.questionsWithControls()) question.control.reset();
        this.sources.reset();
        this.observations.reset();
        this.history.reset();
        this.watering.clear();
        this.zones.clear();
        this.markers.set([]);
        this.mapVisible.set(false);
        this.error.set('');
      });
    });
  }

  private wateringGroup() {
    return this.fb.group({date: '', dose_mm: new FormControl<number | null>(null)});
  }

  private zoneGroup(coordinates: [number, number]) {
    return this.fb.group({geometry: this.fb.control<ProblemZone['geometry']>({type: 'Point', coordinates}),
      type: '', date: '', description: '', recommendation_observations: this.fb.control<string[]>([])});
  }

  protected addWatering() { this.watering.push(this.wateringGroup()); }

  protected addZone({lon, lat}: {lon: number; lat: number}) {
    const geometry = this.parcel()?.geometry;
    if (!geometry || !booleanPointInPolygon([lon, lat], geometry as Parameters<typeof booleanPointInPolygon>[1])) {
      this.error.set('Zaznacz punkt wewnątrz granicy pola.');
      return;
    }
    if (this.zones.length >= 30) return;
    this.zones.push(this.zoneGroup([lon, lat]));
    this.updateMarkers();
    this.error.set('');
  }

  protected removeZone(index: number) {
    this.zones.removeAt(index);
    this.updateMarkers();
  }

  private updateMarkers() {
    this.markers.set(this.zones.getRawValue().map(zone => zone.geometry.coordinates));
  }

  collect(): FarmerAnswers | null {
    const answers: FarmerAnswers = {};
    const sources = this.sources.value;
    const zones = this.zones.getRawValue();
    const watering = this.watering.getRawValue();
    const day = this.day();
    this.error.set('');
    if (sources.length > 1 && sources.some(source => source.toLowerCase() === 'brak dostępu')) {
      this.error.set('Wybierz brak dostępu albo wskaż dostępne źródła wody.');
    } else if (zones.some(zone => !zone.type || !zone.date || zone.date > day)) {
      this.error.set('Uzupełnij typ i datę każdej strefy. Podaj datę najpóźniej z dnia analizy.');
    } else if (this.history.value === 'events' && (!watering.length || watering.some(event =>
      !event.date || event.date > day || (event.dose_mm !== null && event.dose_mm < 0)))) {
      this.error.set('Dodaj zdarzenie nawadniania z datą najpóźniej z dnia analizy. Dawka jest opcjonalna.');
    }
    if (this.error()) return null;
    for (const question of this.questionsWithControls()) {
      const value = question.control.value.trim();
      if (value) answers[question.field] = value;
    }
    if (sources.length) answers['irrigation_water_source'] = sources;
    if (this.observations.value.length) answers['recommendation_observations'] = this.observations.value;
    if (zones.length) answers['problem_zones'] = zones;
    if (this.history.value) {
      answers['irrigation_events'] = this.history.value === 'events' ? watering : this.history.value === 'none' ? [] : null;
    }
    return answers;
  }
}
