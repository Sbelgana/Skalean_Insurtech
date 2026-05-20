import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UserMenu } from '../UserMenu';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, o?: { fallback?: string }) => o?.fallback ?? k,
}));

describe('UserMenu', () => {
  const user = {
    id: '1',
    fullName: 'Mohammed Alami',
    email: 'm@x.ma',
    roles: ['broker_admin'],
  };

  it('renders avatar with initials', () => {
    render(<UserMenu user={user} />);
    expect(screen.getByText('MA')).toBeInTheDocument();
  });

  it('opens dropdown and shows logout option', async () => {
    const onLogout = vi.fn();
    render(<UserMenu user={user} onLogout={onLogout} />);
    fireEvent.click(screen.getByLabelText(/menu utilisateur/i));
    const logout = await screen.findByText(/se deconnecter/i);
    fireEvent.click(logout);
    expect(onLogout).toHaveBeenCalled();
  });

  it('displays user roles in dropdown', async () => {
    render(<UserMenu user={user} />);
    fireEvent.click(screen.getByLabelText(/menu utilisateur/i));
    expect(await screen.findByText(/broker_admin/i)).toBeInTheDocument();
  });

  it('shows profile option when onProfile provided', async () => {
    const onProfile = vi.fn();
    render(<UserMenu user={user} onProfile={onProfile} />);
    fireEvent.click(screen.getByLabelText(/menu utilisateur/i));
    const profileBtn = await screen.findByText(/mon profil/i);
    fireEvent.click(profileBtn);
    expect(onProfile).toHaveBeenCalled();
  });
});
