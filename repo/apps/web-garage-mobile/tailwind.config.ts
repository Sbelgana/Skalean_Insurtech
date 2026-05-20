/**
 * Tailwind v4 config -- web-garage-mobile
 * Reference : task-1.4.3 Sprint 4 Phase 1
 */
import type { Config } from 'tailwindcss';
import sharedPreset from '@insurtech/shared-ui/tailwind-preset';
import typography from '@tailwindcss/typography';

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
        'mobile-sm': '375px',
        'mobile-md': '390px',
        'mobile-lg': '430px',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 250ms ease-out',
        'slide-in-rtl': 'slideInRtl 250ms ease-out',
      },
    },
  },
  plugins: [typography],
};

export default config;
