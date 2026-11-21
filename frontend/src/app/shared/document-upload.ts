import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectsApi } from '../core/api/apis';
import { ApiError, Job, ProjectDocument, asSource } from '../core/api/types';
import { JobProgress } from './job-progress';

@Component({
  selector: 'app-document-upload',
  imports: [FormsModule, JobProgress],
  template: `
    <form class="panel" (ngSubmit)="upload()">
      <h2>Dokumentacja projektu</h2>
      @if (documents().length) {
        <label for="document-version">Zapisz jako</label>
        <select id="document-version" name="documentId" [(ngModel)]="documentId">
          <option value="">Nowy dokument</option>
          @for (d of documents(); track d.id) { <option [value]="d.id">Nowa wersja · {{ documentName(d) }}</option> }
        </select>
      }
      @if (!documentId) {
        <label for="document-type">Rodzaj dokumentu</label>
        <select id="document-type" name="documentType" [(ngModel)]="documentType">
          <option value="other">Inny dokument</option>
          <option value="PFU">Program funkcjonalno-użytkowy (PFU)</option>
          <option value="SWZ">Specyfikacja warunków zamówienia (SWZ)</option>
          <option value="signed_contract">Podpisana umowa</option>
          <option value="annex">Aneks</option>
          <option value="acceptance_report">Protokół odbioru</option>
        </select>
      }
      <label for="document-file">Plik DOC, DOCX lub PDF z warstwą tekstową</label>
      <input #picker id="document-file" type="file" accept=".doc,.docx,.pdf"
             (change)="file = picker.files?.[0]" />
      <button class="action" [disabled]="!file || busy()">Wgraj i odczytaj dokument</button>
      @if (error()) { <p class="text-red-600" role="alert">{{ error() }}</p> }
      <app-job-progress [location]="location()" (finishedJob)="complete($event); picker.value = ''" (trackingError)="fail($event)" />
    </form>
  `,
})
export class DocumentUpload {
  readonly projectId = input.required<string>();
  readonly documents = input<ProjectDocument[]>([]);
  readonly changed = output<Job>();
  readonly processing = output<boolean>();
  protected readonly busy = signal(false);
  protected readonly location = signal<string | null>(null);
  protected readonly error = signal('');
  protected documentId = '';
  protected documentType = 'other';
  protected file?: File;
  private readonly api = inject(ProjectsApi);

  protected documentName(d: ProjectDocument) {
    return asSource(d.versions.find((v) => v.id === d.current_version_id)?.source)?.name ?? d.id;
  }

  protected upload() {
    if (!this.file || this.busy()) return;
    this.busy.set(true);
    this.processing.emit(true);
    this.error.set('');
    this.location.set(null);
    this.api.uploadDocument(this.projectId(), this.file, { documentId: this.documentId, documentType: this.documentId ? undefined : this.documentType }).subscribe({
      next: (r) => this.location.set(r.location),
      error: (e: ApiError) => this.fail(e.detail),
    });
  }

  protected complete(job: Job) {
    this.file = undefined;
    this.busy.set(false);
    this.processing.emit(false);
    this.changed.emit(job);
  }

  protected fail(message: string) {
    this.error.set(message);
    this.busy.set(false);
    this.processing.emit(false);
  }
}
