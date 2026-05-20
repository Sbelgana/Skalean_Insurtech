/**
 * E2E fixtures -- viewport presets
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */

export const VIEWPORTS = {
  mobile: { width: 320, height: 568 },
  mobileLarge: { width: 414, height: 896 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
  desktopLarge: { width: 1440, height: 900 },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;
