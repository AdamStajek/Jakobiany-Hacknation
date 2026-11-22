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
export type ResearchSource = {title: string; url: string};
export type RecommendationPoint = {
  coordinates: [number, number]; type: string; date: string; description: string; evidence: string;
};
export type Recommendation = {
  group: string; title: string; action: string; why: string; evidence: string; when: string; confidence: string; limits: string;
  id?: number; cost?: string; cost_details?: string; scope?: 'field' | 'point'; points?: RecommendationPoint[];
  sources?: ResearchSource[];
  /** Krótki plan działań (3–4 kroki) z katalogu rekomendacji. */
  steps?: string[];
};
export type RecommendationAction = {
  id: number; title: string; group: string; description: string; when: string; conditions: string; cost: string; cost_details: string;
  cost_estimate: {lower: number; upper: number; unit: string; basis: string; sources: ResearchSource[]};
  triggers: Partial<Record<'field' | 'point', string[][]>>; sources: ResearchSource[]; why: string; exclusion: string | null;
};
export type ObservationOption = {key: string; label: string};
export type RecommendationCatalog = {
  actions: RecommendationAction[]; field_observations: ObservationOption[]; point_observations: ObservationOption[];
};
export type ExperimentCheck = {
  slug: string; title: string; reason: string; impact: string;
  options: {value: string; label: string}[];
};
export type FarmerQuestion = {field: string; label: string; question: string; format: string;
  table: string; sql_type: string; source: string; unit: string | null};
export type ProblemZone = {geometry: {type: 'Point'; coordinates: [number, number]}; type: string; date: string; description: string; recommendation_observations?: string[]};
export type Watering = {date: string; dose_mm: number | null};
export type FarmerAnswers = Record<string, string | string[] | ProblemZone[] | Watering[] | null>;
export type Report = {
  farmer_answers?: FarmerAnswers;
  experiments?: ExperimentCheck[];
  experiment_results?: Record<string, string>;
  experiment_conclusions?: Record<string, string>;
  parcel: Parcel; date: string; analysis_id: string; elapsed_ms: number; confidence: string; agricultural: boolean;
  daily: {rain_mm: number | null; et0_mm: number | null; temp_c: number | null};
  sources: Source[]; missing: Record<string, string>; recommendations: Recommendation[];
  scenario: {input_mm: number; depletion_reduction_mm: [number, number]; note: string} | null;
  soil_observation?: 'dry' | 'moist' | 'wet' | null;
  metrics: {
    risk: string; kc: number; stage: string; crop: {label: string; root_m: number};
    weather_last_day: string | null; recent: Recent | null;
    root: {taw_mm: number; raw_mm: number; days: number; input_mm?: number; initially_wet: {depletion_mm: number}; initially_dry: {depletion_mm: number}} | null;
    history: {seasons: Season[]; negative_seasons: number; riskiest_months: string[]; matched_years: number;
      matched_balance_mm: number | null; matched_rain_mm: number | null; median_season_mm: number | null};
    satellite_comparison?: {ndvi_delta: number; ndmi_delta: number; n: number; interpretation: string};
  };
};
export type AnalysisRequest = {
  parcel_id?: string; geojson?: object; crop: string; date: string; stage: number | null; sowing: string | null;
  irrigation: boolean; irrigation_mm: number; scenario_mm: number; confirm_land: boolean;
  soil_observation: 'dry' | 'moist' | 'wet' | null;
  farmer_answers?: FarmerAnswers;
};
export type PassportField = {
  field: string; label: string; source?: string; unit?: string | null;
  status: string; value: unknown; detail?: string | null; provenance?: {source_id?: string};
};
/** Paszport pola z /api/passport; frontend pokazuje z niego tylko krótkie podsumowanie. */
export type Passport = {
  parcel_id: string; analysis_as_of: string; fields: PassportField[];
  farmer_report?: {situation: string; next_check: string | null; steps: Recommendation[]};
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

/** Opis pola własnymi słowami (POST /api/describe-field). */
export type DescribeAttributeKey = 'soil' | 'terrain' | 'problem' | 'constraint';
export type DescribedAttribute = {value: string | null; label: string | null; matched: string | null};
export type DescribeOption = {value: string; label: string};
export type FieldDescription = Record<DescribeAttributeKey, DescribedAttribute> & {
  observation_keys: string[];
  farmer_answers: Record<string, string>;
  options: Record<DescribeAttributeKey, DescribeOption[]>;
  attribute_labels: Record<DescribeAttributeKey, string>;
};
/** Potwierdzone przez rolnika atrybuty opisu pola. */
export type ConfirmedDescription = Record<DescribeAttributeKey, DescribedAttribute> & {
  farmer_answers: Record<string, string>;
  observation_keys: string[];
};

/** Przykładowe powiadomienie demo (GET /api/notifications/demo/{kind}); nic nie jest wysyłane. */
export type DemoNotificationKind = 'rain' | 'residue';
export type DemoNotificationQuery = {field_name?: string; soil?: string; terrain?: string};
export type DemoNotification = {
  demo: true; kind: DemoNotificationKind; sent: false; subject: string; html: string; text: string;
  sections: {happening: string; actions: string[]; why: string};
};
