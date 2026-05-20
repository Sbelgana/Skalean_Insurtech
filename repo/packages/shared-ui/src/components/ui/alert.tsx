import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  children?: ReactNode;
}

const variantClasses: Record<AlertVariant, string> = {
  info: 'border-info bg-info/10 text-info',
  success: 'border-success bg-success/10 text-success',
  warning: 'border-warning bg-warning/10 text-warning',
  error: 'border-error bg-error/10 text-error',
};

export function Alert({ variant = 'info', title, className, children, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'relative w-full rounded-lg border p-4',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {title && <h5 className="mb-1 font-medium">{title}</h5>}
      <div className="text-sm">{children}</div>
    </div>
  );
}
