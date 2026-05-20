import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

interface NavLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  active?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

export function NavLink({ active = false, icon, className, children, ...props }: NavLinkProps) {
  return (
    <a
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors',
        'hover:bg-white/10',
        active ? 'bg-white/15 text-white' : 'text-white/70',
        className,
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </a>
  );
}
