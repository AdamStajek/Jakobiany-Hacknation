import { Component, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { AnalysisStore } from '../../core/state/analysis.store';
import { RecommendationCatalogStore } from '../../core/state/recommendation-catalog.store';
import { ParcelStore } from '../../core/state/parcel.store';
import { FieldDeclarations } from '../../shared/ui/field-declarations';

const STAGES = ['Początek wzrostu', 'Rozwój', 'Pełnia wzrostu', 'Dojrzewanie', 'Poza sezonem'];

@Component({
  selector: 'app-analysis-form',
  imports: [ReactiveFormsModule, ButtonModule, CheckboxModule, DialogModule, MessageModule, SelectModule, FieldDeclarations],
  templateUrl: './analysis-form.html',
})
export class AnalysisForm {
  protected readonly detailsOpen = signal(false);
  protected readonly store = inject(AnalysisStore);
  protected readonly catalog = inject(RecommendationCatalogStore);
  protected readonly parcels = inject(ParcelStore);
  private readonly declarations = viewChild.required(FieldDeclarations);
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
  protected cropUnknown() { return this.cropValue() === 'unknown'; }

  constructor() {
    void this.store.init();
    effect(() => { if (this.detailsOpen()) untracked(() => void this.catalog.load()); });
    let previous = this.parcels.parcel();
    this.detailsOpen.set(!!previous && !this.store.report());
    effect(() => {
      const parcel = this.parcels.parcel();
      const changed = parcel !== previous;
      previous = parcel;
      if (changed) untracked(() => this.detailsOpen.set(!!parcel && !this.store.report()));
    });
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

  protected closeDetails() {
    if (this.declarations().collect() !== null) this.detailsOpen.set(false);
  }

  protected submit() {
    if (this.form.invalid) return;
    const farmerAnswers = this.declarations().collect();
    if (farmerAnswers === null) { this.detailsOpen.set(true); return; }
    this.detailsOpen.set(false);
    const v = this.form.getRawValue();
    void this.store.analyze({
      crop: v.crop, date: v.date, stage: v.stage, sowing: v.sowing || null, irrigation: v.irrigation,
      irrigation_mm: v.irrigation ? v.irrigation_mm ?? 0 : 0, scenario_mm: v.scenario_mm ?? 0,
      confirm_land: v.confirm_land, soil_observation: v.soil_observation,
      farmer_answers: farmerAnswers,
    });
  }
}
