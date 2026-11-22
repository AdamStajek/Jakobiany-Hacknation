import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import type { FarmStats } from './farm-stats';

/** Panel „Moje gospodarstwo”: podsumowanie pól (tylko prezentacja; status i powody pochodzą z backendu). */
@Component({
  selector: 'app-farm-summary',
  imports: [DatePipe, DecimalPipe, ButtonModule],
  host: {class: 'block print:hidden @container'},
  template: `
    <section class="pw-card flex flex-col gap-3 p-4" aria-labelledby="farm-summary-title">
      <header class="flex flex-wrap items-center gap-2">
        <h2 id="farm-summary-title" class="mr-auto text-base font-semibold">Moje gospodarstwo</h2>
        @if (stats().fields) {
          <p-button label="Pobierz raport o moich polach" icon="pi pi-download" severity="secondary" [outlined]="true" size="small"
            styleClass="min-h-10" (onClick)="download.emit()" />
        }
        <button type="button" class="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-100 dark:hover:bg-surface-800"
          [attr.aria-expanded]="open()" aria-controls="farm-summary-body" [attr.aria-label]="open() ? 'Zwiń szczegóły gospodarstwa' : 'Rozwiń szczegóły gospodarstwa'"
          (click)="open.set(!open())">
          <i class="pi" [class]="open() ? 'pi-chevron-up' : 'pi-chevron-down'" aria-hidden="true"></i>
        </button>
      </header>

      @if (stats().fields) {
        <dl class="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
          <div class="rounded-xl bg-surface-100 p-3 dark:bg-surface-800">
            <dt class="text-xs text-muted-color">{{stats().fields === 1 ? 'Pole' : 'Pola'}}</dt>
            <dd class="text-2xl font-semibold">{{stats().fields}}</dd>
          </div>
          <div class="rounded-xl bg-surface-100 p-3 dark:bg-surface-800">
            <dt class="text-xs text-muted-color">Działki</dt>
            <dd class="text-2xl font-semibold">{{stats().parcels}}</dd>
          </div>
          <div class="rounded-xl bg-surface-100 p-3 dark:bg-surface-800">
            <dt class="text-xs text-muted-color">Powierzchnia</dt>
            <dd class="text-2xl font-semibold">@if (stats().totalAreaHa !== null) { {{stats().totalAreaHa | number:'1.0-2'}} <span class="text-sm font-normal">ha</span> } @else { <span class="text-muted-color" title="Powierzchnia nie jest znana dla wszystkich działek">—</span> }</dd>
          </div>
          <div class="rounded-xl p-3" [class]="stats().attention.length ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100' : 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100'">
            <dt class="text-xs">Wymaga uwagi</dt>
            <dd class="flex items-center gap-2 text-2xl font-semibold">
              <i class="pi text-lg" [class]="stats().attention.length ? 'pi-exclamation-triangle' : 'pi-check-circle'" aria-hidden="true"></i>{{stats().attention.length}}</dd>
          </div>
        </dl>
      }

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
    </section>
  `,
})
export class FarmSummary {
  readonly stats = input.required<FarmStats>();
  readonly download = output<void>();
  protected readonly open = signal(false);
}
