import { Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';

@Component({
  selector: 'app-confidence-chip',
  imports: [Tag],
  template: `<p-tag [value]="'Pewność: ' + level()" [severity]="severity()" />`,
})
export class ConfidenceChip {
  readonly level = input.required<string>();
  protected readonly severity = computed(() => {
    const value = this.level().toLowerCase();
    return value.startsWith('wys') ? 'success' : value.startsWith('umi') || value.startsWith('śr') ? 'warn' : 'danger';
  });
}
