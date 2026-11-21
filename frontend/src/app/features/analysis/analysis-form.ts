import { Component, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { AnalysisStore } from '../../core/state/analysis.store';
import { ParcelStore } from '../../core/state/parcel.store';

const STAGES = ['Początek wzrostu', 'Rozwój', 'Pełnia wzrostu', 'Dojrzewanie', 'Poza sezonem'];

@Component({
  selector: 'app-analysis-form',
  imports: [ReactiveFormsModule, ButtonModule, CheckboxModule, MessageModule, SelectModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="flex min-h-full flex-col gap-4" aria-labelledby="form-title">
      <header>
        <h2 id="form-title" class="text-base font-semibold">Uprawa i data</h2>
        <p class="text-sm text-muted-color">Wybierz dziś lub dzień z ostatnich 10 lat.</p>
      </header>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <div class="flex flex-col gap-1">
          <label for="crop" class="text-sm font-medium">Rodzaj uprawy</label>
          <p-select inputId="crop" formControlName="crop" [options]="store.crops()" optionLabel="label" optionValue="id"
            appendTo="body" styleClass="w-full h-11" placeholder="Wybierz uprawę" />
          @if (cropUnknown()) {
            <p-message severity="warn" styleClass="mt-1">Bez uprawy wynik jest orientacyjny: używamy ogólnych parametrów, bez fazy rozwoju i porównania sezonowego. Wybierz uprawę, aby go doprecyzować.</p-message>
          }
        </div>
        <div class="flex flex-col gap-1">
          <label for="day" class="text-sm font-medium">Data analizy</label>
          <input id="day" type="date" formControlName="date" required class="p-inputtext p-component h-11 w-full"
            [min]="store.range().min" [max]="store.range().max" />
        </div>
      </div>

      <details class="pw-card group">
        <summary class="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium">
          Dodaj informacje o polu
          <i class="pi pi-chevron-down text-xs transition-transform group-open:rotate-180" aria-hidden="true"></i>
        </summary>
        <div class="space-y-3 border-t border-surface p-4">
          <div class="flex flex-col gap-1">
            <label for="stage" class="text-sm font-medium">Faza uprawy</label>
            <p-select inputId="stage" formControlName="stage" [options]="stages" optionLabel="label" optionValue="value"
              appendTo="body" styleClass="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label for="sowing" class="text-sm font-medium">Siew lub wznowienie wegetacji</label>
            <input id="sowing" type="date" formControlName="sowing" class="p-inputtext p-component h-11 w-full" [max]="form.controls.date.value" />
          </div>
          <div class="flex flex-col gap-1">
            <label for="soil" class="text-sm font-medium">Co widzisz po sprawdzeniu gleby?</label>
            <p-select inputId="soil" formControlName="soil_observation" [options]="soilOptions" optionLabel="label" optionValue="value"
              appendTo="body" styleClass="w-full" />
          </div>
          <div class="flex items-center gap-2">
            <p-checkbox inputId="irrigation" formControlName="irrigation" [binary]="true" />
            <label for="irrigation" class="text-sm">Mam możliwość nawadniania</label>
          </div>
          @if (form.controls.irrigation.value) {
            <div class="flex flex-col gap-1">
              <label for="irrigation-mm" class="text-sm font-medium">Woda z nawadniania w dniu analizy [mm]</label>
              <input id="irrigation-mm" type="number" min="0" max="150" step="0.1" formControlName="irrigation_mm" class="p-inputtext p-component h-11 w-full" />
            </div>
          }
          <div class="flex flex-col gap-1">
            <label for="scenario" class="text-sm font-medium">Co jeśli zatrzymam dodatkowy opad? [mm]</label>
            <input id="scenario" type="number" min="0" max="50" step="0.5" formControlName="scenario_mm" placeholder="np. 10" class="p-inputtext p-component h-11 w-full" />
          </div>
          <div class="flex items-start gap-2">
            <p-checkbox inputId="confirm" formControlName="confirm_land" [binary]="true" />
            <label for="confirm" class="text-sm">Potwierdzam uprawę, jeśli mapa wskazuje inne użytkowanie</label>
          </div>
        </div>
      </details>

      @if (store.error()) { <p-message severity="error" icon="pi pi-exclamation-circle" role="alert">{{store.error()}}</p-message> }

      <div class="sticky bottom-0 -mx-4 mt-auto space-y-2 border-t border-surface bg-surface-0 px-4 py-3 dark:bg-surface-900">
        <p-button type="submit" styleClass="h-12 w-full" icon="pi pi-chart-line" label="Analizuj gospodarowanie wodą"
          [loading]="store.running()" [disabled]="!parcels.parcel() || parcels.parcel()?.analyzable === false || form.invalid || store.running() || parcels.loading()" />
        @if (!parcels.parcel()) { <p class="text-center text-xs text-muted-color">Najpierw wybierz działkę.</p> }
      </div>
    </form>
  `,
})
export class AnalysisForm {
  protected readonly store = inject(AnalysisStore);
  protected readonly parcels = inject(ParcelStore);
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

  protected submit() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    void this.store.analyze({
      crop: v.crop, date: v.date, stage: v.stage, sowing: v.sowing || null, irrigation: v.irrigation,
      irrigation_mm: v.irrigation ? v.irrigation_mm ?? 0 : 0, scenario_mm: v.scenario_mm ?? 0,
      confirm_land: v.confirm_land, soil_observation: v.soil_observation,
    });
  }
}
