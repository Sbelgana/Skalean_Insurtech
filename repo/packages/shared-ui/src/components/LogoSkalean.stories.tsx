/**
 * LogoSkalean stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { LogoSkalean } from './LogoSkalean';

const meta: Meta<typeof LogoSkalean> = {
  title: 'Components/LogoSkalean',
  component: LogoSkalean,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Logo Skalean InsurTech SVG inline. Supporte le theming via currentColor.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof LogoSkalean>;

export const Default: Story = {};

export const Small: Story = {
  args: { className: 'h-6' },
};

export const Large: Story = {
  args: { className: 'h-12' },
};

export const OnDark: Story = {
  render: () => (
    <div className="bg-[#1A2730] p-4 rounded-lg inline-block">
      <LogoSkalean className="text-white" />
    </div>
  ),
};
