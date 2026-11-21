import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TextareaModule } from 'primeng/textarea';
import { ApiError, DecisionInput, ReviewItem } from '../../../core/api/types';
import { REVIEW_ACTION } from '../../../core/labels';
import { Attempt } from '../ekspert.facade';
import { Obj, bindServerErrors, buildChanges, genericChanges, toText } from '../review.util';
import { FieldSpec, fieldsFor, hasRegistry } from '../target-fields';

type Action = DecisionInput['action'];

/**
 * Formularz decyzji. Pola korekty pochodzą z rejestru `target_type → pola`. Formularz zeruje się tylko przy zmianie
 * rekordu lub po zapisanej decyzji, więc korekta przetrwa konflikt 409 i można ją ponowić na nowej rewizji.
 */
@Component({
  selector: 'app-decision-form',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, MessageModule, SelectModule, SelectButtonModule, TextareaModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="send()" class="flex flex-col gap-4" aria-label="Decyzja eksperta">
      <fieldset class="border-0 p-0 m-0 flex flex-col gap-2">
        <legend class="font-semibold mb-1">Decyzja</legend>
        <p-selectbutton [options]="actions" optionLabel="label" optionValue="value" formControlName="action" [allowEmpty]="false" ariaLabel="Rodzaj decyzji" />
        <p class="m-0 text-xs text-muted-color">{{ hint() }}</p>
      </fieldset>

      <label class="flex flex-col gap-1 text-sm">
        <span>Powód <span class="text-red-600" aria-hidden="true">*</span></span>
        <textarea pTextarea formControlName="reason" rows="2" required aria-required="true" placeholder="Dlaczego ta decyzja?"></textarea>
        @if (form.controls.reason.touched && form.controls.reason.invalid) {
          <small class="text-red-600" role="alert">{{ reasonError() }}</small>
        }
      </label>

      @if (isCorrect()) {
        <fieldset class="border border-surface rounded-lg p-3 m-0 flex flex-col gap-3">
          <legend class="font-semibold px-1">Korekta pól</legend>
          @if (!registry()) { <p class="m-0 text-xs text-muted-color">Dla tego typu nie ma gotowych pól – podaj obiekt zmian.</p> }
          @for (s of specs(); track s.key) {
            <label class="flex flex-col gap-1 text-sm" [formGroup]="fields">
              <span>{{ s.label }}</span>
              @switch (s.kind) {
                @case ('select') { <p-select [options]="s.options ?? []" optionLabel="label" optionValue="value" [formControlName]="s.key" [showClear]="true" size="small" class="w-full" /> }
                @case ('text') { <input pInputText [formControlName]="s.key" /> }
                @case ('ids') { <input pInputText [formControlName]="s.key" /> }
                @default { <textarea pTextarea [formControlName]="s.key" [rows]="s.kind === 'textarea' ? 3 : 5" [class.font-mono]="s.kind !== 'textarea'"></textarea> }
              }
              @if (s.hint) { <small class="text-muted-color">{{ s.hint }}</small> }
              @if (fields.get(s.key)?.errors; as e) { <small class="text-red-600" role="alert">{{ e['client'] ?? e['server'] }}</small> }
            </label>
          }
        </fieldset>
      }

      @if (problems().length) {
        <p-message severity="error">
          <ul class="m-0 pl-4" role="alert">@for (p of problems(); track $index) { <li>{{ p }}</li> }</ul>
        </p-message>
      }

      <div class="flex justify-end">
        <p-button type="submit" [label]="submitLabel()" [icon]="icon()" [loading]="submitting()" [disabled]="!canSend()" />
      </div>
    </form>
  `,
})
export class DecisionForm {
  readonly item = input.required<ReviewItem>();
  readonly submitting = input(false);
  readonly serverError = input<ApiError | null>(null);
  /** Zmiana wartości = rekord został zapisany i formularz wraca do stanu początkowego. */
  readonly resetToken = input(0);
  readonly decide = output<Attempt>();

  protected readonly actions = Object.entries(REVIEW_ACTION).map(([value, m]) => ({ value: value as Action, label: m.label }));
  protected readonly form = new FormGroup({
    action: new FormControl<Action>('approve', { nonNullable: true }),
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/)] }),
  });
  protected fields = new FormGroup<Record<string, FormControl<string>>>({});
  protected readonly specs = signal<FieldSpec[]>([]);
  protected readonly registry = computed(() => hasRegistry(this.item().target_type));
  private readonly action = signal<Action>('approve');
  private readonly reason = signal('');
  private baseline: Record<string, string> = {};
  private readonly localProblems = signal<string[]>([]);
  private readonly serverProblems = signal<string[]>([]);

  protected readonly isCorrect = computed(() => this.action() === 'correct');
  protected readonly hint = computed(() => REVIEW_ACTION[this.action()].hint);
  protected readonly icon = computed(() => REVIEW_ACTION[this.action()].icon);
  protected readonly submitLabel = computed(() => `Zapisz: ${REVIEW_ACTION[this.action()].label.toLowerCase()}`);
  protected readonly canSend = computed(() => !this.submitting() && this.reason().trim().length > 0);
  protected readonly problems = computed(() => [...this.localProblems(), ...this.serverProblems()]);
  protected reasonError() { return this.form.controls.reason.errors ? 'Powód jest wymagany.' : ''; }

  constructor() {
    this.form.controls.action.valueChanges.subscribe((a) => { this.action.set(a); this.clearProblems(); });
    this.form.controls.reason.valueChanges.subscribe((r) => this.reason.set(r));
    effect(() => {
      const it = this.item();
      this.resetToken();
      untracked(() => this.reset(it, `${it.target_type}:${it.target_id}`));
    });
    effect(() => {
      const err = this.serverError();
      untracked(() => this.applyServerError(err));
    });
  }

  private lastKey = '';
  private lastToken = -1;

  /** Pełny reset tylko przy zmianie rekordu lub tokenu; sama zmiana rewizji (po konflikcie) zostawia korektę. */
  private reset(it: ReviewItem, key: string) {
    const token = this.resetToken();
    if (key === this.lastKey && token === this.lastToken) return;
    this.lastKey = key;
    this.lastToken = token;
    const specs = fieldsFor(it.target_type);
    const value = it.value as Obj;
    this.specs.set(specs);
    this.baseline = Object.fromEntries(specs.map((s) => [s.key, hasRegistry(it.target_type) ? toText(s, value[s.key]) : '']));
    this.fields = new FormGroup(Object.fromEntries(specs.map((s) => [s.key, new FormControl(this.baseline[s.key], { nonNullable: true })])));
    this.form.reset({ action: 'approve', reason: '' });
    this.clearProblems();
  }

  private clearProblems() { this.localProblems.set([]); this.serverProblems.set([]); }

  private applyServerError(err: ApiError | null) {
    this.serverProblems.set([]);
    if (!err) return;
    const { byField, general } = bindServerErrors(err, this.specs().map((s) => s.key));
    for (const [k, msg] of Object.entries(byField)) this.fields.get(k)?.setErrors({ server: msg });
    this.serverProblems.set(general);
  }

  protected send() {
    const action = this.action();
    const reason = this.form.controls.reason.value;
    if (!reason.trim()) { this.form.controls.reason.markAsTouched(); return; }
    this.clearProblems();
    if (action !== 'correct') { this.decide.emit({ action, reason }); return; }
    const texts = this.fields.getRawValue();
    const original = this.item().value as Obj;
    const r = this.registry() ? buildChanges(this.specs(), texts, this.baseline, original) : genericChanges(texts['changes'] ?? '');
    for (const [k, msg] of Object.entries(r.errors)) this.fields.get(k)?.setErrors({ client: msg });
    if (Object.keys(r.errors).length) { this.localProblems.set(['Popraw zaznaczone pola.']); return; }
    if (!Object.keys(r.changes).length) { this.localProblems.set(['Korekta wymaga zmiany co najmniej jednego pola.']); return; }
    this.decide.emit({ action, reason, changes: r.changes });
  }
}
