/**
 * Dialog stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';

const meta: Meta<typeof Dialog> = {
  title: 'Components/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    a11y: {
      config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="primary" onClick={() => setOpen(true)}>Ouvrir dialog</Button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Confirmer suppression"
          description="Cette action ne peut pas etre annulee. Le contrat sera definitivement supprime."
        >
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={() => setOpen(false)}>Supprimer</Button>
          </div>
        </Dialog>
      </>
    );
  },
};

export const FormDialog: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="primary" onClick={() => setOpen(true)}>Editer profil</Button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Modifier profil"
          description="Mettez a jour vos informations."
        >
          <div className="grid gap-4 py-4">
            <input className="rounded border px-3 py-2 text-sm" placeholder="Nom complet" />
            <input className="rounded border px-3 py-2 text-sm" placeholder="Email" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
            <Button variant="primary" size="sm" onClick={() => setOpen(false)}>Enregistrer</Button>
          </div>
        </Dialog>
      </>
    );
  },
};

export const OpenByDefault: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Information importante"
        description="Votre session expirera dans 5 minutes. Veuillez sauvegarder votre travail."
      >
        <div className="flex justify-end mt-4">
          <Button variant="primary" onClick={() => setOpen(false)}>OK, compris</Button>
        </div>
      </Dialog>
    );
  },
};
