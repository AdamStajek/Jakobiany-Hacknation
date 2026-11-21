import { Component, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { StatusMeta } from '../../../core/labels';

/** Tag z gotowego StatusMeta (dla map etykiet spoza STATUS_MAPS). */
@Component({
  selector: 'app-status-tag',
  imports: [TagModule],
  template: `<p-tag [value]="meta().label" [icon]="meta().icon" [severity]="meta().tone" />`,
})
export class StatusTag { readonly meta = input.required<StatusMeta>(); }
