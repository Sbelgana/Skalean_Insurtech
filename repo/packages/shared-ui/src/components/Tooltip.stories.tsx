/**
 * Tooltip stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Tooltip } from './ui/tooltip';
import { Button } from './ui/button';
import { Info } from 'lucide-react';

const meta: Meta<typeof Tooltip> = {
  title: 'Components/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: () => (
    <Tooltip content="ACAPS: Autorite de Controle des Assurances et de la Prevoyance Sociale">
      <Button variant="ghost" size="icon">
        <Info className="h-4 w-4" />
      </Button>
    </Tooltip>
  ),
};

export const TopSide: Story = {
  render: () => (
    <Tooltip content="Voir details du contrat" side="top">
      <Button variant="outline" size="sm">Contrat</Button>
    </Tooltip>
  ),
};

export const BottomSide: Story = {
  render: () => (
    <Tooltip content="Telecharger le PDF" side="bottom">
      <Button variant="outline" size="sm">Telecharger</Button>
    </Tooltip>
  ),
};

export const Multiline: Story = {
  render: () => (
    <Tooltip content="La formule tous risques couvre : incendie, vol, bris de glace, catastrophes naturelles et accidents tous types.">
      <Button variant="ghost">Voir couverture</Button>
    </Tooltip>
  ),
};
