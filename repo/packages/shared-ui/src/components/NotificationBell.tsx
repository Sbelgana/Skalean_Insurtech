'use client';

/**
 * NotificationBell -- placeholder bell icon with unread badge.
 * Sprint 9 will connect SSE /api/v1/notifications/stream.
 * Reference : task-1.4.14 Sprint 4 Phase 1
 */
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu.js';
import { cn } from '../lib/cn.js';

interface NotificationBellProps {
  unreadCount?: number;
  className?: string;
}

export function NotificationBell({ unreadCount = 0, className }: NotificationBellProps) {
  const t = useTranslations('notifications');
  const display = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('label' as Parameters<typeof t>[0], { fallback: 'Notifications' } as Parameters<typeof t>[1])}
          className={cn(
            'relative inline-flex h-10 w-10 items-center justify-center rounded-md',
            'hover:bg-accent transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-label={`${unreadCount} notifications non lues`}
              className="absolute top-1 end-1 min-w-[1.25rem] h-5 rounded-full bg-destructive px-1 text-[10px] leading-5 font-semibold text-destructive-foreground text-center"
            >
              {display}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>
          {t('title' as Parameters<typeof t>[0], { fallback: 'Notifications' } as Parameters<typeof t>[1])}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="p-6 text-center text-sm text-muted-foreground">
          {t('empty' as Parameters<typeof t>[0], {
            fallback: 'Pas de notifications. Sprint 9 ajoutera les notifications temps reel.',
          } as Parameters<typeof t>[1])}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
