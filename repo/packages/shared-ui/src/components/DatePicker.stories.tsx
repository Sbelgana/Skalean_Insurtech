/**
 * DatePicker stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { DatePicker } from './ui/date-picker';

const meta: Meta<typeof DatePicker> = {
  title: 'Components/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    error: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

export const Default: Story = {
  args: { placeholder: 'Selectionner date' },
  render: (args) => <div className="w-72"><DatePicker {...args} /></div>,
};

export const WithError: Story = {
  args: { error: true, placeholder: 'Date de naissance requise' },
  render: (args) => <div className="w-72"><DatePicker {...args} /></div>,
};

export const Disabled: Story = {
  args: { disabled: true, placeholder: 'Non disponible' },
  render: (args) => <div className="w-72"><DatePicker {...args} /></div>,
};
