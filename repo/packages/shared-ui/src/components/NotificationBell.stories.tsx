/**
 * NotificationBell stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { NotificationBell } from './NotificationBell';

const meta: Meta<typeof NotificationBell> = {
  title: 'Components/NotificationBell',
  component: NotificationBell,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Cloche de notifications avec badge compteur. Connecte SSE en Sprint 9.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof NotificationBell>;

export const Default: Story = {};
export const WithCount: Story = { args: { unreadCount: 3 } };
export const ManyNotifications: Story = { args: { unreadCount: 12 } };
