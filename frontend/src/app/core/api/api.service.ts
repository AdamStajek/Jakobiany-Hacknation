import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AnalysisEvent, AnalysisProgress, AnalysisRequest, Crop, Health, Parcel, Report } from './types';

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
  report(analysisId: string) { return firstValueFrom(this.http.get<Report>(`/api/analysis/${encodeURIComponent(analysisId)}`)); }
  analyze(request: AnalysisRequest) { return firstValueFrom(this.http.post<Report>('/api/analysis', request)); }

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
