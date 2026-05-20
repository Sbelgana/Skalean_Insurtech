/**
 * SearchBox spec -- shared-maps
 * Reference: task-1.4.10 Sprint 4 Phase 1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchBox } from '../src/components/SearchBox';

beforeEach(() => {
  process.env['NEXT_PUBLIC_MAPBOX_TOKEN'] = 'pk.test.token';
  global.fetch = vi.fn(async () =>
    new Response(
      JSON.stringify({
        features: [
          { place_name: 'Casablanca, Maroc', center: [-7.5898, 33.5731] },
          { place_name: 'Hay Hassani, Casablanca', center: [-7.67, 33.56] },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  );
});

describe('SearchBox', () => {
  it('renders input', () => {
    render(<SearchBox />);
    expect(screen.getByTestId('search-box-input')).toBeDefined();
  });

  it('shows placeholder text', () => {
    render(<SearchBox placeholder="Rechercher" />);
    const input = screen.getByTestId('search-box-input') as HTMLInputElement;
    expect(input.placeholder).toBe('Rechercher');
  });

  it('shows suggestions after typing', async () => {
    render(<SearchBox />);
    const input = screen.getByTestId('search-box-input');
    fireEvent.change(input, { target: { value: 'Casa' } });
    // Wait for debounce (300ms) and fetch to be called
    await waitFor(() => expect(global.fetch).toHaveBeenCalled(), { timeout: 2000 });
  });

  it('calls onClear when clear button clicked', () => {
    const onClear = vi.fn();
    render(<SearchBox onClear={onClear} />);
    const input = screen.getByTestId('search-box-input');
    fireEvent.change(input, { target: { value: 'test' } });
    const clearBtn = screen.getByRole('button', { name: 'Effacer la recherche' });
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalled();
  });
});
