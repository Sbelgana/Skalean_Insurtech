/**
 * Slider stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Slider } from './ui/slider';

const meta: Meta<typeof Slider> = {
  title: 'Components/Slider',
  component: Slider,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    showValue: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  args: { defaultValue: 50, min: 0, max: 100, step: 1 },
  render: (args) => (
    <div className="w-72">
      <Slider {...args} />
    </div>
  ),
};

export const ShowValue: Story = {
  args: { defaultValue: 25, min: 0, max: 100, step: 5, showValue: true },
  render: (args) => (
    <div className="w-72">
      <Slider {...args} />
    </div>
  ),
};

export const Steps: Story = {
  args: { defaultValue: 3000, min: 1000, max: 10000, step: 1000, showValue: true },
  render: (args) => (
    <div className="w-72">
      <label className="text-sm text-muted-foreground mb-2 block">Prime mensuelle (MAD)</label>
      <Slider {...args} />
    </div>
  ),
};
