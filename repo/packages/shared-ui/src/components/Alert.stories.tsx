/**
 * Alert stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Alert } from './ui/alert';

const meta: Meta<typeof Alert> = {
  title: 'Components/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['info', 'success', 'warning', 'error'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Default: Story = {
  args: { variant: 'info', title: 'Information', children: 'Votre devis est en cours de traitement.' },
};
export const Success: Story = {
  args: { variant: 'success', title: 'Police creee', children: 'Contrat #SK-2026-0142 genere avec succes.' },
};
export const Warning: Story = {
  args: { variant: 'warning', title: 'Attention', children: 'Votre session expire dans 5 minutes.' },
};
export const Error: Story = {
  args: { variant: 'error', title: 'Erreur', children: 'Impossible de charger les donnees. Reessayez.' },
};
