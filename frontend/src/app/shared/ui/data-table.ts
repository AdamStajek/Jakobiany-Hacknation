import { Component, input } from '@angular/core';

/** Alternatywa tekstowa dla wykresu: dane w tabeli pod rozwijanym nagłówkiem. */
@Component({
  selector: 'app-data-table',
  template: `
    <details class="mt-2 text-sm">
      <summary class="cursor-pointer text-primary">Pokaż dane wykresu</summary>
      <div class="mt-2 max-h-64 overflow-auto">
        <table class="w-full text-left text-xs">
          <caption class="sr-only">{{caption()}}</caption>
          <thead><tr>@for (c of columns(); track c) { <th scope="col" class="border-b border-surface px-2 py-1 font-semibold">{{c}}</th> }</tr></thead>
          <tbody>
            @for (row of rows(); track $index) {
              <tr>@for (cell of row; track $index) { <td class="border-b border-surface px-2 py-1 tabular-nums">{{cell}}</td> }</tr>
            }
          </tbody>
        </table>
      </div>
    </details>
  `,
})
export class DataTable {
  readonly caption = input.required<string>();
  readonly columns = input.required<string[]>();
  readonly rows = input.required<(string | number)[][]>();
}
