import { Injectable, computed, effect, signal } from '@angular/core';
import { environment } from './environment';
import { Action, PERMISSIONS, ROLES, Role } from './permissions';

function readRole(): Role {
  try {
    const r = localStorage.getItem('role');
    if (r === 'analyst' || r === 'expert' || r === 'operator') return r;
  } catch { /* brak storage */ }
  return 'analyst';
}

function readAccessToken(): string {
  try { return sessionStorage.getItem('risk-miner-access') ?? ''; } catch { return ''; }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly role = signal<Role>(readRole());
  readonly accessToken = signal(readAccessToken());
  readonly token = computed(() => this.accessToken() || environment.roleTokens[this.role()]);
  readonly home = computed(() => ROLES.find((r) => r.value === this.role())!.home);

  constructor() {
    effect(() => {
      try { localStorage.setItem('role', this.role()); } catch { /* ignoruj */ }
    });
  }

  can(action: Action): boolean {
    return PERMISSIONS[action].includes(this.role());
  }

  setAccessToken(token: string): void {
    this.accessToken.set(token.trim());
    try {
      if (this.accessToken()) sessionStorage.setItem('risk-miner-access', this.accessToken());
      else sessionStorage.removeItem('risk-miner-access');
    } catch { /* brak storage */ }
  }
}
