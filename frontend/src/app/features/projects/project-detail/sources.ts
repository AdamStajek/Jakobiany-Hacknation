import { asSource, Evidence, GeoSignal, ProjectDetail, Source } from '../../../core/api/types';
import { GEO_LEVEL, GEO_METRIC, GEO_UNIT, PROVIDER_LABEL } from '../../../core/labels';

export interface SourceItem { text: string; retrievedAt?: string; evidenceIds: string[]; provider?: string; }
export interface SourceGroup {
  key: 'bzp' | 'documents' | 'kpo' | 'teryt' | 'bdl' | 'other';
  title: string;
  description: string;
  items: SourceItem[];
  demo: boolean;
}

const GROUPS: Pick<SourceGroup, 'key' | 'title' | 'description'>[] = [
  { key: 'bzp', title: 'BZP (e-Zamówienia)', description: 'Ogłoszenia i identyfikatory postępowań' },
  { key: 'documents', title: 'Dokumenty zamówień', description: 'Wgrane pliki PDF/DOCX' },
  { key: 'kpo', title: 'Wykaz UE/KPO', description: 'Identyfikatory projektów z wykazu' },
  { key: 'teryt', title: 'TERYT', description: 'Lokalizacja robót (kod regionu)' },
  { key: 'bdl', title: 'GUS BDL', description: 'Wskaźniki geograficzne (geo_signals)' },
  { key: 'other', title: 'Pozostałe źródła', description: 'Arkusz konkursowy, opis użytkownika, dane demonstracyjne' },
];

const src = (s: Source): SourceItem => ({
  text: `${s.name ?? PROVIDER_LABEL[s.provider] ?? s.provider}${s.identifier ? ' · ' + s.identifier : ''}`,
  retrievedAt: s.retrieved_at, evidenceIds: [], provider: s.provider,
});

const geo = (g: GeoSignal): SourceItem => ({
  text: `${GEO_METRIC[g.metric] ?? g.metric}: ${g.value} ${GEO_UNIT[g.unit] ?? g.unit} (${g.year}, poziom: ${GEO_LEVEL[g.geographic_level] ?? g.geographic_level})`,
  evidenceIds: g.evidence_ids,
});

/** Grupuje dane karty (i źródła pobrane z dowodów) wg pięciu źródeł danych oraz „pozostałych”. */
export function buildSourceGroups(d: ProjectDetail, evidence: Evidence[]): SourceGroup[] {
  const items: Record<SourceGroup['key'], SourceItem[]> = { bzp: [], documents: [], kpo: [], teryt: [], bdl: [], other: [] };

  for (const e of d.external_ids) {
    if (e.scheme === 'bzp' || e.scheme === 'kpo') items[e.scheme].push({ text: `Identyfikator ${e.value}`, evidenceIds: [] });
  }
  for (const p of d.procedures) for (const n of p.notices) {
    items.bzp.push({ ...src(asSource(n.source)), text: n.identifier.value, evidenceIds: n.evidence_ids });
  }
  for (const doc of d.documents) for (const v of doc.versions) {
    items.documents.push({ ...src(asSource(v.source)), text: `${doc.document_type}, wersja ${v.revision}` });
  }
  // Backend podaje region w lokalizacji robót lub, gdy jej brak, w siedzibie beneficjenta.
  const loc = d.works_location?.region_code ? d.works_location : d.beneficiary?.seat;
  if (loc?.region_code) {
    items.teryt.push({
      text: `Kod regionu ${loc.region_code}${loc.region ? ' (' + loc.region + ')' : ''}${loc.locality ? ', ' + loc.locality : ''}${loc.area_code ? ', kod obszaru ' + loc.area_code : ''}`,
      evidenceIds: loc.evidence_ids ?? [],
    });
  }
  items.bdl.push(...(d.geo_signals ?? []).map(geo));

  for (const e of evidence) {
    const s = asSource(e.source);
    const key: SourceGroup['key'] = s.provider === 'bzp' ? 'bzp' : s.provider === 'uploaded_file' ? 'documents' : 'other';
    items[key].push({ ...src(s), evidenceIds: [e.id] });
  }

  return GROUPS.map((g) => ({
    ...g, items: items[g.key],
    demo: items[g.key].some((i) => i.provider === 'mock'),
  }));
}
