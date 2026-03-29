import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  context?: string;
  /** Primary CTA rendered in the header */
  primaryAction?: React.ReactNode;
  /** Secondary CTA rendered in the header */
  secondaryAction?: React.ReactNode;
  /** Optional icon placed beside the title */
  icon?: LucideIcon;
  className?: string;
}

/**
 * PageHeader — top of every major page.
 * Renders: title · subtitle · optional context chip · actions
 * Rule: one dominant action, one secondary max.
 */
export function PageHeader({
  title,
  subtitle,
  context,
  primaryAction,
  secondaryAction,
  icon: Icon,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-6', className)}>
      {/* Context chip */}
      {context && (
        <div className="text-[10px] font-medium tracking-[0.12em] uppercase text-[#C9A227] mb-2">
          {context}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <Icon
              size={22}
              className="text-[#737373] flex-shrink-0 mt-1"
              aria-hidden
            />
          )}
          <div className="min-w-0">
            <h1 className="font-serif text-[28px] font-semibold text-[#E5E5E5] leading-tight truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-[#737373] mt-1 leading-snug">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {(primaryAction || secondaryAction) && (
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            {secondaryAction}
            {primaryAction}
          </div>
        )}
      </div>
    </header>
  );
}

// ─── Section header (sub-sections within a page) ─────────────────────────────

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  action,
  icon: Icon,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3 mb-4', className)}>
      <div className="flex items-center gap-2 min-w-0">
        {Icon && (
          <Icon size={12} className="text-[#C9A227] flex-shrink-0" aria-hidden />
        )}
        <div className="min-w-0">
          <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#737373]">
            {title}
          </div>
          {description && (
            <div className="text-xs text-[#737373] mt-0.5">{description}</div>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
