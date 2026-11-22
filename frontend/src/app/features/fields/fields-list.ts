import { Component, computed, input, output } from '@angular/core';
import { Field, TONE_ORDER, riskTone } from '../../core/state/fields.store';
import { FarmStats } from './farm-stats';
import { FarmSummary } from './farm-summary';
import { FieldCard } from './field-card';

/** Wypełniona lista pól: krótkie podsumowanie gospodarstwa i karty pól (najpierw te wymagające uwagi). */
@Component({
  selector: 'app-fields-list',
  imports: [FarmSummary, FieldCard],
  host: {class: 'contents'},
  template: `
    <app-farm-summary [stats]="stats()" (download)="download.emit()" />
    <ul class="flex flex-col gap-3" aria-label="Pola">
      @for (field of sorted(); track field.id) {
        <li><app-field-card [field]="field" [cropLabel]="cropLabel()(field)"
          (analyze)="analyze.emit($event)" (located)="located.emit(field.id)" (passport)="passport.emit(field.id)" (removed)="removed.emit($event)" (renamed)="renamed.emit($event)" /></li>
      }
    </ul>
  `,
})
export class FieldsList {
  readonly fields = input.required<Field[]>();
  /** Pola od najpilniejszych; przy równym statusie zostaje kolejność dodania (sort jest stabilny). */
  protected readonly sorted = computed(() => [...this.fields()].sort((a, b) => TONE_ORDER[riskTone(a.status)] - TONE_ORDER[riskTone(b.status)]));
  readonly stats = input.required<FarmStats>();
  readonly cropLabel = input.required<(field: Field) => string>();

  readonly download = output<void>();
  /** Id działki do analizy. */
  readonly analyze = output<string>();
  readonly located = output<string>();
  readonly passport = output<string>();
  readonly removed = output<string>();
  readonly renamed = output<{id: string; name: string; done: (ok: boolean) => void}>();
}
