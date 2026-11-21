import { signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiError, Page } from '../../../core/api/types';

/** Stan ładowania listy (wszystkie strony do limitu) dla zakładek karty projektu. */
export function pagedLoader<T>(fetch: (offset: number) => Observable<Page<T>>) {
  const items = signal<T[]>([]);
  const loading = signal(false);
  const error = signal<ApiError | null>(null);
  const total = signal(0);
  const load = () => {
    loading.set(true);
    error.set(null);
    fetch(0).subscribe({
      next: (p) => { items.set(p.items); total.set(p.total); loading.set(false); },
      error: (e: ApiError) => { error.set(e); loading.set(false); },
    });
  };
  return { items, loading, error, total, load };
}
