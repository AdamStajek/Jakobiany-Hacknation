import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { signal } from '@angular/core';
import type { Field } from '../../core/state/fields.store';
import { PassportStore } from '../../core/state/passport.store';
import { PassportSummary } from '../../shared/ui/passport-summary';

/** Dane działki wybranego pola (dla pola z kilkoma działkami: z wyborem działki). */
@Component({
  selector: 'app-field-passport',
  imports: [PassportSummary],
  host: {class: 'flex flex-col gap-3'},
  template: `
    @if (field().parcels.length > 1) {
      <label class="flex flex-col gap-1 text-sm font-medium">Działka w polu
        <select class="p-inputtext p-component h-11" (change)="index.set(+valueOf($event))">
          @for (parcel of field().parcels; track parcel.id; let i = $index) {
            <option [value]="i" [selected]="i === index()">{{parcel.id}}</option>
          }
        </select>
      </label>
    }
    <app-passport-summary [data]="entry().data" [loading]="entry().loading" [progress]="entry().progress" [percent]="entry().percent" [error]="entry().error"
      [title]="field().name" [subtitle]="subtitle()" (retry)="reload()" />
  `,
})
export class FieldPassport {
  private readonly store = inject(PassportStore);

  readonly field = input.required<Field>();
  protected readonly index = signal(0);

  private readonly target = computed(() => {
    const field = this.field();
    const parcel = field.parcels[Math.min(this.index(), field.parcels.length - 1)];
    return parcel ? {parcelId: parcel.id, crop: field.crop === 'unknown' ? null : field.crop ?? null} : null;
  });
  protected readonly entry = computed(() => {
    const target = this.target();
    return target ? this.store.entry(target.parcelId, target.crop) : this.store.entry('', null);
  });
  protected readonly subtitle = computed(() => this.field().parcels.length > 1 ? `działka ${this.target()?.parcelId ?? ''}` : '');

  constructor() {
    effect(() => {
      this.field();
      untracked(() => this.index.set(0));
    });
    effect((onCleanup) => {
      const target = this.target();
      if (!target) return;
      untracked(() => void this.store.load(target.parcelId, target.crop));
      // Zmiana pola/działki przerywa trwające pobieranie poprzedniego.
      onCleanup(() => this.store.cancel(target.parcelId, target.crop));
    });
  }

  protected valueOf(event: Event): string { return (event.target as HTMLSelectElement).value; }

  protected reload() {
    const target = this.target();
    if (target) void this.store.load(target.parcelId, target.crop, true);
  }
}
