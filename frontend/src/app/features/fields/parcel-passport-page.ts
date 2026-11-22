import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AnalysisStore } from '../../core/state/analysis.store';
import { FieldsStore } from '../../core/state/fields.store';
import { ParcelStore } from '../../core/state/parcel.store';
import { PassportStore } from '../../core/state/passport.store';
import { AddFieldButton } from '../../shared/ui/add-field-button';
import { PassportSummary } from '../../shared/ui/passport-summary';

/**
 * Paszport pojedynczej działki (`/dzialka/:id/paszport`, link z raportu). Gdy działka należy do pola,
 * przekierowujemy do paszportu tego pola; w przeciwnym razie pokazujemy skrót i propozycję dodania do pól.
 */
@Component({
  selector: 'app-parcel-passport-page',
  imports: [RouterLink, AddFieldButton, PassportSummary],
  host: {class: 'block'},
  template: `
    <div class="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <header>
        <h1 class="text-2xl font-extrabold tracking-tight">Dane działki</h1>
      </header>
      <app-passport-summary [data]="entry().data" [loading]="entry().loading" [error]="entry().error"
        [title]="id() ?? ''" [subtitle]="subtitle()" (retry)="reload()" />
      @if (parcels.parcel(); as parcel) {
        <div class="flex flex-wrap items-center gap-3">
          <app-add-field-button [added]="fields.parcelIds().has(parcel.id)" [busy]="fields.adding()" (add)="fields.quickAdd(parcel)" />
          <a routerLink="/pola" class="text-sm text-primary underline">Moje pola</a>
        </div>
      }
    </div>
  `,
})
export class ParcelPassportPage {
  protected readonly fields = inject(FieldsStore);
  protected readonly parcels = inject(ParcelStore);
  private readonly store = inject(PassportStore);
  private readonly analysis = inject(AnalysisStore);
  private readonly router = inject(Router);

  readonly id = input<string>();
  private readonly crop = computed(() => {
    const report = this.analysis.report();
    if (!report || report.parcel.id !== this.id() || report.date !== this.analysis.range().max) return null;
    const crop = this.analysis.reportForm()?.crop;
    return crop && crop !== 'unknown' ? crop : null;
  });
  protected readonly entry = computed(() => {
    const id = this.id();
    return id ? this.store.entry(id, this.crop()) : {loading: false, error: '', data: null};
  });
  protected readonly subtitle = computed(() => {
    const parcel = this.parcels.parcel();
    return parcel && parcel.id === this.id() && parcel.commune ? `gmina ${parcel.commune}` : '';
  });

  constructor() {
    void this.analysis.init();
    effect(() => {
      const id = this.id();
      const crop = this.crop();
      if (!id) return;
      untracked(() => {
        void this.parcels.open(id);
        void this.store.load(id, crop);
      });
    });
    effect(() => {
      const id = this.id();
      const field = id ? this.fields.fields().find((f) => f.parcels.some((p) => p.id === id)) : null;
      if (field) untracked(() => void this.router.navigate(['/pola'], {queryParams: {widok: 'paszporty', pole: field.id}, replaceUrl: true}));
    });
  }

  protected reload() {
    const id = this.id();
    if (id) void this.store.load(id, this.crop(), true);
  }
}
