import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import type { Parcel } from '../../core/api/types';
import { AnalysisStore } from '../../core/state/analysis.store';
import { FIELD_COLORS, Field, FieldColor, FieldParcel, FieldsStore, Resolution } from '../../core/state/fields.store';
import { COLOR_STYLES } from './field-colors';
import { parseParcelList } from './parcel-list';

type Entry = Resolution | {state: 'pending'};
type Row = {token: string; key: string; entry: Entry | null; parcel: Parcel | null};

const CONCURRENCY = 4;
const toFieldParcel = (p: Parcel): FieldParcel => ({id: p.id, area_ha: p.area_ha, geometry: p.geometry});

/** Formularz nowego pola: nazwa, kolor, uprawa i lista numerów działek z widocznym stanem każdego numeru. */
@Component({
  selector: 'app-field-form',
  imports: [DecimalPipe, ButtonModule],
  template: `
    <form class="flex flex-col gap-4" (submit)="$event.preventDefault(); submit()" aria-labelledby="field-form-title">
      <h2 id="field-form-title" class="text-base font-semibold">Nowe pole</h2>

      <div class="flex flex-col gap-1">
        <label for="field-name" class="text-sm font-medium">Nazwa pola</label>
        <input id="field-name" type="text" maxlength="60" autocomplete="off" placeholder="np. Pole przy lesie"
          class="p-inputtext p-component h-11 w-full" [value]="name()" (input)="name.set(valueOf($event))" />
      </div>

      <div class="flex flex-col gap-1">
        <label for="field-crop" class="text-sm font-medium">Uprawa (opcjonalnie)</label>
        <select id="field-crop" class="p-inputtext p-component h-11 w-full" (change)="crop.set(valueOf($event))">
          <option value="" [selected]="!crop()">Nie wybrano</option>
          @for (item of analysis.crops(); track item.id) { <option [value]="item.id" [selected]="crop() === item.id">{{item.label}}</option> }
        </select>
      </div>

      <fieldset class="flex flex-col gap-1">
        <legend class="text-sm font-medium">Kolor</legend>
        <div class="flex flex-wrap gap-2">
          @for (item of colors; track item.id) {
            <button type="button" (click)="color.set(item.id)" [attr.aria-pressed]="color() === item.id" [attr.aria-label]="item.label"
              class="grid h-11 w-11 place-items-center rounded-full border border-surface"
              [class.ring-2]="color() === item.id" [class.ring-primary]="color() === item.id">
              <span class="h-6 w-6 rounded-full {{item.dot}}"></span>
            </button>
          }
        </div>
      </fieldset>

      <div class="flex flex-col gap-1">
        <label for="field-parcels" class="text-sm font-medium">Numery działek</label>
        <textarea id="field-parcels" rows="5" class="p-inputtext p-component w-full" aria-describedby="field-parcels-hint"
          placeholder="Wklej numery: jeden w wierszu lub po przecinku" [value]="text()" (input)="text.set(valueOf($event))"></textarea>
        <p id="field-parcels-hint" class="text-xs text-muted-color">Do {{max}} numerów. Duplikaty pomijamy.
          @if (parsed().duplicates) { Pominięto powtórzeń: {{parsed().duplicates}}. }
          @if (parsed().truncated) { Ponad limit odcięto: {{parsed().truncated}}. }
        </p>
      </div>

      <p class="sr-only" role="status" aria-live="polite">{{summary()}}</p>
      @if (rows().length) {
        <ul class="flex flex-col gap-2" aria-label="Stan numerów działek">
          @for (row of rows(); track row.key) {
            <li class="pw-card flex flex-col gap-2 p-3 text-sm">
              <div class="flex items-center gap-2">
                <span class="min-w-0 flex-1 truncate font-medium">{{row.token}}</span>
                @switch (row.entry?.state) {
                  @case ('recognized') { <span class="inline-flex items-center gap-1 text-green-700 dark:text-green-400"><i class="pi pi-check-circle" aria-hidden="true"></i>Rozpoznana</span> }
                  @case ('ambiguous') { <span class="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400"><i class="pi pi-question-circle" aria-hidden="true"></i>Niejednoznaczna</span> }
                  @case ('unrecognized') { <span class="inline-flex items-center gap-1 text-red-700 dark:text-red-400"><i class="pi pi-times-circle" aria-hidden="true"></i>Nierozpoznana</span> }
                  @case ('error') { <span class="inline-flex items-center gap-1 text-red-700 dark:text-red-400"><i class="pi pi-exclamation-triangle" aria-hidden="true"></i>Błąd</span> }
                  @case ('pending') { <span class="inline-flex items-center gap-1 text-muted-color"><i class="pi pi-spin pi-spinner" aria-hidden="true"></i>Sprawdzam…</span> }
                  @default { <span class="inline-flex items-center gap-1 text-muted-color"><i class="pi pi-clock" aria-hidden="true"></i>Do sprawdzenia</span> }
                }
              </div>
              @if (row.parcel; as parcel) {
                <p class="text-xs text-muted-color">{{parcel.id}} · {{parcel.area_ha | number:'1.0-4'}} ha@if (parcel.commune) { · gmina {{parcel.commune}} }</p>
              }
              @if (ambiguousCandidates(row); as candidates) {
                <p class="text-xs text-muted-color">Kilka pasujących działek. Wybierz właściwą:</p>
                <div class="flex flex-wrap gap-2">
                  @for (candidate of candidates; track candidate.id) {
                    <button type="button" class="min-h-9 rounded-lg border border-surface px-3 text-xs hover:bg-surface-100 dark:hover:bg-surface-800"
                      (click)="choose(row.key, candidate)">{{candidate.id}}@if (candidate.commune) { · {{candidate.commune}} }</button>
                  }
                </div>
              }
              @if (errorText(row); as message) { <p class="text-xs text-red-700 dark:text-red-400" role="alert">{{message}}</p> }
            </li>
          }
        </ul>
      }

      @if (skipped()) {
        <p class="text-sm text-amber-700 dark:text-amber-400" role="status">Pominiemy numery, które nie zostały rozpoznane ({{skipped()}}).</p>
      }

      <div class="flex flex-wrap gap-2">
        @if (needsCheck()) {
          <p-button type="button" label="Sprawdź numery" icon="pi pi-search" [loading]="checking()" [disabled]="!parsed().tokens.length" (onClick)="check()" />
        } @else {
          <p-button type="submit" label="Zapisz pole" icon="pi pi-check" [loading]="saving()" [disabled]="!canSave() || saving()" />
        }
        <p-button type="button" label="Anuluj" severity="secondary" [outlined]="true" (onClick)="cancelled.emit()" />
      </div>
    </form>
  `,
})
export class FieldForm {
  private readonly store = inject(FieldsStore);
  protected readonly analysis = inject(AnalysisStore);

