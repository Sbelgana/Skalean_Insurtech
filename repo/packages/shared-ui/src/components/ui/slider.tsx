import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  showValue?: boolean;
}

export function Slider({ showValue = false, className, ...props }: SliderProps) {
  return (
    <div className="flex items-center gap-3 w-full">
      <input
        type="range"
        className={cn(
          'flex-1 h-2 cursor-pointer appearance-none rounded-lg bg-border',
          'accent-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
      {showValue && props.value !== undefined && (
        <span className="text-sm text-muted-foreground w-8 text-right">{String(props.value)}</span>
      )}
    </div>
  );
}
