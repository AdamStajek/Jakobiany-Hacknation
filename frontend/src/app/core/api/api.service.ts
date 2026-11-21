import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AnalysisEvent, AnalysisProgress, AnalysisRequest, Crop, Health, LoginRequest, NotificationPrefs, Parcel, Passport, PasswordChange, RegisterRequest, Report,
  LastReportInput, ServerField, ServerFieldInput, User,
} from './types';

/** Nagłówek wymagany przez serwer przy żądaniach zmieniających stan (ochrona przed CSRF). */
const STATE_CHANGING = {headers: {'X-Requested-With': 'XMLHttpRequest'}, withCredentials: true};
const READ = {withCredentials: true};

@Injectable({providedIn: 'root'})
export class ApiService {
  private readonly http = inject(HttpClient);

  health() { return firstValueFrom(this.http.get<Health>('/api/health')); }
  crops() { return firstValueFrom(this.http.get<Crop[]>('/api/crops')); }
  searchParcels(query: string) {
    return firstValueFrom(this.http.get<{parcels: Parcel[]}>('/api/parcels/search', {params: {query}}));
  }
  parcelsByPoint(lat: number, lon: number) {
    return firstValueFrom(this.http.get<{parcels: Parcel[]}>('/api/parcels/by-point', {params: {lat, lon}}));
  }
  importParcel(geojson: object) { return firstValueFrom(this.http.post<Parcel>('/api/parcels/import', geojson)); }
  passport(parcelId: string, asOf: string, crop: string) {
    return firstValueFrom(this.http.get<Passport>('/api/passport', {params: {parcel_id: parcelId, as_of: asOf, crop, irrigation_mm: 0}}));
  }
  report(analysisId: string) { return firstValueFrom(this.http.get<Report>(`/api/analysis/${encodeURIComponent(analysisId)}`)); }
  analyze(request: AnalysisRequest) { return firstValueFrom(this.http.post<Report>('/api/analysis', request)); }

  // Konta (ciasteczko sesji HttpOnly, ten sam origin przez proxy).
  me() { return firstValueFrom(this.http.get<User>('/api/me', READ)); }
  register(body: RegisterRequest) { return firstValueFrom(this.http.post<unknown>('/api/auth/register', body, STATE_CHANGING)); }
  verifyEmail(token: string) { return firstValueFrom(this.http.post<unknown>('/api/auth/verify', {token}, STATE_CHANGING)); }
  resendVerification() { return firstValueFrom(this.http.post<unknown>('/api/auth/resend-verification', {}, STATE_CHANGING)); }
  login(body: LoginRequest) { return firstValueFrom(this.http.post<unknown>('/api/auth/login', body, STATE_CHANGING)); }
  logout() { return firstValueFrom(this.http.post<unknown>('/api/auth/logout', {}, STATE_CHANGING)); }
  changePassword(body: PasswordChange) { return firstValueFrom(this.http.post<unknown>('/api/me/password', body, STATE_CHANGING)); }
  deleteAccount() { return firstValueFrom(this.http.delete<unknown>('/api/me', STATE_CHANGING)); }
  forgotPassword(email: string) { return firstValueFrom(this.http.post<unknown>('/api/auth/forgot', {email}, STATE_CHANGING)); }
  resetPassword(token: string, password: string) {
    return firstValueFrom(this.http.post<unknown>('/api/auth/reset', {token, password}, STATE_CHANGING));
  }
  notificationPrefs() { return firstValueFrom(this.http.get<NotificationPrefs>('/api/me/notifications', READ)); }
  setNotificationPrefs(body: {email_enabled: boolean}) {
    return firstValueFrom(this.http.patch<NotificationPrefs>('/api/me/notifications', body, STATE_CHANGING));
  }

  // Pola na serwerze (wymagają sesji).
  serverFields() { return firstValueFrom(this.http.get<ServerField[]>('/api/fields', READ)); }
  createServerField(body: ServerFieldInput) { return firstValueFrom(this.http.post<ServerField>('/api/fields', body, STATE_CHANGING)); }
  updateServerField(id: string, body: Partial<Omit<ServerFieldInput, 'parcels'>>) {
    return firstValueFrom(this.http.patch<ServerField>(`/api/fields/${encodeURIComponent(id)}`, body, STATE_CHANGING));
  }
  deleteServerField(id: string) { return firstValueFrom(this.http.delete<unknown>(`/api/fields/${encodeURIComponent(id)}`, STATE_CHANGING)); }
  putLastReport(id: string, body: LastReportInput) {
    return firstValueFrom(this.http.put<ServerField>(`/api/fields/${encodeURIComponent(id)}/last-report`, body, STATE_CHANGING));
  }

  /**
   * Analiza ze strumieniem postępu przez WebSocket (/api/ws/analysis).
   * Gdy WebSocket jest niedostępny (np. proxy go blokuje), wraca do zwykłego POST bez postępu.
   */
  analyzeWithProgress(request: AnalysisRequest, onProgress: (progress: AnalysisProgress) => void, signal?: AbortSignal): Promise<Report> {
    return new Promise<Report>((resolve, reject) => {
      const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
      let settled = false, opened = false;
      const socket = new WebSocket(`${scheme}://${location.host}/api/ws/analysis`);
      const finish = (action: () => void) => { if (!settled) { settled = true; action(); } };
      signal?.addEventListener('abort', () => {
        finish(() => reject(new DOMException('Anulowano', 'AbortError')));
        socket.close();
      }, {once: true});
      socket.onopen = () => { opened = true; socket.send(JSON.stringify(request)); };
      socket.onmessage = (message) => {
        const event = JSON.parse(message.data as string) as AnalysisEvent;
        if (event.type === 'progress') onProgress(event);
        else if (event.type === 'result') finish(() => resolve(event.report));
        else finish(() => reject(new WsError(event.detail, event.status)));
        if (event.type !== 'progress') socket.close();
      };
      socket.onerror = () => {
        // Nie udało się nawiązać połączenia: zwykłe żądanie HTTP.
        if (!opened) finish(() => this.analyze(request).then(resolve, reject));
      };
      socket.onclose = () => {
        if (opened) finish(() => reject(new WsError('Połączenie z serwerem analizy zostało przerwane. Spróbuj ponownie.', 0)));
      };
    });
  }
}

/** Błąd zgłoszony przez serwer przez WebSocket (status odpowiada kodowi HTTP). */
export class WsError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
