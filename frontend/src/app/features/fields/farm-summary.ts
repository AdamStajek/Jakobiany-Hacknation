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
      <header class="flex items-center gap-2">
        <h2 id="farm-summary-title" class="mr-auto text-base font-semibold">Moje gospodarstwo</h2>
        <button type="button" class="grid h-12 w-12 place-items-center rounded-full hover:bg-surface-100 lg:hidden dark:hover:bg-surface-800"
          [attr.aria-expanded]="open()" aria-controls="farm-summary-body" [attr.aria-label]="open() ? 'Zwiń podsumowanie' : 'Rozwiń podsumowanie'"
          (click)="open.set(!open())">
          <i class="pi" [class]="open() ? 'pi-chevron-up' : 'pi-chevron-down'" aria-hidden="true"></i>
        </button>
      </header>

      <div id="farm-summary-body" class="flex-col gap-3 text-sm lg:flex" [class]="open() ? 'flex' : 'hidden'">
        @if (!stats().fields) {
          <p class="text-muted-color">Dodaj pierwsze pole, a tu zobaczysz, ile masz pól, jakie uprawy i co wymaga uwagi.</p>
        } @else {
          <p>
            <strong>{{stats().fields}}</strong> {{stats().fields === 1 ? 'pole' : 'pól'}},
            <strong>{{stats().parcels}}</strong> {{stats().parcels === 1 ? 'działka' : 'działek'}}@if (stats().totalAreaHa !== null) {,
              razem <strong>{{stats().totalAreaHa | number:'1.0-2'}} ha</strong>} @else {
              <span class="text-muted-color">. Powierzchnia nie jest znana dla wszystkich działek.</span>}
          </p>

          <div>
            <h3 class="font-semibold">Uprawy</h3>
            <ul class="mt-1 flex flex-col gap-1">
              @for (crop of stats().crops; track crop.key) {
                <li>{{crop.label}}: {{crop.fields}} {{crop.fields === 1 ? 'pole' : 'pól'}}@if (crop.areaHa !== null) { · {{crop.areaHa | number:'1.0-2'}} ha}</li>
              }
            </ul>
          </div>

          <div>
            <h3 class="font-semibold">Co wymaga uwagi</h3>
            @if (stats().attention.length) {
              <p class="text-amber-700 dark:text-amber-400">
                <i class="pi pi-exclamation-triangle" aria-hidden="true"></i> {{stats().attention.length}} z {{stats().fields}} pól wymaga uwagi:</p>
              <ul class="mt-1 flex flex-col gap-1">
                @for (item of stats().attention; track item.id) {
                  <li><span class="font-medium">{{item.name}}</span> <span class="text-muted-color">— {{item.reasons.join(', ')}}</span></li>
                }
              </ul>
            } @else {
              <p class="text-muted-color">Nic nie wymaga uwagi według ostatnich raportów.</p>
            }
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

          <p-button label="Pobierz raport o moich polach" icon="pi pi-download" styleClass="min-h-12 w-full sm:w-auto" (onClick)="download.emit()" />
        }
      </div>
    </section>
  `,
})
export class FarmSummary {
  readonly stats = input.required<FarmStats>();
  readonly download = output<void>();
  protected readonly open = signal(true);
}
