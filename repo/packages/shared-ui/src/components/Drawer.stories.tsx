/**
 * Drawer stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { Drawer } from './ui/drawer';
import { Button } from './ui/button';

const meta: Meta<typeof Drawer> = {
  title: 'Components/Drawer',
  component: Drawer,
  tags: ['autodocs'],
  parameters: {
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
};

export default meta;
type Story = StoryObj<typeof Drawer>;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="primary" onClick={() => setOpen(true)}>Ouvrir tiroir</Button>
        <Drawer open={open} onClose={() => setOpen(false)} title="Filtres avances" side="right">
          <div className="p-4 space-y-3">
            <p className="text-sm">Filtrer les polices par statut, type et date.</p>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Fermer</Button>
          </div>
        </Drawer>
      </>
    );
  },
};

export const Nested: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="outline" onClick={() => setOpen(true)}>Tiroir details</Button>
        <Drawer open={open} onClose={() => setOpen(false)} title="Details contrat" side="right">
          <div className="p-4 space-y-2">
            <p className="text-sm font-medium">Contrat SK-2026-0001</p>
            <p className="text-xs text-muted-foreground">Client: Rachid Bennani</p>
            <p className="text-xs text-muted-foreground">Prime: 4 800 MAD/an</p>
          </div>
        </Drawer>
      </>
    );
  },
};
