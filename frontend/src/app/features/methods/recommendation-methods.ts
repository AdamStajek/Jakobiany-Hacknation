import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RecommendationAction } from '../../core/api/types';
import { RecommendationCatalogStore } from '../../core/state/recommendation-catalog.store';

@Component({
  selector: 'app-recommendation-methods',
  imports: [DecimalPipe],
  templateUrl: './recommendation-methods.html',
})
export class RecommendationMethods {
  protected readonly store = inject(RecommendationCatalogStore);
  protected readonly locations = [
    {key: 'field', label: 'Całe pole'},
    {key: 'point', label: 'Miejsce zaznaczone na mapie'},
  ] as const;
  protected readonly groups = computed(() => {
    const groups = new Map<string, RecommendationAction[]>();
    for (const action of this.store.data()?.actions ?? []) {
      const group = groups.get(action.group) ?? [];
      group.push(action);
      groups.set(action.group, group);
    }
    return Array.from(groups);
  });

  constructor() {
    void this.store.load();
  }
}
