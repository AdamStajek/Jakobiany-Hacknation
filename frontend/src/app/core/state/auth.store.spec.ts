import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ApiService } from '../api/api.service';
import type { User } from '../api/types';
import { AuthStore } from './auth.store';

const user: User = {id: 'u1', email: 'ala@example.pl', username: 'ala', email_verified: true, role: 'user'};

function setup(api: Partial<Record<keyof ApiService, unknown>>) {
  TestBed.configureTestingModule({providers: [{provide: ApiService, useValue: api}]});
  return TestBed.inject(AuthStore);
}

describe('AuthStore', () => {
  it('zaczyna w stanie „loading”', () => {
    expect(setup({}).status()).toBe('loading');
  });

  it('zalogowany: GET /api/me ustawia użytkownika', async () => {
    const store = setup({me: async () => user});
    await store.init();
    expect(store.status()).toBe('user');
    expect(store.user()).toEqual(user);
    expect(store.loggedIn()).toBe(true);
  });

  it('401 oznacza gościa bez komunikatu o błędzie', async () => {
    const store = setup({me: async () => { throw new HttpErrorResponse({status: 401}); }});
    await store.init();
    expect(store.status()).toBe('guest');
    expect(store.user()).toBeNull();
    expect(store.error()).toBe('');
  });

  it('inny błąd (serwer niedostępny) też daje gościa, ale z komunikatem', async () => {
    const store = setup({me: async () => { throw new HttpErrorResponse({status: 0}); }});
    await store.init();
    expect(store.status()).toBe('guest');
    expect(store.error()).not.toBe('');
  });

  it('init sprawdza sesję tylko raz', async () => {
    const me = vi.fn(async () => user);
    const store = setup({me});
    await Promise.all([store.init(), store.init()]);
    await store.init();
    expect(me).toHaveBeenCalledTimes(1);
  });

  it('logowanie odczytuje sesję, wylogowanie i expire wracają do gościa', async () => {
    const login = vi.fn(async () => ({}));
    const store = setup({login, me: async () => user, logout: async () => ({})});
    await store.login({identifier: 'ala', password: 'x'});
    expect(login).toHaveBeenCalledWith({identifier: 'ala', password: 'x'});
    expect(store.loggedIn()).toBe(true);
    await store.logout();
    expect(store.status()).toBe('guest');
    store.user.set(user);
    store.expire();
    expect(store.user()).toBeNull();
  });

  it('błędne logowanie przepuszcza błąd i nie zmienia stanu', async () => {
    const store = setup({login: async () => { throw new HttpErrorResponse({status: 401}); }});
    await expect(store.login({identifier: 'a', password: 'b'})).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(store.loggedIn()).toBe(false);
  });

  it('wylogowanie czyści sesję także gdy serwer nie odpowie', async () => {
    const store = setup({logout: async () => { throw new HttpErrorResponse({status: 0}); }});
    store.user.set(user);
    await expect(store.logout()).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(store.user()).toBeNull();
  });

  it('usunięcie konta kończy sesję', async () => {
    const store = setup({deleteAccount: async () => ({})});
    store.user.set(user);
    await store.deleteAccount();
    expect(store.status()).toBe('guest');
  });
});
