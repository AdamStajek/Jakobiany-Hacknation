import { TestBed } from '@angular/core/testing';
import { RiskScale } from './risk-scale';

function render(risk: string) {
  const fixture = TestBed.createComponent(RiskScale);
  fixture.componentRef.setInput('risk', risk);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('RiskScale', () => {
  it('opisuje ryzyko dla czytników ekranu', () => {
    expect(render('Podwyższone').querySelector('[role=img]')?.getAttribute('aria-label')).toContain('Podwyższone');
  });
  it('wyróżnia dokładnie jeden stopień', () => {
    const bars = render('Niskie w modelu').querySelectorAll('.h-2');
    expect([...bars].filter((b) => /bg-\[#(385A15|778C12|EE8106)\]/.test(b.className)).length).toBe(1);
  });
  it('nieznane ryzyko traktuje jako niepewne', () => {
    expect(render('coś innego').querySelector('[class*="bg-[#778C12]"]')).not.toBeNull();
  });
});
