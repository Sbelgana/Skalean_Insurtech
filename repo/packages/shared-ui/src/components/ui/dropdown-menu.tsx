'use client';

/**
 * DropdownMenu -- compound component API.
 * Reference : task-1.4.8 + task-1.4.14 Sprint 4 Phase 1
 */
import * as React from 'react';
import { cn } from '../../lib/cn.js';

// ---- Context ---------------------------------------------------------------

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  align: 'start' | 'end' | 'center';
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue>({
  open: false,
  setOpen: () => {},
  align: 'start',
});

// ---- DropdownMenu root -----------------------------------------------------

interface DropdownMenuProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function DropdownMenu({ children, defaultOpen = false }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, align: 'start' }}>
      <div ref={ref} className="relative inline-flex">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

// ---- DropdownMenuTrigger ---------------------------------------------------

interface DropdownMenuTriggerProps {
  asChild?: boolean;
  children: React.ReactElement | React.ReactNode;
  className?: string;
}

export function DropdownMenuTrigger({ asChild = false, children, className }: DropdownMenuTriggerProps) {
  const { setOpen, open } = React.useContext(DropdownMenuContext);
  const onClick = () => setOpen(!open);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, { onClick });
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}

// ---- DropdownMenuContent ---------------------------------------------------

interface DropdownMenuContentProps {
  align?: 'start' | 'end' | 'center';
  className?: string;
  children: React.ReactNode;
}

export function DropdownMenuContent({ align = 'start', className, children }: DropdownMenuContentProps) {
  const { open } = React.useContext(DropdownMenuContext);
  if (!open) return null;

  const alignClass = align === 'end' ? 'right-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0';

  return (
    <div
      role="menu"
      className={cn(
        'absolute top-full mt-1 z-50 min-w-[8rem] rounded-md border border-border bg-popover py-1 shadow-lg',
        alignClass,
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---- DropdownMenuLabel -----------------------------------------------------

interface DropdownMenuLabelProps {
  className?: string;
  children: React.ReactNode;
}

export function DropdownMenuLabel({ className, children }: DropdownMenuLabelProps) {
  return (
    <div className={cn('px-3 py-1.5 text-sm font-semibold text-foreground', className)}>
      {children}
    </div>
  );
}

// ---- DropdownMenuSeparator -------------------------------------------------

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn('my-1 h-px bg-border', className)} />;
}

// ---- DropdownMenuItem ------------------------------------------------------

interface DropdownMenuItemProps {
  onClick?: (() => void | Promise<void>) | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
  children: React.ReactNode;
}

export function DropdownMenuItem({ onClick, className, disabled = false, children }: DropdownMenuItemProps) {
  const { setOpen } = React.useContext(DropdownMenuContext);

  const handleClick = () => {
    if (disabled) return;
    void onClick?.();
    setOpen(false);
  };

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:bg-accent focus:text-accent-foreground focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-colors',
        className,
      )}
    >
      {children}
    </button>
  );
}
