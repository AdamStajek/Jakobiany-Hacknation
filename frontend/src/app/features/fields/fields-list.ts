import { Component, input, output } from '@angular/core';
import { Field } from '../../core/state/fields.store';
import { Panel } from '../../shared/ui/panel';
import { FarmStats } from './farm-stats';
import { FarmSummary } from './farm-summary';
import { FieldCard } from './field-card';

export type AttentionItem = {field: Field; reasons: string[]};

/** Wypełniona lista pól: podsumowanie gospodarstwa, „Wymaga uwagi” i karty pól. */
@Component({
  selector: 'app-fields-list',
  imports: [Panel, FarmSummary, FieldCard],
  host: {class: 'contents'},
  template: `
    <app-farm-summary [stats]="stats()" (download)="download.emit()" />
    @if (attention().length) {
      <app-panel heading="Wymaga uwagi" icon="pi-exclamation-triangle">
        <ul class="flex flex-col gap-2 text-sm">
          @for (item of attention(); track item.field.id) {
            <li><button type="button" class="w-full rounded-lg px-2 py-1 text-left hover:bg-surface-100 dark:hover:bg-surface-800" (click)="analyze.emit(item.field.parcels[0].id)">
              <span class="font-semibold">{{item.field.name}}</span>
              <span class="block text-xs text-muted-color">{{item.reasons.join(' · ')}}</span>
            </button></li>
          }
        </ul>
      </app-panel>
    }
    <ul class="flex flex-col gap-3" aria-label="Pola">
      @for (field of fields(); track field.id) {
        <li><app-field-card [field]="field" [cropLabel]="cropLabel()(field)"
          (analyze)="analyze.emit($event)" (located)="located.emit(field.id)" (passport)="passport.emit(field.id)" (removed)="removed.emit($event)" (renamed)="renamed.emit($event)" /></li>
      }
    </ul>
  `,
})
export class FieldsList {
  readonly fields = input.required<Field[]>();
  readonly attention = input.required<AttentionItem[]>();
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
