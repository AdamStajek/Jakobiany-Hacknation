import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { errorMessage } from '../api/errors';
import { RecommendationCatalog } from '../api/types';

@Injectable({providedIn: 'root'})
export class RecommendationCatalogStore {
  private readonly api = inject(ApiService);
  readonly data = signal<RecommendationCatalog | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  async load() {
    if (this.data() || this.loading()) return;
    this.error.set('');
    this.loading.set(true);
    try {
      this.data.set(await this.api.recommendationCatalog());
    } catch (error) {
      this.error.set(errorMessage(error, 'Nie udało się wczytać katalogu działań.'));
    } finally {
      this.loading.set(false);
    }
  }
}
