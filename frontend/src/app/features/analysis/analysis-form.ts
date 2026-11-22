import { Component, computed, effect, signal, inject, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { AnalysisStore } from '../../core/state/analysis.store';
import { RecommendationCatalogStore } from '../../core/state/recommendation-catalog.store';
import { ParcelStore } from '../../core/state/parcel.store';
import { FieldDescriptionStore } from '../../core/state/field-description.store';
import { descriptionRows, mergeAnswers } from '../../core/state/field-description';
import { ConfirmedDescription } from '../../core/api/types';
import { FieldDescriptionInput } from './field-description';
import { FieldDeclarations } from '../../shared/ui/field-declarations';

const STAGES = ['Początek wzrostu', 'Rozwój', 'Pełnia wzrostu', 'Dojrzewanie', 'Poza sezonem'];

@Component({
  selector: 'app-analysis-form',
  imports: [ReactiveFormsModule, AccordionModule, ButtonModule, CheckboxModule, MessageModule, SelectModule, FieldDeclarations, FieldDescriptionInput],
  templateUrl: './analysis-form.html',
})
export class AnalysisForm {
  protected readonly store = inject(AnalysisStore);
  protected readonly catalog = inject(RecommendationCatalogStore);
  protected readonly parcels = inject(ParcelStore);
  protected readonly description = inject(FieldDescriptionStore);
  protected readonly editingDescription = signal(false);
  protected readonly summaryRows = computed(() => {
    const confirmed = this.description.confirmed();
    return confirmed ? descriptionRows(confirmed, this.description.labels()) : [];
  });
  private readonly declarations = viewChild(FieldDeclarations);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly stages = [{label: 'Z kalendarza', value: null as number | null},
    ...STAGES.map((label, value) => ({label, value: value as number | null}))];
  protected readonly soilOptions = [
    {label: 'Nie sprawdzono', value: null as 'dry' | 'moist' | 'wet' | null},
    {label: 'Sucha', value: 'dry' as 'dry' | 'moist' | 'wet' | null},
    {label: 'Wilgotna', value: 'moist' as 'dry' | 'moist' | 'wet' | null},
    {label: 'Mokra lub miejscami stoi woda', value: 'wet' as 'dry' | 'moist' | 'wet' | null},
  ];
  protected readonly form = this.fb.group({
    crop: ['wheat', Validators.required], date: ['', Validators.required], stage: [null as number | null], sowing: [''],
    soil_observation: [null as 'dry' | 'moist' | 'wet' | null], irrigation: [false], irrigation_mm: [0],
    scenario_mm: [0], confirm_land: [false],
  });

  private readonly cropValue = toSignal(this.form.controls.crop.valueChanges, {initialValue: this.form.controls.crop.value});
  private readonly formValue = toSignal(this.form.valueChanges, {initialValue: this.form.getRawValue()});
  /** Liczba uzupełnionych opcjonalnych pól (opis własnymi słowami, faza, siew, gleba, nawadnianie, scenariusz). */
  protected readonly filledCount = computed(() => {
    const v = this.formValue();
    return [this.description.confirmed(), v.stage != null, v.sowing, v.soil_observation, v.irrigation, (v.scenario_mm ?? 0) > 0]
      .filter(Boolean).length;
  });

  protected cropUnknown() { return this.cropValue() === 'unknown'; }

  constructor() {
    void this.store.init();
    // Katalog jest potrzebny tylko do opcjonalnych sekcji, więc ładujemy go dopiero po wyborze działki.
    effect(() => { if (this.parcels.parcel()) untracked(() => void this.catalog.load()); });
    effect(() => {
      const max = this.store.range().max;
      if (max && !this.form.controls.date.value) this.form.controls.date.setValue(max);
    });
    // Formularz opisuje oglądany raport (także po otwarciu linku), a nie wartości domyślne.
    effect(() => {
      const values = this.store.reportForm();
      if (values) untracked(() => this.form.patchValue({...values, sowing: values.sowing ?? ''}));
    });
  }

  protected onDescribed(confirmed: ConfirmedDescription) {
    this.description.confirmed.set(confirmed);
    this.editingDescription.set(false);
  }

  protected submit() {
    if (this.form.invalid) return;
    const manual = this.declarations()?.collect() ?? {};
    const described = this.description.confirmed();
    const farmerAnswers = described ? mergeAnswers(manual, described.farmer_answers, described.observation_keys) : manual;
    const v = this.form.getRawValue();
    void this.store.analyze({
      crop: v.crop, date: v.date, stage: v.stage, sowing: v.sowing || null, irrigation: v.irrigation,
      irrigation_mm: v.irrigation ? v.irrigation_mm ?? 0 : 0, scenario_mm: v.scenario_mm ?? 0,
      confirm_land: v.confirm_land, soil_observation: v.soil_observation,
      farmer_answers: farmerAnswers,
    });
  }
}
