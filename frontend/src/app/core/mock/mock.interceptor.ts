import { HttpHeaders, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of, delay, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../environment';
import { EVIDENCE, JOBS, PROJECTS } from './fixtures/projects';

const page = (items: any[], url: URL) => {
  const limit = Number(url.searchParams.get('limit') ?? 25);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
};

function filterProjects(url: URL) {
  const q = url.searchParams.get('q')?.toLowerCase();
  const norm = (v: string) => v.toLowerCase().replace(/\s+/g, '');
  return PROJECTS.filter((p) =>
    (!q || p.title.toLowerCase().includes(q) || p.id.includes(q) ||
      p.external_ids.some((e: any) => norm(e.value) === norm(q))) &&
    (!url.searchParams.get('kind') || p.kind === url.searchParams.get('kind')) &&
    (!url.searchParams.get('status') || p.status === url.searchParams.get('status')) &&
    (!url.searchParams.get('enrichment_status') || p.enrichment_status === url.searchParams.get('enrichment_status')));
}

const notFound = (url: string) => throwError(() => new HttpErrorResponse({
  status: 404, url, error: { code: 'not_found', message: 'Nie znaleziono zasobu.' },
}));

/** Zwraca fixtures zamiast backendu (environment.useMock). Rozszerzany per widok. */
export const mockInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.useMock || !req.url.startsWith(environment.apiBase)) return next(req);
  const url = new URL(req.url, 'http://mock');
  const path = url.pathname.slice(environment.apiBase.length);
  const ok = (body: unknown, status = 200) => of(new HttpResponse({ status, body })).pipe(delay(200));
  const m = req.method;
  let r: RegExpMatchArray | null;

  if (m === 'GET' && path === '/projects') return ok(page(filterProjects(url), url));
  if (m === 'GET' && (r = path.match(/^\/projects\/([^/]+)$/))) {
    const p = PROJECTS.find((x) => x.id === r![1]);
    return p ? ok({ ...p, procedures: [], documents: [], links: [], timeline: [], amounts: [], milestones: [] }) : notFound(req.url);
  }
  if (m === 'GET' && (r = path.match(/^\/jobs\/([^/]+)$/))) {
    const j = JOBS[r[1]] ?? JOBS['job-partial'];
    return j ? ok(j) : notFound(req.url);
  }
  if (m === 'GET' && (r = path.match(/^\/evidence\/([^/]+)$/))) {
    return EVIDENCE[r[1]] ? ok(EVIDENCE[r[1]]) : notFound(req.url);
  }
  if (m === 'POST' && (path === '/imports' || /\/enrich$/.test(path))) {
    return of(new HttpResponse({ status: 202, body: JOBS['job-partial'], headers: new HttpHeaders({ Location: '/api/v1/jobs/job-partial' }) })).pipe(delay(300));
  }
  return next(req);
};
