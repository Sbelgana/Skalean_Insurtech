/**
 * Button stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './ui/button';
import { Mail, Loader2 } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Button shared-ui : 6 variantes + 4 sizes + loading. Variantes: primary, secondary, outline, ghost, destructive, link.',
      },
    },
  },
  args: {
    children: 'Cliquer ici',
    variant: 'primary',
    size: 'md',
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link'],
      description: 'Variante visuelle',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg', 'icon'],
      description: 'Taille',
    },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    onClick: { action: 'clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {};

export const Primary: Story = {
  args: { variant: 'primary', children: 'Souscrire police' },
};

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Supprimer contrat' },
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'Annuler' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Secondaire' },
};

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Discret' },
};

export const Link: Story = {
  args: { variant: 'link', children: 'En savoir plus' },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Mail className="me-2 h-4 w-4" /> Envoyer email
      </>
    ),
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    children: (
      <>
        <Loader2 className="me-2 h-4 w-4 animate-spin" /> Chargement
      </>
    ),
  },
};

export const Disabled: Story = {
  args: { disabled: true, children: 'Desactive' },
};

export const SmallSize: Story = {
  args: { size: 'sm', children: 'Petit' },
};

export const LargeSize: Story = {
  args: { size: 'lg', children: 'Grand' },
};

export const IconSize: Story = {
  args: { size: 'icon', children: <Mail className="h-4 w-4" /> },
};
