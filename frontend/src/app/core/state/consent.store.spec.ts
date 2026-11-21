import { TestBed } from '@angular/core/testing';
import { CONSENT_KEY, ConsentStore } from './consent.store';

describe('ConsentStore', () => {
  beforeEach(() => localStorage.clear());

  it('bez decyzji pokazuje baner i niczego nie zapisuje ani nie czyta', () => {
    const consent = TestBed.inject(ConsentStore);
    expect(consent.bannerOpen()).toBe(true);
    expect(consent.write('x', '1')).toBe('skipped');
    expect(localStorage.getItem('x')).toBeNull();
    localStorage.setItem('x', '1');
    expect(consent.read('x')).toBeNull();
  });

  it('zgoda pozwala zapisywać, a odmowa kasuje zapisane dane i pamięta decyzję', () => {
    const consent = TestBed.inject(ConsentStore);
    consent.grant();
    expect(consent.bannerOpen()).toBe(false);
    expect(consent.write('wodo-theme', 'dark')).toBe('saved');
    expect(consent.read('wodo-theme')).toBe('dark');
    consent.deny();
    expect(localStorage.getItem('wodo-theme')).toBeNull();
    expect(localStorage.getItem(CONSENT_KEY)).toBe('denied');
  });

  it('decyzję można zmienić przez ponowne otwarcie banera', () => {
    const consent = TestBed.inject(ConsentStore);
    consent.deny();
    expect(consent.bannerOpen()).toBe(false);
    consent.reopen();
    expect(consent.bannerOpen()).toBe(true);
    consent.grant();
    expect(consent.bannerOpen()).toBe(false);
  });
});
