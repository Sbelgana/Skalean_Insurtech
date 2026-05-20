import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

interface SidebarProps extends HTMLAttributes<HTMLDivElement> {
  collapsed?: boolean;
  children?: ReactNode;
}

export function Sidebar({ collapsed = false, className, children, ...props }: SidebarProps) {
  return (
    <aside
      aria-label="Navigation principale"
      data-collapsed={collapsed}
      className={cn(
        'flex flex-col h-full bg-secondary text-secondary-foreground transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        className,
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

export function SidebarHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center px-4 py-3 border-b border-white/10', className)} {...props}>
      {children}
    </div>
  );
}

export function SidebarNav({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <nav className={cn('flex-1 overflow-y-auto py-2', className)} {...props}>
      {children}
    </nav>
  );
}

export function SidebarFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('border-t border-white/10 p-3', className)} {...props}>
      {children}
    </div>
  );
}
