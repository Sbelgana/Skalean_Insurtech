'use client';

/**
 * Sheet -- slide-in panel compound component.
 * Provides Sheet / SheetTrigger / SheetContent / SheetTitle / SheetClose.
 * Reference : task-1.4.14 Sprint 4 Phase 1
 */
import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn.js';

type Side = 'top' | 'right' | 'bottom' | 'start' | 'left';

interface SheetContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheet(): SheetContextValue {
  const ctx = React.useContext(SheetContext);
  if (!ctx) throw new Error('[Sheet] must be used inside <Sheet>');
  return ctx;
}

// ---- Sheet root -----------------------------------------------------------

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function Sheet({ open: controlledOpen, onOpenChange, defaultOpen = false, children }: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  // Keyboard: close on Escape
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleOpenChange(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, handleOpenChange]);

  return (
    <SheetContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
}

// ---- SheetTrigger ---------------------------------------------------------

interface SheetTriggerProps {
  asChild?: boolean;
  children: React.ReactElement | React.ReactNode;
  className?: string;
}

export function SheetTrigger({ asChild = false, children, className }: SheetTriggerProps) {
  const { onOpenChange } = useSheet();

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      onClick: (e: React.MouseEvent) => {
        (children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>).props.onClick?.(e);
        onOpenChange(true);
      },
    });
  }

  return (
    <button type="button" className={className} onClick={() => onOpenChange(true)}>
      {children}
    </button>
  );
}

// ---- SheetContent ---------------------------------------------------------

const sideClasses: Record<Side, string> = {
  start: 'inset-y-0 start-0 h-full translate-x-[-100%] data-[open=true]:translate-x-0 rtl:translate-x-[100%] rtl:data-[open=true]:translate-x-0',
  left: 'inset-y-0 left-0 h-full translate-x-[-100%] data-[open=true]:translate-x-0',
  right: 'inset-y-0 right-0 h-full translate-x-[100%] data-[open=true]:translate-x-0',
  top: 'inset-x-0 top-0 w-full translate-y-[-100%] data-[open=true]:translate-y-0',
  bottom: 'inset-x-0 bottom-0 w-full translate-y-[100%] data-[open=true]:translate-y-0',
};

interface SheetContentProps {
  side?: Side;
  className?: string;
  children: React.ReactNode;
}

export function SheetContent({ side = 'right', className, children }: SheetContentProps) {
  const { open, onOpenChange } = useSheet();

  if (!open) return null;

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />
      {/* panel */}
      <div
        role="dialog"
        aria-modal="true"
        data-open={open}
        className={cn(
          'fixed z-50 bg-background shadow-xl transition-transform duration-300 ease-in-out',
          sideClasses[side],
          className,
        )}
      >
        <button
          type="button"
          aria-label="Fermer"
          onClick={() => onOpenChange(false)}
          className="absolute end-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        {children}
      </div>
    </>
  );
}

// ---- SheetTitle -----------------------------------------------------------

interface SheetTitleProps {
  className?: string;
  children: React.ReactNode;
}

export function SheetTitle({ className, children }: SheetTitleProps) {
  return (
    <h2 className={cn('text-lg font-semibold text-foreground', className)}>
      {children}
    </h2>
  );
}

// ---- SheetClose -----------------------------------------------------------

interface SheetCloseProps {
  asChild?: boolean;
  children?: React.ReactElement | React.ReactNode;
  className?: string;
}

export function SheetClose({ asChild = false, children, className }: SheetCloseProps) {
  const { onOpenChange } = useSheet();

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      onClick: () => onOpenChange(false),
    });
  }

  return (
    <button type="button" className={className} onClick={() => onOpenChange(false)}>
      {children}
    </button>
  );
}
