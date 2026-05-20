'use client';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

type DrawerSide = 'left' | 'right' | 'bottom';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: DrawerSide;
  title?: string;
  children?: ReactNode;
  className?: string;
}

const sideClasses: Record<DrawerSide, string> = {
  left: 'left-0 top-0 h-full w-80 translate-x-[-100%] data-[open=true]:translate-x-0',
  right: 'right-0 top-0 h-full w-80 translate-x-[100%] data-[open=true]:translate-x-0',
  bottom: 'bottom-0 left-0 w-full h-auto translate-y-[100%] data-[open=true]:translate-y-0 rounded-t-2xl',
};

export function Drawer({ open, onClose, side = 'right', title, children, className }: DrawerProps) {
  return (
    <div className={cn('fixed inset-0 z-50', !open && 'pointer-events-none')}>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          aria-hidden="true"
          onClick={onClose}
        />
      )}
      <div
        data-open={open}
        className={cn(
          'fixed z-50 bg-card shadow-xl transition-transform duration-300 ease-in-out',
          sideClasses[side],
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="font-semibold text-card-foreground">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Fermer" className="text-muted-foreground hover:text-foreground">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
