import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Risk Miner brand preset, built on Aura and mapped to Aura's default palettes:
 *  - logo "MINER" blue   -> primary = {blue.*} (shade 600 in light mode, closer to the logo)
 *  - logo "RISK" navy    -> surfaces = {slate.*} in both modes (navy-tinted greys, dark mode on slate.950)
 *  - logo green / orange -> Aura's default success (green) and warn (orange) severities, left unchanged
 */
export const RiskMinerPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{blue.50}',
      100: '{blue.100}',
      200: '{blue.200}',
      300: '{blue.300}',
      400: '{blue.400}',
      500: '{blue.500}',
      600: '{blue.600}',
      700: '{blue.700}',
      800: '{blue.800}',
      900: '{blue.900}',
      950: '{blue.950}',
      color: 'light-dark({primary.600}, {primary.400})',
      contrastColor: 'light-dark(#ffffff, {surface.950})',
      hoverColor: 'light-dark({primary.700}, {primary.300})',
      activeColor: 'light-dark({primary.800}, {primary.200})',
    },
    surface: {
      0: '#ffffff',
      50: '{slate.50}',
      100: '{slate.100}',
      200: '{slate.200}',
      300: '{slate.300}',
      400: '{slate.400}',
      500: '{slate.500}',
      600: '{slate.600}',
      700: '{slate.700}',
      800: '{slate.800}',
      900: '{slate.900}',
      950: '{slate.950}',
    },
  },
});
