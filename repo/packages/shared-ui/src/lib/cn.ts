/**
 * cn -- className utility (clsx + tailwind-merge)
 * Reference : task-1.4.8 Sprint 4 Phase 1
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