  /** Działka, od której zaczynamy (np. bieżąca po raporcie). */
  readonly initial = input<Parcel | null>(null);
  readonly saved = output<Field>();
  readonly cancelled = output<void>();

  protected readonly colors = COLOR_STYLES;
  protected readonly max = 40;
  protected readonly name = signal('');
  protected readonly color = signal<FieldColor>(FIELD_COLORS[0]);
  protected readonly crop = signal('');
  protected readonly text = signal('');
  protected readonly entries = signal<Record<string, Entry>>({});
  protected readonly choices = signal<Record<string, Parcel>>({});
  protected readonly saving = signal(false);
  protected readonly checking = computed(() => Object.values(this.entries()).some((e) => e.state === 'pending'));

  protected readonly parsed = computed(() => parseParcelList(this.text()));
  protected readonly rows = computed<Row[]>(() => this.parsed().tokens.map((token) => {
    const key = token.toLowerCase();
    const entry = this.entries()[key] ?? null;
    const parcel = this.choices()[key] ?? (entry?.state === 'recognized' ? entry.parcel : null);
    return {token, key, entry, parcel};
  }));
  /** Zbiorcza informacja dla czytnika ekranu; pojedyncze wiersze nie ogłaszają zmian. */
  protected readonly summary = computed(() => {
    const rows = this.rows().filter((r) => r.entry && r.entry.state !== 'pending');
    return rows.length ? `Sprawdzono ${rows.length} z ${this.rows().length} numerów, rozpoznano ${rows.filter((r) => r.parcel).length}.` : '';
  });
  protected readonly needsCheck = computed(() => this.rows().some((r) => r.entry === null || r.entry.state === 'error'));
  protected readonly skipped = computed(() => this.rows().filter((r) => r.entry && !r.parcel && r.entry.state !== 'pending').length);
  protected readonly canSave = computed(() =>
    this.name().trim().length > 0 && !this.checking() && this.rows().some((r) => r.parcel) && this.rows().every((r) => r.entry?.state !== 'pending'));

  constructor() {
    void this.analysis.init();
    effect(() => {
      const parcel = this.initial();
      if (!parcel) return;
      untracked(() => {
        this.text.set(parcel.id);
        this.entries.set({[parcel.id.toLowerCase()]: {state: 'recognized', parcel}});
      });
    });
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected ambiguousCandidates(row: Row): Parcel[] | null {
    return row.entry?.state === 'ambiguous' && !row.parcel ? row.entry.candidates : null;
  }

  protected errorText(row: Row): string {
    return row.entry?.state === 'error' ? row.entry.message : '';
  }

  protected choose(key: string, parcel: Parcel) {
    this.choices.update((c) => ({...c, [key]: parcel}));
  }

  /** Sprawdza numery jeszcze nierozpoznane (po kilka naraz). */
  protected async check() {
    const todo = this.rows().filter((r) => r.entry === null || r.entry.state === 'error');
    this.entries.update((e) => ({...e, ...Object.fromEntries(todo.map((r) => [r.key, {state: 'pending'} as const]))}));
    const queue = [...todo];
    const worker = async () => {
      for (let row = queue.shift(); row; row = queue.shift()) {
        const result = await this.store.resolve(row.token);
        this.entries.update((e) => ({...e, [row.key]: result}));
      }
    };
    await Promise.all(Array.from({length: Math.min(CONCURRENCY, todo.length)}, worker));
  }

  protected async submit() {
    if (!this.canSave() || this.saving()) return;
    const unique = new Map<string, FieldParcel>();
    for (const row of this.rows()) if (row.parcel) unique.set(row.parcel.id, toFieldParcel(row.parcel));
    this.saving.set(true);
    const field = await this.store.add({name: this.name(), color: this.color(), crop: this.crop() || null, parcels: [...unique.values()]});
    this.saving.set(false);
    if (field) this.saved.emit(field);
  }
}
