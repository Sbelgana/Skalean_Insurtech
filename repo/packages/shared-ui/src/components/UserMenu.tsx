'use client';

/**
 * UserMenu -- dropdown avatar menu with profile / logout / role display.
 * Reference : task-1.4.14 Sprint 4 Phase 1
 */
import * as React from 'react';
import { LogOut, User as UserIcon, Settings, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu.js';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar.js';
import { cn } from '../lib/cn.js';

export interface UserMenuUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  roles?: string[];
}

interface UserMenuProps {
  user: UserMenuUser;
  onLogout?: (() => void | Promise<void>) | undefined;
  onProfile?: (() => void) | undefined;
  onSettings?: (() => void) | undefined;
  className?: string | undefined;
}

function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function UserMenu({ user, onLogout, onProfile, onSettings, className }: UserMenuProps) {
  const t = useTranslations('userMenu');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('label' as Parameters<typeof t>[0], { fallback: 'Menu utilisateur' } as Parameters<typeof t>[1])}
          className={cn(
            'inline-flex items-center gap-2 rounded-full',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src={user.avatarUrl} alt={user.fullName} />
            <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="font-semibold truncate">{user.fullName}</span>
          <span className="text-xs text-muted-foreground truncate">{user.email}</span>
          {user.roles && user.roles.length > 0 && (
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" aria-hidden="true" />
              {user.roles.join(', ')}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {onProfile && (
          <DropdownMenuItem onClick={onProfile}>
            <UserIcon className="me-2 h-4 w-4" aria-hidden="true" />
            {t('profile' as Parameters<typeof t>[0], { fallback: 'Mon profil' } as Parameters<typeof t>[1])}
          </DropdownMenuItem>
        )}
        {onSettings && (
          <DropdownMenuItem onClick={onSettings}>
            <Settings className="me-2 h-4 w-4" aria-hidden="true" />
            {t('settings' as Parameters<typeof t>[0], { fallback: 'Parametres' } as Parameters<typeof t>[1])}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onLogout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="me-2 h-4 w-4" aria-hidden="true" />
          {t('logout' as Parameters<typeof t>[0], { fallback: 'Se deconnecter' } as Parameters<typeof t>[1])}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
