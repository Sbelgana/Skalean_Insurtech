import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

type StackDirection = 'row' | 'col';
type StackAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
type GapSize = 1 | 2 | 3 | 4 | 6 | 8;

interface StackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: StackDirection;
  align?: StackAlign;
  justify?: StackJustify;
  gap?: GapSize;
  wrap?: boolean;
  children?: ReactNode;
}

export function Stack({
  direction = 'col',
  align = 'stretch',
  justify = 'start',
  gap = 4,
  wrap = false,
  className,
  children,
  ...props
}: StackProps) {
  return (
    <div
      className={cn(
        'flex',
        direction === 'row' ? 'flex-row' : 'flex-col',
        {
          'items-start': align === 'start',
          'items-center': align === 'center',
          'items-end': align === 'end',
          'items-stretch': align === 'stretch',
          'items-baseline': align === 'baseline',
          'justify-start': justify === 'start',
          'justify-center': justify === 'center',
          'justify-end': justify === 'end',
          'justify-between': justify === 'between',
          'justify-around': justify === 'around',
          'justify-evenly': justify === 'evenly',
          'flex-wrap': wrap,
          'gap-1': gap === 1,
          'gap-2': gap === 2,
          'gap-3': gap === 3,
          'gap-4': gap === 4,
          'gap-6': gap === 6,
          'gap-8': gap === 8,
        },
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
