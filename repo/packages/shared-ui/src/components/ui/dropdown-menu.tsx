'use client';
import type { ReactNode } from 'react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/cn.js';

interface DropdownItem {
  label: string;
  value: string;
  icon?: ReactNode;
  disabled?: boolean;
  separator?: boolean;
}

interface DropdownMenuProps {
  trigger: ReactNode;
  items: DropdownItem[];
  onSelect?: (value: string) => void;
  className?: string;
  align?: 'left' | 'right';
}

export function DropdownMenu({ trigger, items, onSelect, className, align = 'left' }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-flex">
      <div onClick={() => setOpen((o) => !o)} style={{ cursor: 'pointer' }}>
        {trigger}
      </div>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 mt-1 min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-lg',
            'animate-fade-in',
            align === 'right' ? 'right-0' : 'left-0',
            'top-full',
            className,
          )}
        >
          {items.map((item, idx) => (
            item.separator ? (
              <div key={idx} className="my-1 h-px bg-border" role="separator" />
            ) : (
              <button
                key={item.value}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => { onSelect?.(item.value); setOpen(false); }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground',
                  'hover:bg-muted focus:bg-muted',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}
