/**
 * Popover stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Popover } from './ui/popover';
import { Button } from './ui/button';

const meta: Meta<typeof Popover> = {
  title: 'Components/Popover',
  component: Popover,
  tags: ['autodocs'],
  parameters: {
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
};

export default meta;
type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: () => (
    <Popover
      trigger={<Button variant="outline">Filtres avances</Button>}
    >
      <div className="p-3 space-y-2 w-64">
        <p className="text-sm font-medium">Filtrer par</p>
        <label className="text-xs text-muted-foreground">Statut</label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Actif</Button>
          <Button variant="outline" size="sm">Suspendu</Button>
          <Button variant="outline" size="sm">Resilie</Button>
        </div>
      </div>
    </Popover>
  ),
};

export const FormPopover: Story = {
  render: () => (
    <Popover
      trigger={<Button variant="ghost" size="sm">Ajouter note</Button>}
      side="bottom"
    >
      <div className="p-3 w-64">
        <textarea
          className="w-full rounded border px-2 py-1 text-sm resize-none"
          rows={3}
          placeholder="Note interne..."
        />
        <Button variant="primary" size="sm" className="mt-2 w-full">Enregistrer</Button>
      </div>
    </Popover>
  ),
};
