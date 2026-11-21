import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/** Aura preset: zielono-wodny motyw (primary = emerald), neutralne szarości ze skali slate. */
export const AppPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{emerald.50}', 100: '{emerald.100}', 200: '{emerald.200}', 300: '{emerald.300}', 400: '{emerald.400}',
      500: '{emerald.500}', 600: '{emerald.600}', 700: '{emerald.700}', 800: '{emerald.800}', 900: '{emerald.900}', 950: '{emerald.950}',
    },
    colorScheme: {
      light: {primary: {color: '{emerald.700}', contrastColor: '#ffffff', hoverColor: '{emerald.800}', activeColor: '{emerald.900}'}},
      dark: {primary: {color: '{emerald.400}', contrastColor: '{slate.950}', hoverColor: '{emerald.300}', activeColor: '{emerald.200}'}},
    },
  },
});
