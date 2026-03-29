import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * EmptyState — every empty state must tell the user exactly what to do next.
 *
 * Bad: "No deals yet."
 * Good: "No active deals yet. Add your first target to begin screening for fit."
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-8 py-12',
        'bg-[#111111] border border-[#262626] rounded-[10px]',
        className
      )}
    >
      {Icon && (
        <div
          className="w-10 h-10 rounded-full bg-[#1A1A1A] border border-[#333333] flex items-center justify-center mb-4"
          aria-hidden
        >
          <Icon size={18} className="text-[#737373]" />
        </div>
      )}

      <h3 className="text-sm font-semibold text-[#E5E5E5] mb-2">{title}</h3>
      <p className="text-sm text-[#737373] max-w-[320px] leading-relaxed mb-6">{description}</p>

      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-3">
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="text-sm text-[#A3A3A3] hover:text-[#E5E5E5] underline underline-offset-2 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[#C9A227] hover:bg-[#E0B93B] text-black text-sm font-semibold transition-colors"
            >
              {primaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Inline empty state (for small panels) ───────────────────────────────────

export function InlineEmpty({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn(
        'px-4 py-6 text-center text-xs text-[#737373]',
        className
      )}
    >
      {message}
    </div>
  );
}
