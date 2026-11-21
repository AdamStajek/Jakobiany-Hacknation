import { Component, input } from '@angular/core';
import { TimelineModule } from 'primeng/timeline';
import { ProjectDetail } from '../../../core/api/types';
import { MILESTONE_KIND } from '../../../core/labels';
import { DataState } from '../../../shared';
import { EvidenceIds } from './evidence-ids';

@Component({
  selector: 'app-timeline-tab',
  imports: [TimelineModule, DataState, EvidenceIds],
  template: `
    <app-data-state [empty]="!events().length" emptyText="Brak zdarzeń o znanej dacie.">
      <p-timeline [value]="events()">
        <ng-template pTemplate="opposite" let-e><span class="font-semibold">{{ e.date }}</span></ng-template>
        <ng-template pTemplate="content" let-e>
          <div class="flex flex-wrap items-center gap-2">{{ label(e.label) }} <app-evidence-ids [ids]="e.evidence_ids" /></div>
        </ng-template>
      </p-timeline>
    </app-data-state>
  `,
})
export class TimelineTab {
  protected readonly label = (l: string) => MILESTONE_KIND[l] ?? l;
  readonly events = input.required<ProjectDetail['timeline']>();
}
