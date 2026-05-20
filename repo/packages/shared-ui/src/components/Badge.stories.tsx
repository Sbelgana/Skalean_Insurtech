/**
 * Badge stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './ui/badge';

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { children: 'Actif' },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'primary', 'secondary', 'success', 'warning', 'error', 'outline'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};
export const Primary: Story = { args: { variant: 'primary', children: 'Nouveau' } };
export const Secondary: Story = { args: { variant: 'secondary', children: 'Brouillon' } };
export const Success: Story = { args: { variant: 'success', children: 'Valide' } };
export const Warning: Story = { args: { variant: 'warning', children: 'En attente' } };
export const Error: Story = { args: { variant: 'error', children: 'Refuse' } };
export const Outline: Story = { args: { variant: 'outline', children: 'ACAPS' } };
