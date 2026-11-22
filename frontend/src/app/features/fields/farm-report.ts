import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import type { FarmStats } from './farm-stats';

/** Raport o wszystkich polach, widoczny tylko w druku / zapisie do PDF (reszta ekranu ma `print:hidden`). */
@Component({
  selector: 'app-farm-report',
  imports: [DatePipe, DecimalPipe],
  host: {class: 'hidden print:block'},
  template: `
    <article class="p-6 text-sm text-black" aria-label="Raport o moich polach">
      <h1 class="text-2xl font-bold">Raport o moich polach</h1>
      <p class="mb-4">Stan na {{generatedAt() | date:'d MMMM yyyy'}}</p>

      <h2 class="mt-4 text-lg font-semibold">Podsumowanie</h2>
      <ul class="list-disc pl-5">
        <li>Pola: {{stats().fields}}, działki: {{stats().parcels}}@if (stats().totalAreaHa !== null) {, łączna powierzchnia: {{stats().totalAreaHa | number:'1.0-2'}} ha}</li>
        <li>Wymaga uwagi: {{stats().attention.length}} z {{stats().fields}} pól</li>
        @if (stats().withoutReport.length) { <li>Bez raportu: {{stats().withoutReport.join(', ')}}</li> }
        @if (stats().stale.length) { <li>Nieaktualny raport: {{stats().stale.join(', ')}}</li> }
        @for (crop of stats().crops; track crop.key) {
          <li>{{crop.label}}: {{crop.fields}} pól@if (crop.areaHa !== null) {, {{crop.areaHa | number:'1.0-2'}} ha}</li>
        }
      </ul>

      <h2 class="mt-4 text-lg font-semibold">Pola</h2>
      <table class="w-full border-collapse text-left">
        <caption class="sr-only">Pola, uprawy, powierzchnia, status i data raportu</caption>
        <thead>
          <tr class="border-b border-black">
            <th scope="col" class="py-1 pr-2">Pole</th><th scope="col" class="pr-2">Uprawa</th><th scope="col" class="pr-2">Powierzchnia</th>
            <th scope="col" class="pr-2">Działki</th><th scope="col" class="pr-2">Status</th><th scope="col" class="pr-2">Powody uwagi</th><th scope="col">Raport z</th>
          </tr>
        </thead>
        <tbody>
          @for (row of stats().rows; track row.id) {
            <tr class="break-inside-avoid border-b border-black/30 align-top">
              <th scope="row" class="py-1 pr-2 font-semibold">{{row.name}}</th>
              <td class="pr-2">{{row.cropLabel}}</td>
              <td class="pr-2">@if (row.areaHa !== null) { {{row.areaHa | number:'1.0-2'}} ha } @else { brak danych }</td>
              <td class="pr-2">{{row.parcels}}</td>
              <td class="pr-2">{{row.risk ?? 'Brak raportu'}}@if (row.stale) { (nieaktualny) }</td>
              <td class="pr-2">{{row.reasons.length ? row.reasons.join('; ') : '—'}}</td>
              <td>@if (row.reportDate) { {{row.reportDate | date:'d MMM yyyy'}} } @else { — }</td>
            </tr>
          }
        </tbody>
      </table>
      <p class="mt-4 text-xs">Status i powody pochodzą z ostatnich zapisanych raportów. To wskazówki, nie wyrok.</p>
    </article>
  `,
})
export class FarmReport {
  readonly stats = input.required<FarmStats>();
  readonly generatedAt = input.required<Date>();
}
