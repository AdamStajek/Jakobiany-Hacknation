import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { RiskCategory } from '../rules.types';

/** Katalog ryzyk (R01–R15 i własne kategorie): kod, nazwa, opis. */
@Component({
  selector: 'app-risk-catalog-editor',
  imports: [FormsModule, ButtonModule, InputTextModule],
  template: `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <caption class="sr-only">Katalog kategorii ryzyka</caption>
        <thead>
          <tr class="text-left text-muted-color">
            <th class="p-2 w-24">Kod</th><th class="p-2 w-1/3">Nazwa</th><th class="p-2">Opis</th>
            @if (!readonly()) { <th class="p-2 w-12"><span class="sr-only">Akcje</span></th> }
          </tr>
        </thead>
        <tbody>
          @for (c of categories(); track $index) {
            <tr class="border-t border-surface">
              <td class="p-2"><input pInputText class="w-full" [ngModel]="c.code" (ngModelChange)="patch($index, { code: $event })" [disabled]="readonly()" [attr.aria-label]="'Kod kategorii ' + ($index + 1)" /></td>
              <td class="p-2"><input pInputText class="w-full" [ngModel]="c.label" (ngModelChange)="patch($index, { label: $event })" [disabled]="readonly()" [attr.aria-label]="'Nazwa kategorii ' + c.code" /></td>
              <td class="p-2"><input pInputText class="w-full" [ngModel]="c.description" (ngModelChange)="patch($index, { description: $event })" [disabled]="readonly()" [attr.aria-label]="'Opis kategorii ' + c.code" /></td>
              @if (!readonly()) {
                <td class="p-2"><p-button icon="pi pi-trash" severity="danger" [text]="true" size="small" [attr.aria-label]="'Usuń kategorię ' + c.code" (onClick)="remove($index)" /></td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
    @if (!readonly()) {
      <p-button class="mt-3 inline-block" label="Dodaj kategorię" icon="pi pi-plus" size="small" severity="secondary" (onClick)="add()" />
    }
  `,
})
export class RiskCatalogEditor {
  readonly categories = model.required<RiskCategory[]>();
  readonly readonly = input(false);

  protected patch(i: number, p: Partial<RiskCategory>) {
    this.categories.update((l) => l.map((c, j) => (j === i ? { ...c, ...p } : c)));
  }
  protected remove(i: number) { this.categories.update((l) => l.filter((_, j) => j !== i)); }
  protected add() {
    this.categories.update((l) => [...l, { code: '', label: '', description: '' }]);
  }
}
