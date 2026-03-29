'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, description, children, size = 'md', className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement;
    firstFocusRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }

      if (e.key === 'Tab') {
        const modal = overlayRef.current;
        if (!modal) return;
        const focusable = modal.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-desc' : undefined}
      ref={overlayRef}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — full-width sheet on mobile, centered card on sm+ */}
      <div
        className={cn(
          'relative w-full rounded-t-xl sm:rounded-lg border border-[#2A2A2E] bg-[#141414] shadow-2xl',
          'max-h-[90dvh] flex flex-col',
          'animate-slide-up',
          sizeClasses[size],
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-[#2A2A2E] flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2
              id="modal-title"
              className="text-base font-semibold text-[#E8E6E3] truncate"
            >
              {title}
            </h2>
            {description && (
              <p id="modal-desc" className="mt-0.5 text-sm text-[#A7A29A]">
                {description}
              </p>
            )}
          </div>
          <button
            ref={firstFocusRef}
            onClick={onClose}
            className={cn(
              'ml-4 flex-shrink-0 rounded p-1 text-[#A7A29A] hover:text-[#E8E6E3] hover:bg-[#2A2A2E]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]',
              'transition-colors duration-150'
            )}
            aria-label="Close dialog"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
