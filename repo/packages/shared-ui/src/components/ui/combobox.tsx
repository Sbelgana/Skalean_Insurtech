'use client';
import { useState } from 'react';
import { cn } from '../../lib/cn.js';

interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Combobox({ options, value, onValueChange, placeholder = 'Rechercher...', className, disabled }: ComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  );

  const selected = options.find((o) => o.value === value);

  return (
    <div className={cn('relative', className)}>
      <input
        type="text"
        value={open ? query : (selected?.label ?? '')}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover py-1 shadow-lg">
          {filtered.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent/10 focus:bg-accent/10"
                onMouseDown={() => { onValueChange?.(opt.value); setOpen(false); setQuery(''); }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
