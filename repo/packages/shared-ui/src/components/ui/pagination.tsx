'use client';
import { cn } from '../../lib/cn.js';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    if (totalPages <= 7) return i + 1;
    if (i === 0) return 1;
    if (i === 6) return totalPages;
    return currentPage - 2 + i;
  }).filter((p) => p >= 1 && p <= totalPages);

  return (
    <nav aria-label="Pagination" className={cn('flex items-center gap-1', className)}>
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Page precedente"
        className="px-3 py-1.5 text-sm rounded-md border border-border disabled:opacity-50 hover:bg-muted transition-colors"
      >
        &larr;
      </button>
      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onPageChange(page)}
          aria-label={`Page ${page}`}
          aria-current={currentPage === page ? 'page' : undefined}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md border transition-colors',
            currentPage === page
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border hover:bg-muted',
          )}
        >
          {page}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Page suivante"
        className="px-3 py-1.5 text-sm rounded-md border border-border disabled:opacity-50 hover:bg-muted transition-colors"
      >
        &rarr;
      </button>
    </nav>
  );
}
