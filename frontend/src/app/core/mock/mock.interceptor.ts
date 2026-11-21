import { HttpHeaders, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of, delay, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../environment';
import { DETAIL_EXTRAS, EVIDENCE, FACTS, JOBS, PROJECTS, RISKS } from './fixtures/projects';
import { EVIDENCE_EXTRA, DOCUMENT_VERSIONS, DOCUMENT_COPY } from './fixtures/evidence';
import { SECTOR_RULES } from './fixtures/sector-rules';

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
    return p ? ok({ procedures: [], documents: [], links: [], timeline: [], amounts: [], milestones: [], ...p, ...DETAIL_EXTRAS[p.id] }) : notFound(req.url);
  }
  if (m === 'GET' && (r = path.match(/^\/projects\/([^/]+)\/(risks|evidence)$/))) {
    const items = (r[2] === 'risks' ? RISKS : FACTS)[r[1]] ?? [];
    return PROJECTS.some((x) => x.id === r![1]) ? ok(page(items, url)) : notFound(req.url);
  }
  if (m === 'GET' && (r = path.match(/^\/projects\/([^/]+)\/export$/))) {
    const p = PROJECTS.find((x) => x.id === r![1]);
    if (!p) return notFound(req.url);
    const fmt = url.searchParams.get('format') === 'csv' ? 'csv' : 'json';
    const body = fmt === 'csv' ? `record_type,record_id,data_json\nproject,${p.id},"${JSON.stringify(p).replace(/"/g, '""')}"\n`
      : JSON.stringify({ project: p, risks: RISKS[p.id] ?? [], facts: FACTS[p.id] ?? [] }, null, 2);
    return of(new HttpResponse({
      status: 200, body: new Blob([body], { type: fmt === 'csv' ? 'text/csv' : 'application/json' }),
      headers: new HttpHeaders({ 'Content-Disposition': `attachment; filename="risk-miner-project.${fmt}"` }),
    })).pipe(delay(200));
  }
  if (m === 'GET' && (r = path.match(/^\/jobs\/([^/]+)$/))) {
    const j = JOBS[r[1]] ?? JOBS['job-partial'];
    return j ? ok(j) : notFound(req.url);
  }
  if (m === 'GET' && (r = path.match(/^\/evidence\/([^/]+)$/))) {
    const ev = EVIDENCE[r[1]] ?? EVIDENCE_EXTRA[r[1]];
    return ev ? ok(ev) : notFound(req.url);
  }
  if (m === 'GET' && (r = path.match(/^\/documents\/([^/]+)\/versions\/([^/]+)(\/content)?$/))) {
    const v = DOCUMENT_VERSIONS[`${r[1]}/${r[2]}`];
    if (!v) return notFound(req.url);
    if (!r[3]) return ok(v);
    return v.content_url ? of(new HttpResponse({ status: 200, body: new Blob([DOCUMENT_COPY], { type: 'application/pdf' }) })).pipe(delay(200)) : notFound(req.url);
  }
  if (m === 'POST' && (path === '/imports' || /\/enrich$/.test(path))) {
    return of(new HttpResponse({ status: 202, body: JOBS['job-partial'], headers: new HttpHeaders({ Location: '/api/v1/jobs/job-partial' }) })).pipe(delay(300));
  }
  if (path === '/sector-rules') {
    if (m === 'GET') {
      const withProposals = url.searchParams.get('include_proposals') === 'true';
      return ok(SECTOR_RULES.filter((x) => withProposals || x.review_status !== 'proposed'));
    }
    if (m === 'POST') {
      const body = req.body as { based_on_id?: string };
      const current = SECTOR_RULES.find((x) => x.review_status === 'approved');
      if (body.based_on_id !== current?.id) {
        return throwError(() => new HttpErrorResponse({
          status: 409, url: req.url, error: { code: 'stale_sector_rules', message: 'Wskaż aktualną wersję bazową wiedzy sektorowej.' },
        }));
      }
      const created = { ...body, id: `water_and_sewerage_v${SECTOR_RULES.length + 1}`, revision: 1, review_status: 'proposed' };
      SECTOR_RULES.push(created);
      return ok(created, 201);
    }
  }
  return next(req);
};
