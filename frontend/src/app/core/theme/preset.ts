import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Preset Aura w barwach marki „Pole Widzenia”.
 * Tokeny --pw-* (forest, leaf, field, deep-green, orange, ivory) pochodzą z identyfikacji wizualnej i nie zmieniają się.
 * Primary = zieleń pól (#385A15), CTA = pomarańcz (#EE8106) z ciemnozielonym tekstem (kontrast 5.77:1).
 */
export const AppPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#F3F6EC', 100: '#E4EBD2', 200: '#C9D7A8', 300: '#A9BE72', 400: '#8FA43A',
      500: '#778C12', 600: '#5A7014', 700: '#385A15', 800: '#274010', 900: '#103101', 950: '#0D2A00',
    },
    colorScheme: {
      light: {
        primary: {color: '#385A15', contrastColor: '#ffffff', hoverColor: '#274010', activeColor: '#103101'},
        surface: {
          0: '#FFFFFF', 50: '#F7F6EE', 100: '#EEF1E8', 200: '#D8DFCF', 300: '#BCC6B0', 400: '#8B9981',
          500: '#6A7960', 600: '#506047', 700: '#3B4A33', 800: '#223318', 900: '#0D2A00', 950: '#081A00',
        },
        text: {color: '#0D2A00', mutedColor: '#506047'},
      },
      dark: {
        primary: {color: '#A9BE72', contrastColor: '#0D2A00', hoverColor: '#C9D7A8', activeColor: '#E4EBD2'},
        surface: {
          0: '#FFFFFF', 50: '#EEF1E8', 100: '#D8DFCF', 200: '#BCC6B0', 300: '#8B9981', 400: '#6A7960',
          500: '#506047', 600: '#3B4A33', 700: '#223318', 800: '#14230A', 900: '#0D1A06', 950: '#081200',
        },
        text: {color: '#F7F6EE', hoverColor: '#FFFFFF', mutedColor: '#BCC6B0', hoverMutedColor: '#D8DFCF'},
      },
    },
  },
  components: {
    button: {
      colorScheme: {
        light: {root: {primary: {background: '#EE8106', hoverBackground: '#D87505', activeBackground: '#C26904', borderColor: '#EE8106',
          hoverBorderColor: '#D87505', activeBorderColor: '#C26904', color: '#0D2A00', hoverColor: '#0D2A00', activeColor: '#0D2A00'}}},
        dark: {root: {primary: {background: '#EE8106', hoverBackground: '#F79A2E', activeBackground: '#FBB05A', borderColor: '#EE8106',
          hoverBorderColor: '#F79A2E', activeBorderColor: '#FBB05A', color: '#0D2A00', hoverColor: '#0D2A00', activeColor: '#0D2A00'}}},
      },
    },
  },
});
