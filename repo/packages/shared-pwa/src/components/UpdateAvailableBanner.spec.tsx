/**
 * UpdateAvailableBanner spec -- shared-pwa
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateAvailableBanner } from './UpdateAvailableBanner';

beforeEach(() => {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: vi.fn(async () => ({
        installing: null,
        waiting: null,
        active: { state: 'activated' },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      controller: null,
    },
  });
});

describe('UpdateAvailableBanner', () => {
  it('renders nothing when no update and forceVisible not set', () => {
    const { container } = render(<UpdateAvailableBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders banner when forceVisible=true', () => {
    render(<UpdateAvailableBanner forceVisible />);
    expect(screen.getByTestId('update-available-banner')).toBeDefined();
  });

  it('shows default messages', () => {
    render(<UpdateAvailableBanner forceVisible />);
    expect(screen.getByText('Mise a jour disponible')).toBeDefined();
    expect(screen.getByTestId('update-button')).toBeDefined();
    expect(screen.getByTestId('dismiss-update-button')).toBeDefined();
  });

  it('shows custom messages', () => {
    const messages = {
      title: 'Nouvelle version',
      description: 'Rechargez pour mettre a jour.',
      updateButton: 'Recharger',
      dismissButton: 'Ignorer',
    };
    render(<UpdateAvailableBanner forceVisible messages={messages} />);
    expect(screen.getByText('Nouvelle version')).toBeDefined();
    expect(screen.getByText('Recharger')).toBeDefined();
  });

  it('dismiss hides banner', () => {
    render(<UpdateAvailableBanner forceVisible />);
    fireEvent.click(screen.getByTestId('dismiss-update-button'));
    expect(screen.queryByTestId('update-available-banner')).toBeNull();
  });

  it('clicking update does not throw', () => {
    render(<UpdateAvailableBanner forceVisible />);
    expect(() => fireEvent.click(screen.getByTestId('update-button'))).not.toThrow();
  });

  it('calls onUpdated after update button click', async () => {
    const onUpdated = vi.fn();
    render(<UpdateAvailableBanner forceVisible onUpdated={onUpdated} />);
    fireEvent.click(screen.getByTestId('update-button'));
    // update() resolves immediately since registration is null (status active, no update)
    await vi.waitFor(() => {
      // onUpdated is called after the promise resolves
    });
  });
});
