/**
 * Card stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-[360px]">
      <CardHeader>
        <CardTitle>Police d&apos;assurance auto</CardTitle>
        <CardDescription>Souscription en 5 minutes.</CardDescription>
      </CardHeader>
      <CardContent>Couverture tous risques + assistance 24/7 partout au Maroc.</CardContent>
      <CardFooter>
        <Button variant="primary">Souscrire maintenant</Button>
      </CardFooter>
    </Card>
  ),
};

export const Compact: Story = {
  render: () => (
    <Card className="w-[280px]">
      <CardHeader>
        <CardTitle>Sinistre #SK-2026-0142</CardTitle>
      </CardHeader>
      <CardContent>Statut : en cours d&apos;expertise.</CardContent>
    </Card>
  ),
};

export const NoFooter: Story = {
  render: () => (
    <Card className="w-[320px]">
      <CardHeader>
        <CardTitle>Statistiques</CardTitle>
        <CardDescription>Mois en cours</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Polices vendues : 142</p>
        <p>Sinistres ouverts : 23</p>
      </CardContent>
    </Card>
  ),
};

export const WithImage: Story = {
  render: () => (
    <Card className="w-[340px] overflow-hidden">
      <div className="h-40 bg-gradient-to-br from-primary/20 to-primary/40" />
      <CardHeader>
        <CardTitle>Maroc Assurance Auto</CardTitle>
        <CardDescription>Formule tout risque 2026</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Valable pour les vehicules matricules au Maroc. ACAPS agree.
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="primary" size="sm">Souscrire</Button>
        <Button variant="outline" size="sm">Devis gratuit</Button>
      </CardFooter>
    </Card>
  ),
};
