'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production you'd send this to an error monitoring service
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center min-h-[300px] px-6 py-12 text-center"
        >
          <AlertTriangle size={32} className="text-[#C35B5B] mb-4" aria-hidden />
          <h2 className="font-serif text-xl font-semibold text-[#E8E6E3] mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-[#A7A29A] mb-6 max-w-sm">
            An unexpected error occurred in this section. Your data is safe — try refreshing.
          </p>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre className="text-left text-xs text-[#C35B5B] bg-[#141414] border border-[#2A2A2E] rounded p-3 mb-4 max-w-lg overflow-x-auto whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded bg-[#1B1B1D] border border-[#2A2A2E] text-sm text-[#E8E6E3] hover:border-[#C9A227] hover:text-[#C9A227] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
          >
            <RefreshCw size={14} aria-hidden />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
