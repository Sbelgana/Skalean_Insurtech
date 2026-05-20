import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: boolean;
}

export function DatePicker({ error, className, ...props }: DatePickerProps) {
  return (
    <input
      type="date"
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        error && 'border-error focus-visible:ring-error',
        className,
      )}
      {...props}
    />
  );
}
