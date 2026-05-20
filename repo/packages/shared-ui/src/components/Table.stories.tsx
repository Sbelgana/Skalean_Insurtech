/**
 * Table stories -- CSF v3
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/table';
import { Badge } from './ui/badge';

const meta: Meta<typeof Table> = {
  title: 'Components/Table',
  component: Table,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof Table>;

const polices = [
  { id: 'SK-2026-0001', client: 'Rachid Bennani', type: 'Auto TR', prime: '4 800 MAD', statut: 'actif' },
  { id: 'SK-2026-0002', client: 'Sara Mouhim', type: 'Habitation MRH', prime: '2 400 MAD', statut: 'success' },
  { id: 'SK-2026-0003', client: 'Ahmad Ziani', type: 'AMO', prime: '1 200 MAD', statut: 'warning' },
  { id: 'SK-2026-0004', client: 'Khadija El Alaoui', type: 'RC Pro', prime: '3 600 MAD', statut: 'error' },
] as const;

const variantMap: Record<string, 'success' | 'warning' | 'error' | 'primary'> = {
  actif: 'primary',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>N Police</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Prime annuelle</TableHead>
          <TableHead>Statut</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {polices.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-mono text-xs">{p.id}</TableCell>
            <TableCell>{p.client}</TableCell>
            <TableCell>{p.type}</TableCell>
            <TableCell className="tabular-nums">{p.prime}</TableCell>
            <TableCell>
              <Badge variant={variantMap[p.statut] ?? 'primary'}>
                {p.statut.charAt(0).toUpperCase() + p.statut.slice(1)}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};
