import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { AccordionModule } from 'primeng/accordion';
import { MultiSelectModule } from 'primeng/multiselect';
import { FarmerAnswers, FarmerQuestion, Parcel, RecommendationCatalog } from '../../core/api/types';
import { MAX_ZONES, ZONE_TYPES, ZoneDraft, ZonesStore } from '../../core/state/zones.store';
import { normalizeSources, normalizeWatering, normalizeZones } from './field-answers';

const CROP_FIELDS = ['current_crop', 'sowing_date', 'growth_stage'];

@Component({
  selector: 'app-field-declarations',
  imports: [ReactiveFormsModule, AccordionModule, MultiSelectModule],
  templateUrl: './field-declarations.html',
  host: {class: 'block'},
})
export class FieldDeclarations {
  readonly questions = input.required<FarmerQuestion[]>();
  readonly parcel = input.required<Parcel | null>();
  readonly day = input.required<string>();
  readonly recommendationCatalog = input<RecommendationCatalog | null>(null);
  /** Nieużywane: mapa stref jest teraz na głównej mapie (zostawione, by nie łamać istniejącego szablonu rodzica). */
  protected readonly zoneTypes = ZONE_TYPES;
  protected readonly maxZones = MAX_ZONES;
  protected readonly store = inject(ZonesStore);
  private readonly observationControls = new Map<number, FormControl<string[]>>();
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);

  protected readonly questionsWithControls = computed(() => this.questions()
    .filter(({field}) => !CROP_FIELDS.includes(field))
    .map(question => ({
      ...question,
      control: this.fb.control(''),
      options: question.format.replace(' (wielokrotny wybór)', '').split('; '),
    })));
  protected readonly zoneQuestion = computed(() => this.questionsWithControls().find(q => q.field === 'problem_zones'));
  protected readonly eventsQuestion = computed(() => this.questionsWithControls().find(q => q.field === 'irrigation_events'));
  protected readonly sourcesQuestion = computed(() => this.questionsWithControls().find(q => q.field === 'irrigation_water_source'));
  protected readonly otherQuestions = computed(() => this.questionsWithControls()
    .filter(q => !['problem_zones', 'irrigation_events', 'irrigation_water_source'].includes(q.field)));
  protected readonly observations = this.fb.control<string[]>([]);
  protected readonly sources = this.fb.control<string[]>([]);
  protected readonly history = this.fb.control('');
  protected readonly watering = this.fb.array<ReturnType<FieldDeclarations['wateringGroup']>>([]);
  /** Strefy z tego samego stanu co mapa; każda z kontrolką warunków (multiselect wymaga FormControl). */
  protected readonly zoneRows = computed(() => {
    const zones = this.store.zones();
    for (const id of this.observationControls.keys()) if (!zones.some((zone) => zone.id === id)) this.observationControls.delete(id);
    return zones.map((zone) => ({zone, observations: this.observationControl(zone)}));
  });
  protected readonly warnings = signal<string[]>([]);

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
        this.store.reset();
        this.warnings.set([]);
      });
    });
  }

  private wateringGroup() {
    return this.fb.group({date: '', dose_mm: new FormControl<number | null>(null)});
  }

  private observationControl(zone: ZoneDraft): FormControl<string[]> {
    let control = this.observationControls.get(zone.id);
    if (!control) {
      const created = this.fb.control<string[]>(zone.recommendation_observations);
      created.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => this.store.update(zone.id, {recommendation_observations: value}));
      this.observationControls.set(zone.id, created);
      control = created;
    }
    return control;
  }

  protected addWatering() { this.watering.push(this.wateringGroup()); }

  protected setZone(zone: ZoneDraft, patch: Partial<Pick<ZoneDraft, 'type' | 'date' | 'description'>>) { this.store.update(zone.id, patch); }

  protected inputValue(event: Event): string { return (event.target as HTMLInputElement).value; }

  /** Zbiera odpowiedzi; nigdy nie blokuje analizy. Braki są uzupełniane lub pomijane, a powód trafia do `warnings`. */
  collect(): FarmerAnswers {
    const answers: FarmerAnswers = {};
    const day = this.day();
    const warnings: string[] = [];
    const sources = normalizeSources(this.sources.value);
    const zones = normalizeZones(this.store.toProblemZones(), day);
    warnings.push(...sources.warnings, ...zones.warnings);
    for (const question of this.questionsWithControls()) {
      const value = question.control.value.trim();
      if (value) answers[question.field] = value;
    }
    if (sources.items.length) answers['irrigation_water_source'] = sources.items;
    if (this.observations.value.length) answers['recommendation_observations'] = this.observations.value;
    if (zones.items.length) answers['problem_zones'] = zones.items;
    if (this.history.value === 'events') {
      const events = normalizeWatering(this.watering.getRawValue(), day);
      warnings.push(...events.warnings);
      if (events.items.length) answers['irrigation_events'] = events.items;
      else warnings.push('Nie podano poprawnych zdarzeń nawadniania, więc pomijamy tę odpowiedź.');
    } else if (this.history.value) {
      answers['irrigation_events'] = this.history.value === 'none' ? [] : null;
    }
    this.warnings.set(warnings);
    return answers;
  }
}
