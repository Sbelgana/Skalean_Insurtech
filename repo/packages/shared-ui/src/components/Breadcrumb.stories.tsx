/**
 * Breadcrumb stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Breadcrumb } from './ui/breadcrumb';

const meta: Meta<typeof Breadcrumb> = {
  title: 'Components/Breadcrumb',
  component: Breadcrumb,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Breadcrumb>;

export const Default: Story = {
  args: {
    items: [
      { label: 'Accueil', href: '/' },
      { label: 'Polices' },
    ],
  },
};

export const WithIcons: Story = {
  args: {
    items: [
      { label: 'Accueil', href: '/' },
      { label: 'Courtage', href: '/courtage' },
      { label: 'Polices', href: '/courtage/polices' },
      { label: 'SK-2026-0142' },
    ],
  },
};

export const Truncated: Story = {
  args: {
    items: [
      { label: 'Accueil', href: '/' },
      { label: '...', href: '#' },
      { label: 'Sinistres', href: '/sinistres' },
      { label: 'Declaration' },
    ],
  },
};
