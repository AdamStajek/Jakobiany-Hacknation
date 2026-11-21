import { Injectable, computed, effect, signal } from '@angular/core';
import { Action, PERMISSIONS, ROLES, Role } from './permissions';

function readRole(): Role {
  try {
    const r = localStorage.getItem('role');
    if (r === 'analyst' || r === 'expert' || r === 'operator') return r;
  } catch { /* brak storage */ }
  return 'analyst';
}

/** Tryb demo: rolę wybiera użytkownik. Po dodaniu GET /me podmieniamy tylko źródło `role`. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly role = signal<Role>(readRole());
  readonly home = computed(() => ROLES.find((r) => r.value === this.role())!.home);

  constructor() {
    effect(() => {
      try { localStorage.setItem('role', this.role()); } catch { /* ignoruj */ }
    });
  }

  can(action: Action): boolean {
    return PERMISSIONS[action].includes(this.role());
  }
}
