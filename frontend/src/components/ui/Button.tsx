import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-[#C9A227] hover:bg-[#E0B93B] active:bg-[#A8841A] text-black font-semibold border border-[#C9A227] hover:border-[#E0B93B]',
  secondary:
    'bg-[#1A1A1A] hover:bg-[#222222] text-[#E5E5E5] border border-[#333333] hover:border-[#404040]',
  ghost:
    'bg-transparent hover:bg-[#1A1A1A] text-[#A3A3A3] hover:text-[#E5E5E5] border border-transparent hover:border-[#262626]',
  danger:
    'bg-transparent hover:bg-[#D6454518] text-[#D64545] border border-[#D6454538] hover:border-[#D64545]',
  outline:
    'bg-transparent hover:bg-[#C9A22712] text-[#C9A227] border border-[#C9A22740] hover:border-[#C9A22780]',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm:   'text-xs px-3 py-1.5 gap-1.5 rounded-[8px]',
  md:   'text-sm px-4 py-2 gap-2 rounded-[8px]',
  lg:   'text-sm px-5 py-2.5 gap-2 rounded-[8px]',
  icon: 'p-2 rounded-[8px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors duration-150',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span
            className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin flex-shrink-0"
            aria-hidden
          />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
