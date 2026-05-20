/**
 * Toast stories -- CSF v3 (uses sonner Toaster)
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Toaster, toast } from './ui/toast';
import { Button } from './ui/button';

const meta: Meta = {
  title: 'Components/Toast',
  component: Toaster,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Toast notifications via Sonner. Variantes: default, success, error, warning, with action.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        variant="primary"
        onClick={() => toast('Notification simple', { description: 'Message basique' })}
      >
        Afficher toast
      </Button>
    </>
  ),
};

export const Success: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        variant="primary"
        onClick={() =>
          toast.success('Police creee', { description: 'Police #SK-2026-0142 sauvegardee' })
        }
      >
        Toast succes
      </Button>
    </>
  ),
};

export const Error: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        variant="destructive"
        onClick={() =>
          toast.error('Erreur reseau', { description: 'Connexion API perdue. Reessayez.' })
        }
      >
        Toast erreur
      </Button>
    </>
  ),
};

export const WithAction: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        variant="outline"
        onClick={() =>
          toast('Contrat envoye', {
            description: 'Pour signature electronique au client.',
            action: { label: 'Annuler', onClick: () => toast('Action annulee') },
          })
        }
      >
        Toast avec action
      </Button>
    </>
  ),
};

export const Warning: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        variant="secondary"
        onClick={() =>
          toast.warning('Session expirant', {
            description: 'Votre session expire dans 5 minutes.',
          })
        }
      >
        Toast warning
      </Button>
    </>
  ),
};
