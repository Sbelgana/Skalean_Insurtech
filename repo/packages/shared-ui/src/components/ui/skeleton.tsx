import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
}

export function Skeleton({ variant = 'rectangular', className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-muted',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'rounded h-4 w-full',
        variant === 'rectangular' && 'rounded-md',
        className,
      )}
      {...props}
    />
  );
}
