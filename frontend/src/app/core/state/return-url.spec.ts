import { loginQuery, safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('przepuszcza wewnętrzne ścieżki z parametrami', () => {
    expect(safeReturnUrl('/pola')).toBe('/pola');
    expect(safeReturnUrl('/dzialka/123?x=1#a')).toBe('/dzialka/123?x=1#a');
  });

  it('odrzuca adresy zewnętrzne i podejrzane', () => {
    for (const bad of ['https://zlo.pl', '//zlo.pl', 'javascript:alert(1)', '/\\zlo.pl', 'pola', '', null, undefined, '/a\nb']) {
      expect(safeReturnUrl(bad)).toBe('/');
    }
  });

  it('nie wraca na ekrany logowania ani rejestracji', () => {
    expect(safeReturnUrl('/zaloguj?returnUrl=%2Fpola')).toBe('/');
    expect(safeReturnUrl('/rejestracja')).toBe('/');
    expect(safeReturnUrl('/zalogujx')).toBe('/zalogujx');
  });

  it('używa podanego adresu zastępczego', () => {
    expect(safeReturnUrl('//x', '/pola')).toBe('/pola');
  });

  it('loginQuery pomija niepoprawny adres', () => {
    expect(loginQuery('/pola')).toEqual({returnUrl: '/pola'});
    expect(loginQuery('https://x.pl')).toEqual({});
    expect(loginQuery('/zaloguj')).toEqual({});
  });
});
