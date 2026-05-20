'use client';

/**
 * Tooltip -- simple hover tooltip + compound sub-components API.
 * Reference : task-1.4.8 + task-1.4.14 Sprint 4 Phase 1
 */
import * as React from 'react';
import { cn } from '../../lib/cn.js';

// ---- Simple Tooltip (original API) ----------------------------------------

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

interface SimpleTooltipProps {
  content: string;
  children: React.ReactNode;
  side?: TooltipSide;
  className?: string;
}

const sideClasses: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export function Tooltip({ content, children, side = 'top', className }: SimpleTooltipProps) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={cn(
            'absolute z-50 whitespace-nowrap rounded-md bg-secondary px-3 py-1.5 text-xs text-secondary-foreground shadow-md',
            'animate-fade-in pointer-events-none',
            sideClasses[side],
            className,
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

// ---- Compound sub-component API (for Sidebar etc.) -----------------------

interface TooltipProviderContextValue {
  delayDuration: number;
}

const TooltipProviderContext = React.createContext<TooltipProviderContextValue>({ delayDuration: 700 });

interface TooltipProviderProps {
  delayDuration?: number;
  children: React.ReactNode;
}

export function TooltipProvider({ delayDuration = 700, children }: TooltipProviderProps) {
  return (
    <TooltipProviderContext.Provider value={{ delayDuration }}>
      {children}
    </TooltipProviderContext.Provider>
  );
}

// Context for the compound Tooltip
interface CompoundTooltipContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerId: string;
}

const CompoundTooltipContext = React.createContext<CompoundTooltipContextValue | null>(null);

interface CompoundTooltipProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
}

/**
 * CompoundTooltip -- used with TooltipTrigger + TooltipContent.
 * Exported as TooltipRoot for use when composing sub-components.
 */
export function TooltipRoot({ children, defaultOpen = false }: CompoundTooltipProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();
  return (
    <CompoundTooltipContext.Provider value={{ open, setOpen, triggerId: id }}>
      <div className="relative inline-flex">
        {children}
      </div>
    </CompoundTooltipContext.Provider>
  );
}

interface TooltipTriggerProps {
  asChild?: boolean;
  children: React.ReactElement | React.ReactNode;
  className?: string;
}

export function TooltipTrigger({ asChild = false, children, className }: TooltipTriggerProps) {
  const ctx = React.useContext(CompoundTooltipContext);
  if (!ctx) return <>{children}</>;
  const { setOpen } = ctx;

  const handlers = {
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, handlers);
  }
  return (
    <div className={cn('inline-flex', className)} {...handlers}>
      {children}
    </div>
  );
}

interface TooltipContentProps {
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}

export function TooltipContent({ side = 'top', className, children }: TooltipContentProps) {
  const ctx = React.useContext(CompoundTooltipContext);
  if (!ctx?.open) return null;

  return (
    <div
      role="tooltip"
      className={cn(
        'absolute z-50 whitespace-nowrap rounded-md bg-secondary px-3 py-1.5 text-xs text-secondary-foreground shadow-md',
        'pointer-events-none',
        sideClasses[side],
        className,
      )}
    >
      {children}
    </div>
  );
}
