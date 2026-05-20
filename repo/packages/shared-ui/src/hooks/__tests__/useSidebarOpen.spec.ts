/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useSidebarOpen } from '../useSidebarOpen';

/**
 * localStorage stub -- provides a Map-backed storage with all Web Storage methods.
 * Using vi.stubGlobal makes this immune to environment/jsdom gaps.
 */
function makeLocalStorageStub() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    removeItem: vi.fn((key: string) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
    key: vi.fn((index: number) => [...store.keys()][index] ?? null),
    get length() { return store.size; },
  };
}

describe('useSidebarOpen', () => {
  let storageMock: ReturnType<typeof makeLocalStorageStub>;

  beforeEach(() => {
    storageMock = makeLocalStorageStub();
    vi.stubGlobal('localStorage', storageMock);
    // Reset store then clear spy -- any setItem calls from setState are not part of the test
    useSidebarOpen.setState({ isOpen: true, isDrawerOpen: false, hasHydrated: false });
    storageMock.setItem.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initial state: isOpen=true, isDrawerOpen=false', () => {
    const state = useSidebarOpen.getState();
    expect(state.isOpen).toBe(true);
    expect(state.isDrawerOpen).toBe(false);
  });

  it('toggle() flips isOpen', () => {
    expect(useSidebarOpen.getState().isOpen).toBe(true);
    useSidebarOpen.getState().toggle();
    expect(useSidebarOpen.getState().isOpen).toBe(false);
    useSidebarOpen.getState().toggle();
    expect(useSidebarOpen.getState().isOpen).toBe(true);
  });

  it('setOpen() sets isOpen directly', () => {
    useSidebarOpen.getState().setOpen(false);
    expect(useSidebarOpen.getState().isOpen).toBe(false);
  });

  it('persists isOpen to localStorage', () => {
    useSidebarOpen.getState().setOpen(false);
    // Zustand persist calls storage.setItem via the custom makeSafeStorage adapter
    const call = storageMock.setItem.mock.calls.find(([k]) => k === 'skalean-sidebar-open');
    expect(call).toBeDefined();
    const stored = call?.[1] ?? '{}';
    expect(stored).toContain('"isOpen":false');
  });

  it('drawer state is independent of collapse state', () => {
    useSidebarOpen.getState().setDrawerOpen(true);
    expect(useSidebarOpen.getState().isDrawerOpen).toBe(true);
    expect(useSidebarOpen.getState().isOpen).toBe(true);
  });

  it('toggleDrawer() flips isDrawerOpen', () => {
    useSidebarOpen.getState().toggleDrawer();
    expect(useSidebarOpen.getState().isDrawerOpen).toBe(true);
    useSidebarOpen.getState().toggleDrawer();
    expect(useSidebarOpen.getState().isDrawerOpen).toBe(false);
  });

  it('setHydrated() updates hasHydrated flag', () => {
    useSidebarOpen.getState().setHydrated(true);
    expect(useSidebarOpen.getState().hasHydrated).toBe(true);
  });
});
