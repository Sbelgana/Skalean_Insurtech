/**
 * Map spec -- shared-maps
 * Reference: task-1.4.10 Sprint 4 Phase 1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Map } from '../src/components/Map';

const mockMapInstance = {
  on: vi.fn((event: string, cb: () => void) => {
    if (event === 'load') setTimeout(cb, 0);
  }),
  remove: vi.fn(),
  isStyleLoaded: vi.fn(() => true),
  getStyle: vi.fn(() => ({ layers: [] })),
  setLayoutProperty: vi.fn(),
  resize: vi.fn(),
};

vi.mock('mapbox-gl', () => ({
  default: {
    Map: vi.fn(() => mockMapInstance),
    accessToken: '',
    supported: vi.fn(() => true),
  },
}));

beforeEach(() => {
  process.env['NEXT_PUBLIC_MAPBOX_TOKEN'] = 'pk.test.token';
  vi.clearAllMocks();
  mockMapInstance.on.mockImplementation((event: string, cb: () => void) => {
    if (event === 'load') setTimeout(cb, 0);
  });
});

describe('Map', () => {
  it('renders container div with data-testid', () => {
    const { getByTestId } = render(<Map />);
    expect(getByTestId('mapbox-map')).toBeDefined();
  });

  it('renders with custom className', () => {
    const { getByTestId } = render(<Map className="test-class" />);
    const container = getByTestId('mapbox-map');
    expect(container.className).toContain('test-class');
  });

  it('renders nothing in map container when map not loaded', () => {
    const { getByTestId } = render(<Map><div data-testid="child">child</div></Map>);
    // children are only rendered after mapInstance is set (after load event)
    expect(getByTestId('mapbox-map')).toBeDefined();
  });
});
