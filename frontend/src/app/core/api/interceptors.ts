import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { AuthService } from '../auth.service';
import { ErrorNotifier } from '../error-notifier.service';
import { environment } from '../environment';
import { ERROR_SCOPE, isContentError, isInfraError } from './error-policy';
import { ApiError, Problem } from './types';

const isApi = (url: string) => url.startsWith(environment.apiBase) || url.startsWith('/api/');

/** Token (zależny od wybranej roli demo) tylko dla własnego API. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (isApi(req.url)) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${inject(AuthService).token()}` } });
  }
  return next(req);
};

/**
 * Globalne uzupełnienie obsługi błędów (nie zmienia błędu przekazywanego widokowi).
 * Stoi przed `errorInterceptor`, więc widzi już zmapowany `ApiError`.
 */
export const notifyInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApi(req.url)) return next(req);
  const notifier = inject(ErrorNotifier);
  const scope = req.context.get(ERROR_SCOPE);
  return next(req).pipe(
    tap({ next: (ev) => { if (ev.type !== 0) notifier.markOnline(); } }),
    catchError((e: ApiError) => {
      const known = typeof e === 'object' && e !== null && 'status' in e;
      if (known && scope !== 'none' && (isInfraError(e) || (scope === 'all' && isContentError(e)))) notifier.report(e);
      return throwError(() => e);
    }),
  );
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
