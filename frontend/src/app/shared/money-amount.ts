import { CurrencyPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Amount } from '../core/api/types';

export const AMOUNT_KIND: Record<Amount['kind'], string> = {
  project_value: 'Wartość projektu', financing: 'Dofinansowanie', procurement_estimate: 'Szacunek zamówienia',
  buyer_budget: 'Budżet zamawiającego', offer: 'Oferta', contract_initial: 'Umowa (pierwotna)',
  contract_change: 'Zmiana umowy', contract_revised: 'Umowa (po zmianach)', final_payment: 'Płatność końcowa',
};
const VAT = { net: 'netto', gross: 'brutto', unknown: 'VAT nieustalony' };

/** Kwota z rodzajem, walutą i oznaczeniem VAT. */
@Component({
  selector: 'app-money-amount',
  imports: [CurrencyPipe],
  template: `
    <span class="whitespace-nowrap">
      <span class="font-semibold">{{ amount().value | currency: amount().currency : 'symbol' : '1.2-2' }}</span>
      <span class="text-muted-color text-sm"> {{ vat() }}</span>
    </span>
    @if (showKind()) { <div class="text-xs text-muted-color">{{ kindLabel() }}</div> }
  `,
})
export class MoneyAmount {
  readonly amount = input.required<Amount>();
  readonly showKind = input(true);
  protected readonly vat = computed(() => VAT[this.amount().vat]);
  protected readonly kindLabel = computed(() => AMOUNT_KIND[this.amount().kind]);
}
