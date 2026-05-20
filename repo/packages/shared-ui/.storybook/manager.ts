/**
 * Storybook 8.4 manager config -- UI theme Skalean InsurTech
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import { addons } from '@storybook/manager-api';
import { create } from '@storybook/theming/create';

const skaleanLight = create({
  base: 'light',
  brandTitle: 'Skalean InsurTech UI',
  brandUrl: 'https://skalean-insurtech.ma',
  brandTarget: '_self',
  colorPrimary: '#E95D2C',
  colorSecondary: '#1A2730',
  appBg: '#ffffff',
  appContentBg: '#ffffff',
  appBorderColor: '#e5e7eb',
  appBorderRadius: 8,
  fontBase: 'Montserrat, system-ui, sans-serif',
  fontCode: 'Geist Mono, monospace',
  textColor: '#1A2730',
  textInverseColor: '#ffffff',
  barTextColor: '#1A2730',
  barSelectedColor: '#E95D2C',
  barBg: '#B0CEE2',
});

addons.setConfig({
  theme: skaleanLight,
  panelPosition: 'bottom',
  selectedPanel: 'storybook/a11y/panel',
  sidebar: { showRoots: true },
});
