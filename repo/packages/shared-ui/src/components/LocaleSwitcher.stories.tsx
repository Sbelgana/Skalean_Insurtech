/**
 * LocaleSwitcher stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { LocaleSwitcher } from './LocaleSwitcher';

const meta: Meta<typeof LocaleSwitcher> = {
  title: 'Components/LocaleSwitcher',
  component: LocaleSwitcher,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Selecteur de locale : fr / ar-MA / ar. Met a jour l\'URL et la direction HTML.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof LocaleSwitcher>;

export const Default: Story = {};
