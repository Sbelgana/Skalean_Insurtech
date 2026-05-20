/**
 * LogoSkalean -- inline SVG logo for Skalean InsurTech.
 * Inline SVG avoids extra HTTP request and supports theming via currentColor.
 * Reference : task-1.4.14 Sprint 4 Phase 1
 */
import * as React from 'react';
import { cn } from '../lib/cn.js';

interface LogoSkaleanProps {
  className?: string;
}

export function LogoSkalean({ className }: LogoSkaleanProps) {
  return (
    <svg
      viewBox="0 0 120 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Skalean InsurTech"
      role="img"
      className={cn('h-8 w-auto', className)}
    >
      {/* Geometric mark -- stylised S shield */}
      <rect x="2" y="2" width="24" height="28" rx="4" fill="currentColor" opacity="0.15" />
      <path
        d="M8 20 C8 20 10 22 14 20 C18 18 18 14 14 12 C10 10 10 8 14 8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Wordmark */}
      <text
        x="32"
        y="22"
        fontFamily="system-ui, sans-serif"
        fontWeight="700"
        fontSize="14"
        fill="currentColor"
        letterSpacing="0.5"
      >
        Skalean
      </text>
    </svg>
  );
}
