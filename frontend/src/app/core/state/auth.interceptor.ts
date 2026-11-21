import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from './auth.store';

/** Ścieżki, w których 401 oznacza zły login/hasło, a nie wygasłą sesję. */
const CREDENTIAL_CALLS = ['/api/auth/login', '/api/me/password', '/api/auth/register'];

/** Gdy serwer odpowie 401 na żądanie wymagające sesji, aplikacja wraca do stanu „gość”. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const injector = inject(Injector);
  return next(request).pipe(catchError((error: unknown) => {
    const isSessionLoss = error instanceof HttpErrorResponse && error.status === 401
      && request.url.startsWith('/api/') && request.url !== '/api/me' && !CREDENTIAL_CALLS.includes(request.url);
    if (isSessionLoss) injector.get(AuthStore).expire();
    return throwError(() => error);
  }));
};
