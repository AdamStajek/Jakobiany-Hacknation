import { isDevMode } from '@angular/core';

export const PRIVATE_CACHE = 'pw-private-v1';

/** Rejestruje service workera (instalacja i praca offline); w trybie deweloperskim pomijamy. */
export function registerServiceWorker(): void {
  if (isDevMode() || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => undefined); });
}

/** Po wylogowaniu usuwamy z urządzenia zapamiętane dane pól i konta. */
export async function clearPrivateCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try { await caches.delete(PRIVATE_CACHE); } catch { /* brak dostępu do pamięci podręcznej */ }
}

/** Klucz VAPID (base64url) na bajty wymagane przez `PushManager.subscribe`. */
export function keyToBytes(key: string): Uint8Array<ArrayBuffer> {
  const base64 = key.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(key.length / 4) * 4, '=');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
