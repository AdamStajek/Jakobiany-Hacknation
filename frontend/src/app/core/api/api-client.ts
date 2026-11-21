import { HttpClient, HttpContext, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environment';
import { Page, Query } from './types';

export function toParams(q?: Query): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(q ?? {})) {
    if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
  }
  return p;
}

export interface PageQuery extends Query { limit?: number; offset?: number; }

/** Bazowy klient: dokłada /api/v1, buduje query. Wywołania zwracają Observable. */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private url(path: string) { return environment.apiBase + path; }

  get<T>(path: string, query?: Query, context?: HttpContext): Observable<T> {
    return this.http.get<T>(this.url(path), { params: toParams(query), context });
  }
  page<T>(path: string, query?: PageQuery): Observable<Page<T>> {
    return this.get<Page<T>>(path, query);
  }
  post<T>(path: string, body: unknown, headers?: Record<string, string>, context?: HttpContext): Observable<T> {
    return this.http.post<T>(this.url(path), body, { headers: new HttpHeaders(headers ?? {}), context });
  }
  put<T>(path: string, body: unknown, context?: HttpContext): Observable<T> {
    return this.http.put<T>(this.url(path), body, { context });
  }
  /** POST zwracający 202: pełna odpowiedź, by odczytać nagłówek Location. */
  postAccepted<T>(path: string, body: unknown, idempotencyKey?: string, context?: HttpContext): Observable<HttpResponse<T>> {
    const headers = idempotencyKey ? new HttpHeaders({ 'Idempotency-Key': idempotencyKey }) : undefined;
    return this.http.post<T>(this.url(path), body, { observe: 'response', headers, context });
  }
  blob(path: string, query?: Query, context?: HttpContext): Observable<HttpResponse<Blob>> {
    return this.http.get(this.url(path), { params: toParams(query), observe: 'response', responseType: 'blob', context });
  }
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
