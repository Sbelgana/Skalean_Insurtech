/**
 * Combobox stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { Combobox } from './ui/combobox';

const meta: Meta<typeof Combobox> = {
  title: 'Components/Combobox',
  component: Combobox,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Combobox>;

const VILLES = [
  { value: 'casablanca', label: 'Casablanca' },
  { value: 'rabat', label: 'Rabat' },
  { value: 'marrakech', label: 'Marrakech' },
  { value: 'fes', label: 'Fes' },
  { value: 'tanger', label: 'Tanger' },
  { value: 'agadir', label: 'Agadir' },
  { value: 'benguerir', label: 'Benguerir' },
  { value: 'casablanca-an', label: 'Ain Sebaa' },
];

export const Default: Story = {
  render: () => {
    const [val, setVal] = useState('');
    return (
      <div className="w-72">
        <Combobox
          options={VILLES}
          value={val}
          onValueChange={setVal}
          placeholder="Rechercher ville..."
        />
        {val && <p className="mt-2 text-xs text-muted-foreground">Selectionne: {val}</p>}
      </div>
    );
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="w-72">
      <Combobox
        options={VILLES}
        value="casablanca"
        onValueChange={() => undefined}
        placeholder="Ville"
        disabled
      />
    </div>
  ),
};
