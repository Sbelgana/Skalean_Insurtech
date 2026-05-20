/**
 * DropdownMenu stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { ChevronDown, FileText, Settings, LogOut } from 'lucide-react';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Components/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
  parameters: {
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Actions <ChevronDown className="ms-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Contrat SK-2026-0001</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <FileText className="me-2 h-4 w-4" /> Telecharger PDF
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="me-2 h-4 w-4" /> Modifier contrat
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive">
          <LogOut className="me-2 h-4 w-4" /> Resilier
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const UserMenu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          Yassine Alami <ChevronDown className="ms-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>yassine@courtage.ma</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Mon profil</DropdownMenuItem>
        <DropdownMenuItem>Parametres</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Se deconnecter</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
