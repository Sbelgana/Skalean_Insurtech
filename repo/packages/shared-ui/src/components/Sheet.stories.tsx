/**
 * Sheet stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetClose } from './ui/sheet';
import { Button } from './ui/button';

const meta: Meta<typeof Sheet> = {
  title: 'Components/Sheet',
  component: Sheet,
  tags: ['autodocs'],
  parameters: {
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
};

export default meta;
type Story = StoryObj<typeof Sheet>;

export const RightSide: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Ouvrir panneau droit</Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetTitle>Details sinistre</SheetTitle>
        <p className="text-sm text-muted-foreground mt-2">Sinistre #SK-2026-0142 - En cours d&apos;expertise.</p>
        <div className="mt-4 flex gap-2">
          <SheetClose asChild>
            <Button variant="outline" size="sm">Fermer</Button>
          </SheetClose>
          <Button variant="primary" size="sm">Valider expertise</Button>
        </div>
      </SheetContent>
    </Sheet>
  ),
};

export const LeftSide: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Menu gauche</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetTitle>Navigation</SheetTitle>
        <nav className="mt-4 flex flex-col gap-2">
          <a href="#" className="text-sm hover:underline">Tableau de bord</a>
          <a href="#" className="text-sm hover:underline">Polices</a>
          <a href="#" className="text-sm hover:underline">Sinistres</a>
        </nav>
      </SheetContent>
    </Sheet>
  ),
};

export const BottomSide: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Panneau bas</Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetTitle>Confirmer action</SheetTitle>
        <p className="text-sm text-muted-foreground mt-1">Souhaitez-vous archiver ce contrat ?</p>
        <div className="mt-4 flex gap-2">
          <SheetClose asChild>
            <Button variant="outline" size="sm">Annuler</Button>
          </SheetClose>
          <Button variant="destructive" size="sm">Archiver</Button>
        </div>
      </SheetContent>
    </Sheet>
  ),
};

export const TopSide: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Notification haut</Button>
      </SheetTrigger>
      <SheetContent side="top">
        <SheetTitle>Mise a jour disponible</SheetTitle>
        <p className="text-sm text-muted-foreground mt-1">Version 2.3.0 disponible.</p>
      </SheetContent>
    </Sheet>
  ),
};
