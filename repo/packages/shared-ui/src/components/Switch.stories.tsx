/**
 * Switch stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Switch } from './ui/switch';

const meta: Meta<typeof Switch> = {
  title: 'Components/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  args: { label: 'Notifications push' },
};
export const Checked: Story = {
  args: { label: 'Mode sombre', checked: true },
};
export const Disabled: Story = {
  args: { label: 'Option verrouilee', disabled: true },
};
export const Labelled: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Switch label="Alertes sinistres" checked />
      <Switch label="Rappels renouvellement" />
      <Switch label="Mode hors-ligne" disabled />
    </div>
  ),
};
