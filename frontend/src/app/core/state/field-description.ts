import { ConfirmedDescription, DescribeAttributeKey, DescribedAttribute, FarmerAnswers, FieldDescription } from '../api/types';

const ATTRIBUTE_KEYS: DescribeAttributeKey[] = ['soil', 'terrain', 'problem', 'constraint'];

type DescriptionRow = {key: DescribeAttributeKey; title: string; value: string | null; matched: string | null};

/** Wiersze ekranu potwierdzenia/podsumowania; null = „Nie rozpoznano”. */
export function descriptionRows(
  attributes: Record<DescribeAttributeKey, DescribedAttribute>,
  labels: Record<DescribeAttributeKey, string>,
): DescriptionRow[] {
  return ATTRIBUTE_KEYS.map(key => ({
    key, title: labels[key], value: attributes[key].label, matched: attributes[key].matched,
  }));
}

/** Ręczna zmiana atrybutu z kafelka (null = wyczyść wybór). Fragment opisu zostaje tylko przy wartości z opisu. */
export function withChoice(
  description: FieldDescription, key: DescribeAttributeKey, value: string | null,
): FieldDescription {
  const current = description[key];
  const option = description.options[key].find(o => o.value === value);
  const next: DescribedAttribute = option
    ? {value: option.value, label: option.label, matched: option.value === current.value ? current.matched : null}
    : {value: null, label: null, matched: null};
  return {...description, [key]: next};
}

/** Odpowiedzi z opisu scalone z ręcznymi (te drugie mają pierwszeństwo); obserwacje bez duplikatów. */
export function mergeAnswers(
  manual: FarmerAnswers, described: Record<string, string>, observationKeys: string[],
): FarmerAnswers {
  const merged: FarmerAnswers = {...described, ...manual};
  const manualObservations = Array.isArray(manual['recommendation_observations'])
    ? manual['recommendation_observations'].filter((o): o is string => typeof o === 'string') : [];
  const observations = [...new Set([...manualObservations, ...observationKeys])];
  if (observations.length) merged['recommendation_observations'] = observations;
  return merged;
}

export function confirmedFrom(description: FieldDescription): ConfirmedDescription {
  const {soil, terrain, problem, constraint, farmer_answers, observation_keys} = description;
  return {soil, terrain, problem, constraint, farmer_answers: {...farmer_answers}, observation_keys: [...observation_keys]};
}
