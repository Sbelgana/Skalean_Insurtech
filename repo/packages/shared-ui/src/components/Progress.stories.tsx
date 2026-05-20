/**
 * Progress stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Progress } from './ui/progress';

const meta: Meta<typeof Progress> = {
  title: 'Components/Progress',
  component: Progress,
  tags: ['autodocs'],
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
  },
};

export default meta;
type Story = StoryObj<typeof Progress>;

export const Default: Story = {
  args: { value: 60, max: 100 },
  render: (args) => <div className="w-72"><Progress {...args} /></div>,
};

export const WithLabel: Story = {
  args: { value: 75, max: 100, label: 'Dossier complete' },
  render: (args) => <div className="w-72"><Progress {...args} /></div>,
};

export const Low: Story = {
  args: { value: 20, max: 100, label: 'Etape 1/5' },
  render: (args) => <div className="w-72"><Progress {...args} /></div>,
};

export const Complete: Story = {
  args: { value: 100, max: 100, label: 'Souscription finalisee' },
  render: (args) => <div className="w-72"><Progress {...args} /></div>,
};

export const Sized: Story = {
  render: () => (
    <div className="space-y-4 w-72">
      <Progress value={30} max={100} label="Etape 1" />
      <Progress value={60} max={100} label="Etape 2" />
      <Progress value={90} max={100} label="Etape 3" />
    </div>
  ),
};
