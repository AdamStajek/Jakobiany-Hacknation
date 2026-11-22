import { describe, expect, it } from 'vitest';
import { FieldDescription } from '../api/types';
import { descriptionRows, mergeAnswers, withChoice } from './field-description';

const none = {value: null, label: null, matched: null};
const description: FieldDescription = {
  soil: {value: 'sandy', label: 'piaszczysta', matched: 'ziemia lekka'},
  terrain: none, problem: none, constraint: none,
  observation_keys: ['a', 'b'], farmer_answers: {soil_type: 'sandy', note: 'x'},
  options: {soil: [{value: 'sandy', label: 'piaszczysta'}, {value: 'clay', label: 'gliniasta'}],
    terrain: [{value: 'slope', label: 'nachylony'}], problem: [], constraint: []},
  attribute_labels: {soil: 'Gleba', terrain: 'Teren', problem: 'Problem', constraint: 'Ograniczenie'},
};

describe('descriptionRows', () => {
  it('zwraca cztery wiersze z etykietami i jawnym brakiem', () => {
    const rows = descriptionRows(description, description.attribute_labels);
    expect(rows.map(r => r.title)).toEqual(['Gleba', 'Teren', 'Problem', 'Ograniczenie']);
    expect(rows[0]).toMatchObject({value: 'piaszczysta', matched: 'ziemia lekka'});
    expect(rows[1].value).toBeNull();
  });
});

describe('withChoice', () => {
  it('zmienia wartość i gubi fragment opisu', () => {
    const next = withChoice(description, 'soil', 'clay');
    expect(next.soil).toEqual({value: 'clay', label: 'gliniasta', matched: null});
  });
  it('zachowuje fragment przy tej samej wartości', () => {
    expect(withChoice(description, 'soil', 'sandy').soil.matched).toBe('ziemia lekka');
  });
  it('czyści wybór', () => {
    expect(withChoice(description, 'soil', null).soil).toEqual(none);
  });
});

describe('mergeAnswers', () => {
  it('ręczne odpowiedzi mają pierwszeństwo', () => {
    const merged = mergeAnswers({soil_type: 'clay'}, description.farmer_answers, []);
    expect(merged['soil_type']).toBe('clay');
    expect(merged['note']).toBe('x');
  });
  it('łączy obserwacje bez duplikatów', () => {
    const merged = mergeAnswers({recommendation_observations: ['b', 'c']}, {}, ['a', 'b']);
    expect(merged['recommendation_observations']).toEqual(['b', 'c', 'a']);
  });
  it('bez obserwacji nie dodaje klucza', () => {
    expect('recommendation_observations' in mergeAnswers({}, {}, [])).toBe(false);
  });
});
