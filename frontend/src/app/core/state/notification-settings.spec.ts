import { ConfirmedDescription } from '../api/types';
import { demoQuery, emailProblem, parseSettings } from './notification-settings';

const attr = (value: string | null) => ({value, label: value, matched: null});
const description = (soil: string | null, terrain: string | null): ConfirmedDescription => ({
  soil: attr(soil), terrain: attr(terrain), problem: attr(null), constraint: attr(null), farmer_answers: {}, observation_keys: [],
});

describe('notification-settings', () => {
  it('waliduje adres e-mail', () => {
    expect(emailProblem('')).not.toBe('');
    expect(emailProblem('jan@poczta')).not.toBe('');
    expect(emailProblem(' jan@poczta.pl ')).toBe('');
  });

  it('buduje parametry zapytania tylko z niepustych wartości', () => {
    expect(demoQuery(null, null)).toEqual({});
    expect(demoQuery(description('sandy', null), ' Pole 1 ')).toEqual({field_name: 'Pole 1', soil: 'sandy'});
    expect(demoQuery(description('clay', 'sloped'), '')).toEqual({soil: 'clay', terrain: 'sloped'});
  });

  it('odrzuca uszkodzony zapis ustawień', () => {
    expect(parseSettings('{')).toBeNull();
    expect(parseSettings('{"enabled":1}')).toBeNull();
    expect(parseSettings('{"enabled":true,"channel":"app","email":""}')).toEqual({enabled: true, channel: 'app', email: ''});
  });
});
