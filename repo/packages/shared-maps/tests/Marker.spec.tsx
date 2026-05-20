/**
 * Marker spec -- shared-maps
 * Reference: task-1.4.10 Sprint 4 Phase 1
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Marker } from '../src/components/Marker';

const mockSetLngLat = vi.fn().mockReturnThis();
const mockAddTo = vi.fn().mockReturnThis();
const mockRemove = vi.fn();
const mockGetElement = vi.fn(() => document.createElement('div'));

vi.mock('mapbox-gl', () => ({
  default: {
    Marker: vi.fn(() => ({
      setLngLat: mockSetLngLat,
      addTo: mockAddTo,
      remove: mockRemove,
      getElement: mockGetElement,
      setPopup: vi.fn().mockReturnThis(),
      on: vi.fn(),
    })),
    Popup: vi.fn(() => ({
      setHTML: vi.fn().mockReturnThis(),
      offset: 25,
    })),
  },
}));

// Mock MapContext to provide a fake map
vi.mock('../src/components/Map', () => ({
  useMapboxMap: vi.fn(() => ({
    on: vi.fn(),
    remove: vi.fn(),
  })),
}));

describe('Marker', () => {
  it('renders null (no DOM element)', () => {
    const { container } = render(<Marker position={[-7.62, 33.58]} />);
    expect(container.firstChild).toBeNull();
  });

  it('creates marker at given position', async () => {
    const { default: mapboxgl } = await import('mapbox-gl');
    render(<Marker position={[-7.62, 33.58]} color="#E95D2C" />);
    expect(mapboxgl.Marker).toHaveBeenCalled();
    expect(mockSetLngLat).toHaveBeenCalledWith([-7.62, 33.58]);
  });
});
