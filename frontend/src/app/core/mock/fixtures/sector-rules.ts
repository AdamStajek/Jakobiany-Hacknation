/* eslint-disable @typescript-eslint/no-explicit-any */
const cat = (code: string, label: string) => ({ code, label, description: label });

/** Zatwierdzona wiedza sektorowa (kształt zgodny z `SectorRules`). */
export const SECTOR_RULES: any[] = [{
  id: 'water_and_sewerage_v1', revision: 1, review_status: 'approved', sector_code: 'water_and_sewerage',
  description: 'Katalog ryzyk i lista kontrolna inwestycji wodociągowych MFiPR (dane demonstracyjne).',
  subsectors: [{ code: 'water_network', label: 'Sieć wodociągowa' }, { code: 'sanitary_sewer', label: 'Kanalizacja sanitarna' }],
  risk_categories: [
    cat('R01', 'Niepełny lub niespójny zakres'), cat('R02', 'Niedostateczne rozpoznanie stanu istniejącego'),
    cat('R03', 'Dostęp do gruntów i prawa do nieruchomości'), cat('R04', 'Decyzje i uzgodnienia'),
  ],
  checklists: [{
    subsector_code: 'water_network', phase: 'planning',
    requirements: [{
      code: 'need_and_outcome', question: 'Jaki problem ma rozwiązać inwestycja?', rationale: 'Podstawa zakresu.',
      weight: 1, risk_codes: ['R01'], expected_evidence: ['Uzasadnienie inwestycji'],
    }, {
      code: 'land_access', question: 'Kto jest właścicielem gruntów i czy zapewniono dostęp?', rationale: 'Ryzyko dostępu.',
      weight: 2, risk_codes: ['R03'], expected_evidence: ['Wykaz praw do dysponowania'],
    }],
  }],
  comparison_weights: { subsector: 4, work_type: 2, function: 1, technical: 2, organization: 1, cost: 1, schedule: 1, location: 1, text: 3 },
  rules: [],
}];
