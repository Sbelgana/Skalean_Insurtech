/**
 * RadioGroup stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { RadioGroup } from './ui/radio-group';

const meta: Meta<typeof RadioGroup> = {
  title: 'Components/RadioGroup',
  component: RadioGroup,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

export const Default: Story = {
  args: {
    name: 'formule',
    options: [
      { value: 'tiers', label: 'Au tiers' },
      { value: 'tiers-etendu', label: 'Tiers etendu' },
      { value: 'tous-risques', label: 'Tous risques' },
    ],
    value: 'tiers',
  },
};

export const Inline: Story = {
  args: {
    name: 'frequence',
    orientation: 'horizontal',
    options: [
      { value: 'mensuel', label: 'Mensuel' },
      { value: 'trimestriel', label: 'Trimestriel' },
      { value: 'annuel', label: 'Annuel' },
    ],
  },
};

export const Disabled: Story = {
  args: {
    name: 'statut',
    options: [
      { value: 'actif', label: 'Actif', disabled: true },
      { value: 'inactif', label: 'Inactif', disabled: true },
    ],
    value: 'actif',
  },
};
