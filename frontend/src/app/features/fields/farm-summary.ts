import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import type { FarmStats } from './farm-stats';

/** Panel „Moje gospodarstwo”: podsumowanie pól (tylko prezentacja; status i powody pochodzą z backendu). */
@Component({
  selector: 'app-farm-summary',
  imports: [DatePipe, DecimalPipe, ButtonModule],
  host: {class: 'block print:hidden'},
  template: `
    <section class="pw-card flex flex-col gap-3 p-4" aria-labelledby="farm-summary-title">
      <header class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="farm-summary-title" class="text-base font-semibold">Moje gospodarstwo</h2>
        @if (stats().fields) {
          <p class="mr-auto text-sm text-muted-color">
            {{stats().fields}} {{stats().fields === 1 ? 'pole' : 'pól'}} · {{stats().parcels}} {{stats().parcels === 1 ? 'działka' : 'działek'}}@if (stats().totalAreaHa !== null) { · {{stats().totalAreaHa | number:'1.0-2'}} ha}
          </p>
          @if (stats().attention.length) {
            <span class="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-200">
              <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>{{stats().attention.length}} wymaga uwagi</span>
          } @else if (stats().lastReportDate) {
            <span class="inline-flex items-center gap-1 text-xs text-muted-color"><i class="pi pi-check-circle" aria-hidden="true"></i>Nic nie wymaga uwagi</span>
          }
        }
        <button type="button" class="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-100 dark:hover:bg-surface-800"
          [attr.aria-expanded]="open()" aria-controls="farm-summary-body" [attr.aria-label]="open() ? 'Zwiń szczegóły gospodarstwa' : 'Rozwiń szczegóły gospodarstwa'"
          (click)="open.set(!open())">
          <i class="pi" [class]="open() ? 'pi-chevron-up' : 'pi-chevron-down'" aria-hidden="true"></i>
        </button>
      </header>

      <div id="farm-summary-body" class="flex-col gap-3 text-sm" [class]="open() ? 'flex' : 'hidden'">
        @if (!stats().fields) {
          <p class="text-muted-color">Dodaj pierwsze pole, a tu zobaczysz, ile masz pól, jakie uprawy i co wymaga uwagi.</p>
        } @else {
          @if (stats().totalAreaHa === null) {
            <p class="text-muted-color">Powierzchnia nie jest znana dla wszystkich działek.</p>
          }
          <div>
            <h3 class="font-semibold">Uprawy</h3>
            <ul class="mt-1 flex flex-col gap-1">
              @for (crop of stats().crops; track crop.key) {
                <li>{{crop.label}}: {{crop.fields}} {{crop.fields === 1 ? 'pole' : 'pól'}}@if (crop.areaHa !== null) { · {{crop.areaHa | number:'1.0-2'}} ha}</li>
              }
            </ul>
          </div>

          <div>
            <h3 class="font-semibold">Raporty</h3>
            @if (stats().lastReportDate; as last) {
              <p class="text-muted-color">Ostatni raport: {{last | date:'d MMM yyyy'}}.</p>
            }
            @if (stats().withoutReport.length) {
              <p><i class="pi pi-info-circle" aria-hidden="true"></i> Bez raportu: {{stats().withoutReport.join(', ')}}.</p>
            }
            @if (stats().stale.length) {
              <p class="text-amber-700 dark:text-amber-400"><i class="pi pi-history" aria-hidden="true"></i> Nieaktualny raport: {{stats().stale.join(', ')}}.</p>
            }
            @if (!stats().lastReportDate) {
              <p class="text-muted-color">Żadne pole nie ma jeszcze raportu. Uruchom analizę przy wybranym polu.</p>
            }
          </div>
        }
      </div>
      @if (stats().fields) {
        <p-button label="Pobierz raport o moich polach" icon="pi pi-download" severity="secondary" [outlined]="true" size="small"
          styleClass="min-h-10 w-full sm:w-auto" (onClick)="download.emit()" />
      }
    </section>
  `,
})
export class FarmSummary {
  readonly stats = input.required<FarmStats>();
  readonly download = output<void>();
  protected readonly open = signal(false);
}
