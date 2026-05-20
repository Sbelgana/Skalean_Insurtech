import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  orientation?: 'horizontal' | 'vertical';
}

export function ButtonGroup({ orientation = 'horizontal', className, children, ...props }: ButtonGroupProps) {
  return (
    <div
      role="group"
      className={cn(
        'inline-flex',
        orientation === 'vertical' ? 'flex-col' : 'flex-row',
        '[&>button]:rounded-none',
        '[&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md',
        orientation === 'vertical' && '[&>button:first-child]:rounded-t-md [&>button:first-child]:rounded-l-none [&>button:last-child]:rounded-b-md [&>button:last-child]:rounded-r-none',
        '[&>button+button]:-ml-px',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
