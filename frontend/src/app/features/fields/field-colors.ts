import type { FieldColor } from '../../core/state/fields.store';

export type ColorStyle = {id: FieldColor; label: string; dot: string};

/** Kolory pól jako klasy motywu (statyczne, żeby Tailwind je wykrył). */
export const COLOR_STYLES: ColorStyle[] = [
  {id: 'green', label: 'Zielony', dot: 'bg-green-500'},
  {id: 'blue', label: 'Niebieski', dot: 'bg-blue-500'},
  {id: 'amber', label: 'Bursztynowy', dot: 'bg-amber-500'},
  {id: 'purple', label: 'Fioletowy', dot: 'bg-purple-500'},
  {id: 'teal', label: 'Morski', dot: 'bg-teal-500'},
  {id: 'pink', label: 'Różowy', dot: 'bg-pink-500'},
];

export const colorStyle = (id: FieldColor): ColorStyle => COLOR_STYLES.find((c) => c.id === id) ?? COLOR_STYLES[0];
