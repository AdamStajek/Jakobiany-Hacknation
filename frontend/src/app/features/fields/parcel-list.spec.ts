import { MAX_LIST_PARCELS, parseParcelList } from './parcel-list';

describe('parseParcelList', () => {
  it('rozdziela po nowych liniach i przecinkach', () => {
    const {tokens} = parseParcelList('141201_1.0001.12\n141201_1.0001.13, 141201_1.0001.14;141201_1.0001.15');
    expect(tokens).toEqual(['141201_1.0001.12', '141201_1.0001.13', '141201_1.0001.14', '141201_1.0001.15']);
  });

  it('obsługuje CRLF, puste wiersze i nadmiarowe spacje', () => {
    const {tokens} = parseParcelList('  A  1 \r\n\r\n,, B\r\n');
    expect(tokens).toEqual(['A 1', 'B']);
  });

  it('usuwa duplikaty bez względu na wielkość liter i je zlicza', () => {
    const result = parseParcelList('abc\nABC\nabc, def');
    expect(result.tokens).toEqual(['abc', 'def']);
    expect(result.duplicates).toBe(2);
  });

  it('zwraca pustą listę dla pustego tekstu', () => {
    expect(parseParcelList('  \n , ').tokens).toEqual([]);
  });

  it('odcina numery powyżej limitu', () => {
    const text = Array.from({length: MAX_LIST_PARCELS + 3}, (_, i) => `P${i}`).join('\n');
    const result = parseParcelList(text);
    expect(result.tokens.length).toBe(MAX_LIST_PARCELS);
    expect(result.truncated).toBe(3);
  });
});
