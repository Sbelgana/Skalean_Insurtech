'use client';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        aria-describedby={description ? 'dialog-desc' : undefined}
        className={cn(
          'relative z-50 mx-4 w-full max-w-lg rounded-lg bg-card p-6 shadow-xl',
          className,
        )}
      >
        {title && <h2 id="dialog-title" className="text-lg font-semibold text-card-foreground mb-2">{title}</h2>}
        {description && <p id="dialog-desc" className="text-sm text-muted-foreground mb-4">{description}</p>}
        {children}
      </div>
    </div>
  );
}
