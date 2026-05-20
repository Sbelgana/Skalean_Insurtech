/**
 * GarageBranding.spec.tsx -- web-garage
 * Reference : task-1.4.1 Sprint 4 Phase 1
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GarageBranding } from '@/components/GarageBranding';

describe('GarageBranding', () => {
  it('renders the Skalean Garage wordmark', () => {
    render(<GarageBranding />);
    expect(screen.getByText('Skalean Garage')).toBeInTheDocument();
  });

  it('renders the wrench icon with aria-label', () => {
    render(<GarageBranding />);
    const icon = screen.getByLabelText('cle a molette');
    expect(icon).toBeInTheDocument();
  });

  it('renders icon container with ACAPS Teal background', () => {
    const { container } = render(<GarageBranding />);
    const iconWrapper = container.querySelector('.bg-\\[\\#2D5773\\]');
    expect(iconWrapper).toBeInTheDocument();
  });

  it('renders wrench svg inside icon container', () => {
    const { container } = render(<GarageBranding />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
