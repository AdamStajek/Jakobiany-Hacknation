import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, of, Subscription } from 'rxjs';
import { EvidenceApi } from './api/apis';
import type { ApiError, DocumentVersion, Evidence } from './api/types';
import { EvidenceRef } from './models';

export interface EvidenceState {
  loading: boolean;
  error?: string;
  evidence?: Evidence;
  /** `null` = metadane wersji niedostępne (np. 404); `undefined` = dowód bez dokumentu. */
  version?: DocumentVersion | null;
}

/** Globalny stan panelu Evidence Lens: dowolny widok wywołuje open(ref); `ref.sourceId` to id dowodu. */
@Injectable({ providedIn: 'root' })
export class EvidenceService {
  private readonly api = inject(EvidenceApi);
  readonly current = signal<EvidenceRef | null>(null);
  readonly visible = signal(false);
  readonly state = signal<EvidenceState>({ loading: false });
  readonly contentBusy = signal(false);
  readonly contentError = signal<string | null>(null);
  private sub?: Subscription;
  private blobUrl?: string;

  open(ref: EvidenceRef) {
    this.current.set(ref);
    this.visible.set(true);
    this.contentError.set(null);
    this.load(ref.sourceId);
  }

  close() {
    this.visible.set(false);
    this.sub?.unsubscribe();
  }

  retry() {
    const ref = this.current();
    if (ref) this.load(ref.sourceId);
  }

  private load(id: string) {
    this.sub?.unsubscribe();
    this.state.set({ loading: true });
    this.sub = this.api.get(id).subscribe({
      next: (evidence) => {
        if (evidence.document_id && evidence.document_version_id) {
          this.state.set({ loading: true, evidence });
          this.loadVersion(evidence);
        } else {
          this.state.set({ loading: false, evidence });
        }
      },
      error: (e: unknown) => this.state.set({ loading: false, error: errorMessage(e, 'Nie udało się pobrać dowodu.') }),
    });
  }

  private loadVersion(evidence: Evidence) {
    this.sub = this.api.documentVersion(evidence.document_id!, evidence.document_version_id!)
      .pipe(catchError(() => of(null)))
      .subscribe((version) => this.state.set({ loading: false, evidence, version }));
  }

  /** Pobiera kopię dokumentu z tokenem (blob) i otwiera ją w nowej karcie. */
  openContent() {
    const e = this.state().evidence;
    if (!e?.document_id || !e.document_version_id || this.contentBusy()) return;
    this.contentBusy.set(true);
    this.contentError.set(null);
    this.api.documentContent(e.document_id, e.document_version_id).subscribe({
      next: (res) => {
        if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
        this.blobUrl = URL.createObjectURL(res.body as Blob);
        window.open(this.blobUrl, '_blank', 'noopener');
        this.contentBusy.set(false);
      },
      error: (err: unknown) => {
        this.contentBusy.set(false);
        this.contentError.set(statusOf(err) === 404
          ? 'Brak zachowanej kopii dokumentu.' : errorMessage(err, 'Nie udało się pobrać kopii dokumentu.'));
      },
    });
  }
}

function errorMessage(e: unknown, fallback: string): string {
  const status = statusOf(e);
  if (status === 404) return 'Nie znaleziono dowodu.';
  if (status === 403) return 'Brak uprawnień do tego dowodu.';
  if (status === 0) return 'Brak połączenia z serwerem.';
  return fallback;
}

/** Status z `ApiError` (po `errorInterceptor`) lub surowego `HttpErrorResponse`. */
function statusOf(e: unknown): number | undefined {
  if (e instanceof HttpErrorResponse) return e.status;
  if (typeof e === 'object' && e !== null && 'status' in e) return Number((e as ApiError).status);
  return undefined;
}
