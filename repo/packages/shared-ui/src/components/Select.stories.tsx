/**
 * Select stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Select } from './ui/select';

const meta: Meta<typeof Select> = {
  title: 'Components/Select',
  component: Select,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    error: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  args: {
    placeholder: 'Selectionner ville',
    options: [
      { value: 'casablanca', label: 'Casablanca' },
      { value: 'rabat', label: 'Rabat' },
      { value: 'marrakech', label: 'Marrakech' },
      { value: 'fes', label: 'Fes' },
      { value: 'tanger', label: 'Tanger' },
      { value: 'agadir', label: 'Agadir' },
      { value: 'benguerir', label: 'Benguerir' },
    ],
  },
  render: (args) => (
    <div className="w-[260px]">
      <Select {...args} />
    </div>
  ),
};

export const Garanties: Story = {
  args: {
    placeholder: 'Type de garantie',
    options: [
      { value: 'auto-tier', label: 'Auto au tiers' },
      { value: 'auto-tr', label: 'Auto tous risques' },
      { value: 'hab-mrh', label: 'Multirisque habitation' },
      { value: 'sante-amo', label: 'AMO complementaire' },
      { value: 'rc-pro', label: 'RC Professionnelle' },
    ],
  },
  render: (args) => (
    <div className="w-[260px]">
      <Select {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    placeholder: 'Selectionner (desactive)',
    disabled: true,
    options: [{ value: 'a', label: 'Option A' }],
  },
  render: (args) => (
    <div className="w-[260px]">
      <Select {...args} />
    </div>
  ),
};

export const WithError: Story = {
  args: {
    placeholder: 'Champ requis',
    error: true,
    options: [
      { value: 'fr', label: 'Francais' },
      { value: 'ar', label: 'Arabe' },
    ],
  },
  render: (args) => (
    <div className="w-[260px]">
      <Select {...args} />
    </div>
  ),
};
