import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AnalysisRequest, Crop, Health, Parcel, Report } from './types';

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
}
