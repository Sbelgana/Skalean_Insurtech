'use client';

/**
 * Avatar -- simple avatar component + sub-component API (AvatarImage, AvatarFallback).
 * Reference : task-1.4.8 + task-1.4.14 Sprint 4 Phase 1
 */
import * as React from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

// ---- Original single-component API ----------------------------------------

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarSingleProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: AvatarSize;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((n) => n[0] ?? '').join('').toUpperCase();
}

export function AvatarSingle({ src, alt = '', fallback, size = 'md', className, ...props }: AvatarSingleProps) {
  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden',
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span className="font-medium text-muted-foreground select-none">
          {fallback ? getInitials(fallback) : alt[0]?.toUpperCase() ?? '?'}
        </span>
      )}
    </div>
  );
}

// ---- Compound sub-component API -------------------------------------------

interface AvatarContextValue {
  src?: string;
  alt?: string;
  hasError: boolean;
  setHasError: (v: boolean) => void;
}

const AvatarContext = React.createContext<AvatarContextValue>({
  hasError: false,
  setHasError: () => {},
});

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function Avatar({ className, children, ...props }: AvatarProps) {
  const [hasError, setHasError] = React.useState(false);
  return (
    <AvatarContext.Provider value={{ hasError, setHasError }}>
      <div
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </AvatarContext.Provider>
  );
}

interface AvatarImageProps extends HTMLAttributes<HTMLImageElement> {
  src?: string | undefined;
  alt?: string | undefined;
}

export function AvatarImage({ src, alt = '', className, ...props }: AvatarImageProps) {
  const { setHasError } = React.useContext(AvatarContext);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={cn('h-full w-full object-cover', className)}
      {...props}
    />
  );
}

interface AvatarFallbackProps extends HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
}

export function AvatarFallback({ className, children, ...props }: AvatarFallbackProps) {
  const { hasError, src } = React.useContext(AvatarContext);
  if (src && !hasError) return null;
  return (
    <span
      className={cn('font-medium text-muted-foreground select-none', className)}
      {...props}
    >
      {children}
    </span>
  );
}
