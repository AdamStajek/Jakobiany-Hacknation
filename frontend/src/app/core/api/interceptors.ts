import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth.service';
import { environment } from '../environment';
import { ApiError, Problem } from './types';

const isApi = (url: string) => url.startsWith(environment.apiBase) || url.startsWith('/api/');

/** Token (zależny od wybranej roli demo) tylko dla własnego API. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (isApi(req.url)) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${inject(AuthService).token()}` } });
  }
  return next(req);
};

/** Mapuje Problem (RFC 7807) i błędy sieci na ApiError. */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((e: unknown) => {
      if (!(e instanceof HttpErrorResponse)) return throwError(() => e);
      return throwError(() => toApiError(e));
    }),
  );

export function toApiError(e: HttpErrorResponse): ApiError {
  if (e.status === 0) {
    return { status: 0, code: 'network', detail: 'Brak połączenia z serwerem.', fieldErrors: [], network: true };
  }
  const p = (e.error ?? {}) as Partial<Problem> & { current_revision?: number };
  return {
    status: e.status,
    code: p.code ?? `http_${e.status}`,
    detail: p.message ?? e.statusText ?? 'Nieoczekiwany błąd.',
    fieldErrors: p.details ?? [],
    currentRevision: p.current_revision,
  };
}
