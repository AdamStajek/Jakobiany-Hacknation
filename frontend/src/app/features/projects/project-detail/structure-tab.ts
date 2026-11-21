import { Component, computed, input } from '@angular/core';
import { TreeModule } from 'primeng/tree';
import { Procedure } from '../../../core/api/types';
import { DataState } from '../../../shared';
import { EvidenceIds } from './evidence-ids';
import { buildStructure } from './structure-tree';

@Component({
  selector: 'app-structure-tab',
  imports: [TreeModule, DataState, EvidenceIds],
  template: `
    <app-data-state [empty]="!nodes().length" emptyText="Brak postępowań powiązanych z tym projektem.">
      <p-tree [value]="nodes()" styleClass="w-full">
        <ng-template let-n pTemplate="default">
          <span class="inline-flex flex-wrap items-center gap-2">
            <span class="text-xs uppercase text-muted-color">{{ n.data.kind }}</span>
            <span class="font-semibold">{{ n.label }}</span>
            @if (n.data.detail) { <span class="text-sm text-muted-color">{{ n.data.detail }}</span> }
            <app-evidence-ids [ids]="n.data.evidenceIds" />
          </span>
        </ng-template>
      </p-tree>
    </app-data-state>
  `,
})
export class StructureTab {
  readonly procedures = input.required<Procedure[]>();
  protected readonly nodes = computed(() => buildStructure(this.procedures()));
}
