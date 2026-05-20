/**
 * Input stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './ui/input';
import { Search, Mail } from 'lucide-react';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  args: { placeholder: 'Tapez ici...' },
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['text', 'email', 'password', 'tel', 'url', 'number'],
    },
    disabled: { control: 'boolean' },
    error: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const Email: Story = {
  args: { type: 'email', placeholder: 'votre@email.ma' },
};

export const Password: Story = {
  args: { type: 'password', placeholder: 'Mot de passe' },
};

export const Disabled: Story = {
  args: { disabled: true, placeholder: 'Desactive' },
};

export const WithError: Story = {
  args: { error: true, placeholder: 'Champ requis', defaultValue: 'valeur invalide' },
};

export const WithIcon: Story = {
  render: (args) => (
    <div className="relative w-72">
      <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input {...args} className="ps-9" placeholder="Rechercher contrat..." />
    </div>
  ),
};

export const WithMailIcon: Story = {
  render: (args) => (
    <div className="relative w-72">
      <Mail className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input {...args} className="ps-9" type="email" placeholder="votre@email.ma" />
    </div>
  ),
};

export const RTLArabic: Story = {
  parameters: { docs: { description: { story: 'Test RTL ar-MA Darija' } } },
  render: (args) => (
    <div dir="rtl" className="w-72">
      <Input {...args} placeholder="ادخل اسمك" />
    </div>
  ),
};
