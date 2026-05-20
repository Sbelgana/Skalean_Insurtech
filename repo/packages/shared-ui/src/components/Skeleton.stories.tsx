/**
 * Skeleton stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from './ui/skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'Components/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['rectangular', 'circular', 'text'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  args: { variant: 'rectangular', className: 'h-4 w-48' },
};

export const Card: Story = {
  render: () => (
    <div className="w-[320px] space-y-3 p-4 rounded-lg border">
      <Skeleton variant="rectangular" className="h-40 w-full" />
      <Skeleton variant="text" className="h-4 w-3/4" />
      <Skeleton variant="text" className="h-4 w-1/2" />
      <Skeleton variant="rectangular" className="h-9 w-full" />
    </div>
  ),
};

export const List: Story = {
  render: () => (
    <div className="w-[340px] space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton variant="circular" className="h-10 w-10" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="h-4 w-3/4" />
            <Skeleton variant="text" className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  ),
};

export const Table: Story = {
  render: () => (
    <div className="w-full space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-4">
          <Skeleton variant="text" className="h-4 w-1/4" />
          <Skeleton variant="text" className="h-4 w-1/4" />
          <Skeleton variant="text" className="h-4 w-1/4" />
          <Skeleton variant="text" className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  ),
};
