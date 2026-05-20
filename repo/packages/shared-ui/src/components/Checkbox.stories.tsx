/**
 * Checkbox stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Checkbox } from './ui/checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'Components/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  args: { label: 'Accepter les conditions generales' },
};
export const Checked: Story = {
  args: { label: 'Recevoir les notifications email', defaultChecked: true },
};
export const Disabled: Story = {
  args: { label: 'Option indisponible', disabled: true },
};
export const DisabledChecked: Story = {
  args: { label: 'ACAPS agree (lecture seule)', defaultChecked: true, disabled: true },
};
export const Group: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Checkbox label="Auto tous risques" defaultChecked />
      <Checkbox label="Habitation MRH" />
      <Checkbox label="AMO complementaire" />
      <Checkbox label="RC Professionnelle" defaultChecked />
    </div>
  ),
};
