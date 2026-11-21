import { Component, computed, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { PHASE_LABEL } from '../../../core/labels';
import { Checklist, Phase, Requirement, Subsector } from '../rules.types';
import { RequirementRow } from './requirement-row';

/** Checklisty informacji wg podsektora i fazy inwestycji. */
@Component({
  selector: 'app-checklist-editor',
  imports: [FormsModule, ButtonModule, SelectModule, RequirementRow],
  template: `
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <label class="flex flex-col gap-1 text-sm">Podsektor
        <p-select [options]="subsectorOptions()" [ngModel]="subsector()" (ngModelChange)="picked.set($event)" optionLabel="label" optionValue="code" class="min-w-56" appendTo="body" />
      </label>
      <label class="flex flex-col gap-1 text-sm">Faza
        <p-select [options]="phaseOptions" [ngModel]="phase()" (ngModelChange)="phase.set($event)" optionLabel="label" optionValue="value" class="min-w-56" appendTo="body" />
      </label>
    </div>

    @if (index() < 0) {
      <div class="p-4 border border-dashed border-surface rounded-lg text-muted-color flex items-center gap-3 flex-wrap">
        <span>Brak checklisty dla tej pary podsektor–faza.</span>
        @if (!readonly()) { <p-button label="Utwórz checklistę" icon="pi pi-plus" size="small" severity="secondary" (onClick)="create()" /> }
      </div>
    } @else {
      <div class="flex flex-col gap-3">
        @for (r of current()!.requirements; track $index) {
          <app-requirement-row [req]="r" [riskCodes]="riskCodes()" [readonly]="readonly()"
            (changed)="replace($index, $event)" (removed)="removeReq($index)" />
        }
        @if (!readonly()) {
          <div class="flex gap-2">
            <p-button label="Dodaj pozycję" icon="pi pi-plus" size="small" severity="secondary" (onClick)="addReq()" />
            <p-button label="Usuń checklistę" icon="pi pi-trash" size="small" severity="danger" [text]="true" (onClick)="removeList()" />
          </div>
        }
      </div>
    }
    <p class="text-xs text-muted-color mt-4 mb-0">Zdefiniowane checklisty: {{ checklists().length }}</p>
  `,
})
export class ChecklistEditor {
  readonly checklists = model.required<Checklist[]>();
  readonly subsectors = input.required<Subsector[]>();
  readonly riskCodes = input.required<string[]>();
  readonly readonly = input(false);

  protected readonly phaseOptions = (Object.keys(PHASE_LABEL) as Phase[]).map((value) => ({ value, label: PHASE_LABEL[value] }));
  protected readonly subsectorOptions = computed(() => this.subsectors());
  protected readonly picked = signal<string | null>(null);
  protected readonly subsector = computed(() => this.picked() ?? this.subsectors()[0]?.code ?? '');
  protected readonly phase = signal<Phase>('planning');

  protected readonly index = computed(() =>
    this.checklists().findIndex((c) => c.subsector_code === this.subsector() && c.phase === this.phase()));
  protected readonly current = computed(() => this.checklists()[this.index()]);

  private update(fn: (c: Checklist) => Checklist) {
    const i = this.index();
    this.checklists.update((l) => l.map((c, j) => (j === i ? fn(c) : c)));
  }
  protected create() {
    this.checklists.update((l) => [...l, { subsector_code: this.subsector(), phase: this.phase(), requirements: [] }]);
  }
  protected removeList() { const i = this.index(); this.checklists.update((l) => l.filter((_, j) => j !== i)); }
  protected addReq() {
    const req: Requirement = { code: '', question: '', rationale: '', weight: 1, risk_codes: [], expected_evidence: [] };
    this.update((c) => ({ ...c, requirements: [...c.requirements, req] }));
  }
  protected replace(i: number, r: Requirement) {
    this.update((c) => ({ ...c, requirements: c.requirements.map((x, j) => (j === i ? r : x)) }));
  }
  protected removeReq(i: number) {
    this.update((c) => ({ ...c, requirements: c.requirements.filter((_, j) => j !== i) }));
  }
}
