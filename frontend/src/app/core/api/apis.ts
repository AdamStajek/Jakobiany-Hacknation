import { HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient, PageQuery } from './api-client';
import {
  Assessment, AssessmentInput, Decision, DecisionInput, DocumentVersion, Evidence, Fact, Job, Page, Project,
  ProjectDetail, ProjectInput, ReviewItem, Risk, Schemas, SectorRules, SectorRulesInput, Twin, InformationCheck,
} from './types';

/** Odpowiedź 202: adres zadania z nagłówka Location. */
export interface Accepted { location: string; job: Job; }
const toAccepted = map((r: HttpResponse<Job>): Accepted => ({
  location: r.headers.get('Location') ?? `/jobs/${r.body?.id}`,
  job: r.body as Job,
}));

@Injectable({ providedIn: 'root' })
export class ProjectsApi {
  private readonly api = inject(ApiClient);
  list(q: PageQuery) { return this.api.page<Project>('/projects', q); }
  get(id: string) { return this.api.get<ProjectDetail>(`/projects/${id}`); }
  create(body: ProjectInput) { return this.api.post<Project>('/projects', body); }
  update(id: string, project: ProjectInput, expectedRevision: number) {
    return this.api.put<Project>(`/projects/${id}`, { expected_revision: expectedRevision, project });
  }
  enrich(id: string, key?: string, references: Schemas['ExternalId'][] = []) {
    return this.api.postAccepted<Job>(`/projects/${encodeURIComponent(id)}/enrich`, { references }, key).pipe(toAccepted);
  }
  uploadDocument(id: string, file: File, opts: { documentId?: string; documentType?: string } = {}, key?: string) {
    const fd = new FormData();
    fd.append('file', file);
    if (opts.documentId) fd.append('document_id', opts.documentId);
    if (opts.documentType) fd.append('document_type', opts.documentType);
    return this.api.postAccepted<Job>(`/projects/${id}/documents`, fd, key).pipe(toAccepted);
  }
  risks(id: string, q: PageQuery) { return this.api.page<Risk>(`/projects/${id}/risks`, q); }
  facts(id: string, q: PageQuery) { return this.api.page<Fact>(`/projects/${id}/evidence`, q); }
  export(id: string, format: 'json' | 'csv') { return this.api.blob(`/projects/${id}/export`, { format }); }
}

@Injectable({ providedIn: 'root' })
export class ImportsApi {
  private readonly api = inject(ApiClient);
  create(file: File, key?: string) {
    const fd = new FormData();
    fd.append('file', file);
    return this.api.postAccepted<Job>('/imports', fd, key).pipe(toAccepted);
  }
}

@Injectable({ providedIn: 'root' })
export class JobsApi {
  private readonly api = inject(ApiClient);
  /** `location` to ścieżka względem /api/v1 (np. /jobs/j1) lub pełny adres z nagłówka. */
  get(location: string): Observable<Job> {
    const path = location.replace(/^.*\/api\/v1/, '');
    return this.api.get<Job>(path.startsWith('/') ? path : `/jobs/${path}`);
  }
}

@Injectable({ providedIn: 'root' })
export class EvidenceApi {
  private readonly api = inject(ApiClient);
  get(id: string) { return this.api.get<Evidence>(`/evidence/${id}`); }
  documentVersion(documentId: string, versionId: string) {
    return this.api.get<DocumentVersion>(`/documents/${documentId}/versions/${versionId}`);
  }
  /** Kopia dokumentu wymaga tokena, więc pobieramy blob (fetch), a nie otwieramy linku. */
  documentContent(documentId: string, versionId: string) {
    return this.api.blob(`/documents/${documentId}/versions/${versionId}/content`);
  }
}

@Injectable({ providedIn: 'root' })
export class ExpertApi {
  private readonly api = inject(ApiClient);
  reviews(q: PageQuery) { return this.api.page<ReviewItem>('/expert/reviews', q); }
  decide(body: DecisionInput, key?: string) { return this.api.post<Decision>('/expert/decisions', body, key ? { 'Idempotency-Key': key } : undefined); }
  decisions(q: { target_type: string; target_id: string } & PageQuery) {
    return this.api.page<Decision>('/expert/decisions', q);
  }
  createRecord(body: unknown) { return this.api.post<ReviewItem>('/expert/records', body); }
}

@Injectable({ providedIn: 'root' })
export class RulesApi {
  private readonly api = inject(ApiClient);
  list(q: PageQuery = {}) { return this.api.get<SectorRules[]>('/sector-rules', q); }
  propose(body: SectorRulesInput) { return this.api.post<SectorRules>('/sector-rules', body); }
}

@Injectable({ providedIn: 'root' })
export class AssessmentsApi {
  private readonly api = inject(ApiClient);
  list(q: PageQuery) { return this.api.page<Assessment>('/assessments', q); }
  get(id: string) { return this.api.get<Assessment>(`/assessments/${id}`); }
  create(body: AssessmentInput, key?: string) { return this.api.postAccepted<Job>('/assessments', body, key).pipe(toAccepted); }
  twins(id: string) { return this.api.get<Twin[]>(`/assessments/${id}/twins`); }
  gaps(id: string, q: PageQuery = {}) { return this.api.get<InformationCheck[]>(`/assessments/${id}/gaps`, q); }
  export(id: string, format: 'json' | 'csv') { return this.api.blob(`/assessments/${id}/export`, { format }); }
}
