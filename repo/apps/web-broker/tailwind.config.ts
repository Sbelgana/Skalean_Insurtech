/**
 * Tailwind v4 config -- web-broker
 * Reference : task-1.4.1 Sprint 4 Phase 1
 */
import type { Config } from 'tailwindcss';
import sharedPreset from '@insurtech/shared-ui/tailwind-preset';
import typography from '@tailwindcss/typography';
import forms from '@tailwindcss/forms';

const config: Config = {
  presets: [sharedPreset],
  content: [
    './src/**/*.{ts,tsx,mdx}',
    './src/app/**/*.{ts,tsx,mdx}',
    './src/components/**/*.{ts,tsx,mdx}',
    '../../packages/shared-ui/src/**/*.{ts,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        'broker-xl': '1440px',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-in-rtl': 'slideInRtl 250ms ease-out',
      },
    },
  },
  plugins: [typography, forms({ strategy: 'class' })],
};

export default config;
