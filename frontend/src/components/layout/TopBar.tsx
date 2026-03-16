'use client';

import { Search, Bell, Keyboard, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

interface TopBarProps {
  onSearchOpen: () => void;
  onMobileMenuOpen: () => void;
  title?: string;
}

export function TopBar({ onSearchOpen, onMobileMenuOpen, title }: TopBarProps) {
  const notifications = useAppStore((s) => s.notifications);
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <header
      className="h-12 flex items-center justify-between px-4 border-b border-[#2A2A2E] bg-[#0B0B0C] flex-shrink-0"
      role="banner"
    >
      <div className="flex items-center gap-3">
        {/* Mobile hamburger — hidden on md+ */}
        <button
          onClick={onMobileMenuOpen}
          className={cn(
            'md:hidden flex items-center justify-center w-8 h-8 rounded',
            'text-[#A7A29A] hover:text-[#E8E6E3] hover:bg-[#1B1B1D] transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]'
          )}
          aria-label="Open navigation menu"
          aria-haspopup="dialog"
        >
          <Menu size={16} aria-hidden />
        </button>

        {title && (
          <span className="text-sm font-medium text-[#A7A29A]">{title}</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Search / Command Palette trigger */}
        <button
          onClick={onSearchOpen}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded text-sm text-[#A7A29A]',
            'hover:text-[#E8E6E3] hover:bg-[#1B1B1D] transition-colors duration-150',
            'border border-transparent hover:border-[#2A2A2E]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]'
          )}
          aria-label="Open command palette (Ctrl+K)"
          aria-keyshortcuts="Control+k Meta+k"
        >
          <Search size={14} aria-hidden />
          <span className="hidden sm:inline text-xs">Search</span>
          <kbd
            className="hidden sm:flex items-center gap-0.5 text-[9px] bg-[#1B1B1D] border border-[#2A2A2E] rounded px-1 py-0.5 ml-1"
            aria-hidden="true"
          >
            <span>⌘</span>K
          </kbd>
        </button>

        {/* Notifications */}
        <button
          className={cn(
            'relative flex items-center justify-center w-8 h-8 rounded',
            'text-[#A7A29A] hover:text-[#E8E6E3] hover:bg-[#1B1B1D]',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]'
          )}
          aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ', none unread'}`}
        >
          <Bell size={15} aria-hidden />
          {unread > 0 && (
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#D4AF37]"
              aria-hidden="true"
            />
          )}
        </button>

        {/* Keyboard shortcuts hint */}
        <button
          className={cn(
            'hidden sm:flex items-center justify-center w-8 h-8 rounded',
            'text-[#A7A29A] hover:text-[#E8E6E3] hover:bg-[#1B1B1D]',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]'
          )}
          aria-label="View keyboard shortcuts"
          title="Keyboard shortcuts"
        >
          <Keyboard size={14} aria-hidden />
        </button>
      </div>
    </header>
  );
}
