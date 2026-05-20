import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer" htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        className={cn(
          'h-4 w-4 rounded border-border text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
      {label && <span className="text-sm font-medium text-foreground">{label}</span>}
    </label>
  );
}
