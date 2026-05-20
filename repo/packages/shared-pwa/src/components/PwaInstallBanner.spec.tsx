/**
 * PwaInstallBanner spec -- shared-pwa
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PwaInstallBanner } from './PwaInstallBanner';

beforeEach(() => {
  window.localStorage.clear();
});

describe('PwaInstallBanner', () => {
  it('renders nothing when canInstall is false and forceVisible not set', () => {
    const { container } = render(<PwaInstallBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders banner when forceVisible=true', () => {
    render(<PwaInstallBanner forceVisible />);
    expect(screen.getByTestId('pwa-install-banner')).toBeDefined();
  });

  it('shows custom messages', () => {
    const messages = {
      title: 'Installer maintenant',
      description: 'Acces rapide',
      installButton: 'OK',
      dismissButton: 'Non merci',
    };
    render(<PwaInstallBanner forceVisible messages={messages} />);
    expect(screen.getByText('Installer maintenant')).toBeDefined();
    expect(screen.getByText('OK')).toBeDefined();
    expect(screen.getByText('Non merci')).toBeDefined();
  });

  it('calls onDismissed when dismiss button clicked', () => {
    const onDismissed = vi.fn();
    render(<PwaInstallBanner forceVisible onDismissed={onDismissed} />);
    fireEvent.click(screen.getByTestId('dismiss-button'));
    expect(onDismissed).toHaveBeenCalled();
  });

  it('clicking install button does not throw', () => {
    render(<PwaInstallBanner forceVisible />);
    expect(() => fireEvent.click(screen.getByTestId('install-button'))).not.toThrow();
  });
});
