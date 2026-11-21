import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';
import { loginQuery } from './return-url';

/** Strażnik tras dostępnych tylko po zalogowaniu (wyłącznie /konto); gość trafia do logowania z powrotem na to miejsce. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthStore);
  await auth.init();
  if (auth.loggedIn()) return true;
  return inject(Router).createUrlTree(['/zaloguj'], {queryParams: loginQuery(state.url)});
};
