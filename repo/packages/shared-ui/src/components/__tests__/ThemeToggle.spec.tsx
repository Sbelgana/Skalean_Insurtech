import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemeToggle } from '../ThemeToggle';

const setTheme = vi.fn();
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light', setTheme }) }));
vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, o?: { fallback?: string }) => o?.fallback ?? k,
}));

describe('ThemeToggle', () => {
  it('renders after mount (mounted guard)', async () => {
    render(<ThemeToggle />);
    await waitFor(() => expect(screen.getByLabelText(/theme/i)).toBeInTheDocument());
  });

  it('shows 3 theme options in dropdown', async () => {
    render(<ThemeToggle />);
    await waitFor(() => expect(screen.getByLabelText(/theme/i)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/theme/i));
    expect(await screen.findByText(/clair/i)).toBeInTheDocument();
    expect(screen.getByText(/sombre/i)).toBeInTheDocument();
    expect(screen.getByText(/systeme/i)).toBeInTheDocument();
  });

  it('calls setTheme with "dark"', async () => {
    render(<ThemeToggle />);
    await waitFor(() => expect(screen.getByLabelText(/theme/i)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/theme/i));
    fireEvent.click(await screen.findByText(/sombre/i));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('calls setTheme with "system"', async () => {
    render(<ThemeToggle />);
    await waitFor(() => expect(screen.getByLabelText(/theme/i)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/theme/i));
    fireEvent.click(await screen.findByText(/systeme/i));
    expect(setTheme).toHaveBeenCalledWith('system');
  });
});
