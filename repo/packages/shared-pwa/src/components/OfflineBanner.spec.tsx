/**
 * OfflineBanner spec -- shared-pwa
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineBanner } from './OfflineBanner';

beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('OfflineBanner', () => {
  it('renders nothing when online', () => {
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders banner when offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<OfflineBanner />);
    expect(screen.getByTestId('offline-banner')).toBeDefined();
  });

  it('renders banner when forceVisible=true', () => {
    render(<OfflineBanner forceVisible />);
    expect(screen.getByTestId('offline-banner')).toBeDefined();
  });

  it('shows custom offline message', () => {
    render(
      <OfflineBanner
        forceVisible
        messages={{ offlineMessage: 'Pas de connexion', reconnectingMessage: undefined }}
      />,
    );
    expect(screen.getByText('Pas de connexion')).toBeDefined();
  });

  it('shows reconnecting message when provided', () => {
    render(
      <OfflineBanner
        forceVisible
        messages={{
          offlineMessage: 'Hors ligne',
          reconnectingMessage: 'Reconnexion...',
        }}
      />,
    );
    expect(screen.getByText('Reconnexion...')).toBeDefined();
  });
});
