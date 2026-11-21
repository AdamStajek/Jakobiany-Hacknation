import { Component, computed, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { STATUS_MAPS, StatusMeta } from '../core/labels';

/** Status z ikoną i polską etykietą (nie tylko kolor). */
@Component({
  selector: 'app-status-badge',
  imports: [TagModule],
  template: `<p-tag [value]="meta().label" [icon]="meta().icon" [severity]="meta().tone" />`,
})
export class StatusBadge {
  readonly type = input.required<keyof typeof STATUS_MAPS>();
  readonly value = input.required<string>();
  protected readonly meta = computed<StatusMeta>(() =>
    (STATUS_MAPS[this.type()] as Record<string, StatusMeta>)[this.value()] ??
    { label: this.value(), icon: 'pi pi-question-circle', tone: 'secondary' });
}
