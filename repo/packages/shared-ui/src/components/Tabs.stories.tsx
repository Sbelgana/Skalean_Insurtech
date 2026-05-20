/**
 * Tabs stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Tabs } from './ui/tabs';

const meta: Meta<typeof Tabs> = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  args: {
    defaultValue: 'polices',
    items: [
      { value: 'polices', label: 'Polices', content: <div className="p-4">Liste des polices actives.</div> },
      { value: 'sinistres', label: 'Sinistres', content: <div className="p-4">Liste des sinistres en cours.</div> },
      { value: 'factures', label: 'Factures', content: <div className="p-4">Historique de facturation.</div> },
    ],
  },
  render: (args) => (
    <div className="w-[480px]">
      <Tabs {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    defaultValue: 'actif',
    items: [
      { value: 'actif', label: 'Actif', content: <div className="p-4">Contenu actif</div> },
      { value: 'suspendu', label: 'Suspendu', content: <div className="p-4">Suspendu</div>, disabled: true },
      { value: 'resilie', label: 'Resilie', content: <div className="p-4">Resilie</div>, disabled: true },
    ],
  },
  render: (args) => (
    <div className="w-[480px]">
      <Tabs {...args} />
    </div>
  ),
};
