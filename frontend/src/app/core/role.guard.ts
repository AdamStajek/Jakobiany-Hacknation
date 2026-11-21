import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthService } from './auth.service';
import { Role } from './permissions';

/** Trasa z `data: { roles: [...] }`; brak uprawnień → strona startowa roli + toast. */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const roles = route.data['roles'] as Role[] | undefined;
  if (!roles || roles.includes(auth.role())) return true;
  inject(MessageService).add({ severity: 'warn', summary: 'Brak dostępu', detail: 'Ten widok nie jest dostępny dla wybranej roli.' });
  return inject(Router).parseUrl(auth.home());
};
