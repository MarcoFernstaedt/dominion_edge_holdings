import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variantClasses = {
  primary:
    'bg-[#D4AF37] hover:bg-[#B89220] text-black font-semibold border border-[#D4AF37] hover:border-[#B89220]',
  secondary:
    'bg-[#1B1B1D] hover:bg-[#232327] text-[#E8E6E3] border border-[#2A2A2E] hover:border-[#3A3A3E]',
  ghost:
    'bg-transparent hover:bg-[#1B1B1D] text-[#A7A29A] hover:text-[#E8E6E3] border border-transparent',
  danger:
    'bg-transparent hover:bg-[#C35B5B20] text-[#C35B5B] border border-[#C35B5B40] hover:border-[#C35B5B]',
  outline:
    'bg-transparent hover:bg-[#D4AF3710] text-[#D4AF37] border border-[#D4AF3740] hover:border-[#D4AF37]',
};

const sizeClasses = {
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-sm px-5 py-2.5 gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded transition-colors duration-150',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0B0C]',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
