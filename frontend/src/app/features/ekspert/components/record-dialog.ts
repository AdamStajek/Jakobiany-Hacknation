import { Component, effect, inject, input, model, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ApiError, ReviewTargetType } from '../../../core/api/types';
import { TARGET_TYPE_LABEL } from '../../../core/labels';
import { EkspertFacade } from '../ekspert.facade';
import { Obj, bindServerErrors, parseText } from '../review.util';
import { FieldSpec, RECORD_TYPES, fieldsFor, recordDefaults } from '../target-fields';

/** Własny wpis eksperta (`POST /expert/records`): fakt, powiązanie, ryzyko lub rekomendacja z dowodami. */
@Component({
  selector: 'app-record-dialog',
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, InputTextModule, MessageModule, SelectModule, TextareaModule],
  template: `
    <p-dialog header="Dodaj własny wpis" [(visible)]="visible" [modal]="true" [style]="{ width: '40rem' }" [breakpoints]="{ '640px': '95vw' }">
      <form [formGroup]="meta" class="flex flex-col gap-3" (ngSubmit)="save()" aria-label="Nowy wpis eksperta">
        <label class="flex flex-col gap-1 text-sm">Typ wpisu
          <p-select [options]="typeOptions" optionLabel="label" optionValue="value" formControlName="type" size="small" class="w-full" />
        </label>
        <label class="flex flex-col gap-1 text-sm">Projekt (identyfikator) <span class="text-red-600" aria-hidden="true">*</span>
          <input pInputText formControlName="projectId" required aria-required="true" />
        </label>
        @for (s of specs(); track s.key) {
          <label class="flex flex-col gap-1 text-sm" [formGroup]="fields">
            <span>{{ s.label }}@if (s.key === 'evidence_ids') { <span class="text-red-600" aria-hidden="true"> *</span> }</span>
            @switch (s.kind) {
              @case ('select') { <p-select [options]="s.options ?? []" optionLabel="label" optionValue="value" [formControlName]="s.key" [showClear]="true" size="small" class="w-full" /> }
              @case ('text') { <input pInputText [formControlName]="s.key" /> }
              @case ('ids') { <input pInputText [formControlName]="s.key" /> }
              @default { <textarea pTextarea [formControlName]="s.key" [rows]="s.kind === 'textarea' ? 2 : 3" [class.font-mono]="s.kind !== 'textarea'"></textarea> }
            }
            @if (s.hint) { <small class="text-muted-color">{{ s.hint }}</small> }
            @if (fields.get(s.key)?.errors; as e) { <small class="text-red-600" role="alert">{{ e['client'] ?? e['server'] }}</small> }
          </label>
        }
        @if (problems().length) {
          <p-message severity="error"><ul class="m-0 pl-4" role="alert">@for (p of problems(); track $index) { <li>{{ p }}</li> }</ul></p-message>
        }
        <div class="flex justify-end gap-2">
          <p-button type="button" label="Anuluj" severity="secondary" [text]="true" (onClick)="visible.set(false)" />
          <p-button type="submit" label="Dodaj propozycję" icon="pi pi-plus" [loading]="busy()" />
        </div>
      </form>
    </p-dialog>
  `,
})
export class RecordDialog {
  readonly visible = model(false);
  readonly defaultProject = input('');
  private readonly facade = inject(EkspertFacade);

  protected readonly typeOptions = RECORD_TYPES.map((value) => ({ value, label: TARGET_TYPE_LABEL[value] }));
  protected readonly meta = new FormGroup({
    type: new FormControl<ReviewTargetType>('risk', { nonNullable: true }),
    projectId: new FormControl('', { nonNullable: true }),
  });
  protected fields = new FormGroup<Record<string, FormControl<string>>>({});
  protected readonly specs = signal<FieldSpec[]>([]);
  protected readonly busy = signal(false);
  protected readonly problems = signal<string[]>([]);
  private readonly type = signal<ReviewTargetType>('risk');

  constructor() {
    this.meta.controls.type.valueChanges.subscribe((t) => this.build(t));
    effect(() => {
      if (!this.visible()) return;
      const p = this.defaultProject();
      untracked(() => { this.meta.controls.projectId.setValue(p); this.build(this.type()); });
    });
  }

  private build(t: ReviewTargetType) {
    this.type.set(t);
    const specs = fieldsFor(t);
    const defaults = recordDefaults(t, this.meta.controls.projectId.value);
    this.fields = new FormGroup(Object.fromEntries(specs.map((s) => [s.key, new FormControl(defaults[s.key] ?? '', { nonNullable: true })])));
    this.specs.set(specs);
    this.problems.set([]);
  }

  protected save() {
    const projectId = this.meta.controls.projectId.value.trim();
    const errors: string[] = [];
    if (!projectId) errors.push('Podaj identyfikator projektu.');
    const value: Obj = {};
    for (const s of this.specs()) {
      const text = this.fields.controls[s.key].value;
      if (!text.trim()) continue;
      const r = parseText(s, text, undefined);
      if (r.ok) value[s.key] = r.value; else { this.fields.controls[s.key].setErrors({ client: r.error }); errors.push(`${s.label}: ${r.error}`); }
    }
    this.problems.set(errors);
    if (errors.length) return;
    this.busy.set(true);
    this.facade.createRecord(this.type(), projectId, value).subscribe({
      next: () => { this.busy.set(false); this.visible.set(false); },
      error: (e: ApiError) => { this.busy.set(false); this.showServerError(e); },
    });
  }

  private showServerError(e: ApiError) {
    const { byField, general } = bindServerErrors(e, this.specs().map((s) => s.key));
    for (const [k, msg] of Object.entries(byField)) this.fields.get(k)?.setErrors({ server: msg });
    this.problems.set(general);
  }
}
