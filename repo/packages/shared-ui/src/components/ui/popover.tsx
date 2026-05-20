'use client';
import type { ReactNode } from 'react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/cn.js';

type PopoverSide = 'top' | 'bottom' | 'left' | 'right';

interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  side?: PopoverSide;
  className?: string;
}

const sideClasses: Record<PopoverSide, string> = {
  top: 'bottom-full left-0 mb-2',
  bottom: 'top-full left-0 mt-2',
  left: 'right-full top-0 mr-2',
  right: 'left-full top-0 ml-2',
};

export function Popover({ trigger, children, side = 'bottom', className }: PopoverProps) {
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
          className={cn(
            'absolute z-50 min-w-[180px] rounded-md border border-border bg-popover p-2 shadow-lg',
            'animate-fade-in',
            sideClasses[side],
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
