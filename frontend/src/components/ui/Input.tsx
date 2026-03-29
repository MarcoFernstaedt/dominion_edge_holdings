import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded bg-[#1B1B1D] border border-[#2A2A2E] text-[#E8E6E3] text-sm px-3 py-2',
            'placeholder:text-[#A7A29A60]',
            'focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'transition-colors duration-150',
            error && 'border-[#C35B5B] focus:border-[#C35B5B] focus:ring-[#C35B5B]',
            className
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          {...props}
        />
        {hint && !error && (
          <p className="text-xs text-[#A7A29A]">{hint}</p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-[#C35B5B]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A]"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded bg-[#1B1B1D] border border-[#2A2A2E] text-[#E8E6E3] text-sm px-3 py-2',
            'placeholder:text-[#A7A29A60]',
            'focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'transition-colors duration-150 resize-vertical min-h-[80px]',
            error && 'border-[#C35B5B]',
            className
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          {...props}
        />
        {hint && !error && <p className="text-xs text-[#A7A29A]">{hint}</p>}
        {error && (
          <p id={errorId} className="text-xs text-[#C35B5B]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A]"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded bg-[#1B1B1D] border border-[#2A2A2E] text-[#E8E6E3] text-sm px-3 py-2',
            'focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'transition-colors duration-150',
            error && 'border-[#C35B5B]',
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#1B1B1D]">
              {opt.label}
            </option>
          ))}
        </select>
        {hint && !error && <p className="text-xs text-[#A7A29A]">{hint}</p>}
        {error && (
          <p className="text-xs text-[#C35B5B]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
