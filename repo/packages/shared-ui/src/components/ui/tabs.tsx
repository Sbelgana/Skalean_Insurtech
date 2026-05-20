'use client';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { cn } from '../../lib/cn.js';

interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function Tabs({ items, defaultValue, value: controlledValue, onValueChange, className }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? items[0]?.value ?? '');
  const active = controlledValue ?? internalValue;

  function handleChange(val: string) {
    setInternalValue(val);
    onValueChange?.(val);
  }

  const activeItem = items.find((i) => i.value === active);

  return (
    <div className={cn('w-full', className)}>
      <div role="tablist" className="flex border-b border-border">
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active === item.value}
            aria-controls={`tab-panel-${item.value}`}
            disabled={item.disabled}
            onClick={() => handleChange(item.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2',
              active === item.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
              item.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        id={`tab-panel-${active}`}
        role="tabpanel"
        className="mt-4"
      >
        {activeItem?.content}
      </div>
    </div>
  );
}
