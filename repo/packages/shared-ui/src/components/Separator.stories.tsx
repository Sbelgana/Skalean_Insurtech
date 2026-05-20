/**
 * Separator stories -- CSF v3 (uses hr / div separator)
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Components/Separator',
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

export const Horizontal: Story = {
  render: () => (
    <div className="w-72 space-y-4">
      <p className="text-sm">Section superieure</p>
      <hr className="border-border" />
      <p className="text-sm text-muted-foreground">Section inferieure</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex items-center gap-4 h-8">
      <span className="text-sm">Francais</span>
      <div className="h-full w-px bg-border" />
      <span className="text-sm">Darija</span>
      <div className="h-full w-px bg-border" />
      <span className="text-sm">Arabe</span>
    </div>
  ),
};
