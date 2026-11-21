export type Geometry = {type: 'Polygon' | 'MultiPolygon'; coordinates: unknown[]};

export type Parcel = {
  id: string;
  source: string;
  commune: string | null;
  region: string | null;
  area_ha: number;
  /** false: obiekt za duży/mały na analizę; `warning` mówi użytkownikowi, co zrobić. */
  analyzable?: boolean;
  warning?: string | null;
  centroid: [number, number];
  geometry: Geometry;
};
export type Season = {year: number; balance_mm: number; rain_mm: number; et0_mm: number};
export type Recent = {
  start: string; end: string; rain_mm: number; et0_mm: number; etc_mm: number; crop_balance_mm: number;
  dry_spell_days: number; mean_temp_c: number | null; rain_anomaly_mm?: number; balance_anomaly_mm?: number;
  samples: number; days: number;
};
export type Scene = {date: string; ndvi: number; ndmi: number; ndwi: number; clear_share: number; pixels: number; crop_stage?: string};
export type Source = {
  key: string; name: string; url: string; kind: string; resolution: string; coverage?: string[];
  retrieved_at: string; publication_date: string | null; cached: boolean; attribution?: string;
  scene?: Scene; history?: Scene[]; classes?: {class: string; percent: number}[];
  layers?: ([number, number] | null)[]; layer_depths?: string[];
  elevation_m?: number; slope_pct?: number | null; relief_m?: number | null;
  nearest_water_m?: number | null; nearest_water_point?: [number, number] | null; search_m?: number;
  station?: string; river?: string; distance_km?: number; gauge_cm?: number;
  observations?: {label: string; value: number; date: string}[];
};
export type Recommendation = {
  group: string; title: string; action: string; why: string; evidence: string; when: string; confidence: string; limits: string;
};
export type Report = {
  parcel: Parcel; date: string; analysis_id: string; elapsed_ms: number; confidence: string; agricultural: boolean;
  daily: {rain_mm: number | null; et0_mm: number | null; temp_c: number | null};
  sources: Source[]; missing: Record<string, string>; recommendations: Recommendation[];
  scenario: {input_mm: number; depletion_reduction_mm: [number, number]; note: string} | null;
  metrics: {
    risk: string; kc: number; stage: string; crop: {label: string; root_m: number};
    weather_last_day: string | null; recent: Recent | null;
    root: {taw_mm: number; raw_mm: number; days: number; initially_wet: {depletion_mm: number}; initially_dry: {depletion_mm: number}} | null;
    history: {seasons: Season[]; negative_seasons: number; riskiest_months: string[]; matched_years: number;
      matched_balance_mm: number | null; matched_rain_mm: number | null; median_season_mm: number | null};
    satellite_comparison?: {ndvi_delta: number; ndmi_delta: number; n: number; interpretation: string};
  };
};
export type AnalysisRequest = {
  parcel_id?: string; geojson?: object; crop: string; date: string; stage: number | null; sowing: string | null;
  irrigation: boolean; irrigation_mm: number; scenario_mm: number; confirm_land: boolean;
  soil_observation: 'dry' | 'moist' | 'wet' | null;
};
export type Health = {status: string; analysis_date_min: string; analysis_date_max: string};
export type Crop = {id: string; label: string};
export type AnalysisProgress = {done: number; total: number; label: string};
export type AnalysisEvent =
  | ({type: 'progress'} & AnalysisProgress)
  | {type: 'result'; report: Report}
  | {type: 'error'; status: number; detail: string};

/** Konto zalogowanego użytkownika (GET /api/me). */
export type User = {id: string; email: string; username: string; email_verified: boolean; role: string};
export type RegisterRequest = {email: string; username: string; password: string};
export type LoginRequest = {identifier: string; password: string};
export type PasswordChange = {current: string; new: string};
export type NotificationPrefs = {email_enabled: boolean; email?: string; email_verified?: boolean};

/** Skrót ostatniego raportu pola zapisany na serwerze (same sygnały z analizy). */
export type ServerLastReport = {saved_at: string; risk: string; dry_spell_days: number | null; crop_balance_mm: number | null};
/** Treść PUT last-report: serwer sam ustawia `saved_at`, a liczby są wymagane. */
export type LastReportInput = {risk: string; dry_spell_days: number; crop_balance_mm: number};
export type ServerField = {
  id: string; name: string; color: string; crop: string | null;
  parcels: {id: string; geometry: Geometry}[];
  last_report?: ServerLastReport | null;
};
export type ServerFieldInput = {name: string; color: string; crop: string | null; parcels: {id: string; geometry: Geometry}[]};
