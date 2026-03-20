'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Search, ArrowRight, LayoutDashboard, CheckSquare, Users, Mail, Send, KanbanSquare, Calculator, Briefcase, FileText, BarChart3, Settings } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface PaletteItem {
  id: string;
  label: string;
  category: string;
  href?: string;
  action?: () => void;
  icon?: React.ReactNode;
  keywords?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const companies = useAppStore((s) => s.companies);
  const contacts = useAppStore((s) => s.contacts);
  const deals = useAppStore((s) => s.deals);

  const NAV_ITEMS: PaletteItem[] = [
    { id: 'nav-cc', label: 'Command Center', category: 'Navigation', href: '/command-center', icon: <LayoutDashboard size={14} /> },
    { id: 'nav-checklist', label: 'Checklist', category: 'Navigation', href: '/checklist', icon: <CheckSquare size={14} /> },
    { id: 'nav-crm', label: 'CRM — Companies', category: 'Navigation', href: '/crm/companies', icon: <Users size={14} /> },
    { id: 'nav-contacts', label: 'CRM — Contacts', category: 'Navigation', href: '/crm/contacts', icon: <Users size={14} /> },
    { id: 'nav-inbox', label: 'Inbox', category: 'Navigation', href: '/inbox', icon: <Mail size={14} /> },
    { id: 'nav-outreach', label: 'Outreach', category: 'Navigation', href: '/outreach', icon: <Send size={14} /> },
    { id: 'nav-pipeline', label: 'Pipeline', category: 'Navigation', href: '/pipeline', icon: <KanbanSquare size={14} /> },
    { id: 'nav-underwriting', label: 'Underwriting', category: 'Navigation', href: '/underwriting', icon: <Calculator size={14} /> },
    { id: 'nav-board', label: 'Board', category: 'Navigation', href: '/board', icon: <Briefcase size={14} /> },
    { id: 'nav-documents', label: 'Documents', category: 'Navigation', href: '/documents', icon: <FileText size={14} /> },
    { id: 'nav-reports', label: 'Reports', category: 'Navigation', href: '/reports', icon: <BarChart3 size={14} /> },
    { id: 'nav-settings', label: 'Settings', category: 'Navigation', href: '/settings', icon: <Settings size={14} /> },
  ];

  const QUICK_ACTIONS: PaletteItem[] = [
    { id: 'qa-new-company', label: 'Add Company', category: 'Quick Action', href: '/crm/companies?new=1' },
    { id: 'qa-new-contact', label: 'Add Contact', category: 'Quick Action', href: '/crm/contacts?new=1' },
    { id: 'qa-new-deal', label: 'Create Deal', category: 'Quick Action', href: '/pipeline?new=1' },
    { id: 'qa-new-task', label: 'Create Task', category: 'Quick Action', href: '/command-center?task=1' },
    { id: 'qa-compose', label: 'Compose Email', category: 'Quick Action', href: '/inbox?compose=1' },
    { id: 'qa-underwriting', label: 'New Underwriting Scenario', category: 'Quick Action', href: '/underwriting?new=1' },
    { id: 'qa-loi', label: 'Generate LOI Draft', category: 'Quick Action', href: '/documents?type=loi' },
    { id: 'qa-board-candidate', label: 'Add Board Candidate', category: 'Quick Action', href: '/board/candidates?new=1' },
  ];

  const COMPANY_ITEMS: PaletteItem[] = companies.slice(0, 5).map((c) => ({
    id: `company-${c.id}`,
    label: c.name,
    category: 'Company',
    href: `/crm/companies/${c.id}`,
    keywords: `${c.industry} ${c.status} ${c.ownerName || ''}`,
  }));

  const CONTACT_ITEMS: PaletteItem[] = contacts.slice(0, 5).map((c) => ({
    id: `contact-${c.id}`,
    label: c.fullName,
    category: 'Contact',
    href: `/crm/contacts/${c.id}`,
    keywords: `${c.contactType} ${c.companyName || ''} ${c.email || ''}`,
  }));

  const DEAL_ITEMS: PaletteItem[] = deals.slice(0, 5).map((d) => ({
    id: `deal-${d.id}`,
    label: d.name,
    category: 'Deal',
    href: `/pipeline/${d.id}`,
    keywords: `${d.stage} ${d.companyName}`,
  }));

  const ALL_ITEMS = [...NAV_ITEMS, ...QUICK_ACTIONS, ...COMPANY_ITEMS, ...CONTACT_ITEMS, ...DEAL_ITEMS];

  const filtered = query.trim()
    ? ALL_ITEMS.filter((item) => {
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.keywords || '').toLowerCase().includes(q)
        );
      })
    : [...QUICK_ACTIONS, ...NAV_ITEMS].slice(0, 10);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      const item = filtered[selected];
      if (item) handleSelect(item);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  function handleSelect(item: PaletteItem) {
    if (item.href) {
      router.push(item.href);
    } else if (item.action) {
      item.action();
    }
    onClose();
  }

  // Scroll selected into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selectedEl = list.querySelector('[aria-selected="true"]') as HTMLElement;
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  const grouped = filtered.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-xl bg-[#141414] border border-[#2A2A2E] rounded-lg shadow-2xl overflow-hidden animate-slide-up">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2A2A2E]">
          <Search size={16} className="text-[#A7A29A] flex-shrink-0" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or jump to..."
            className="flex-1 bg-transparent text-sm text-[#E8E6E3] placeholder:text-[#A7A29A60] outline-none"
            aria-label="Search"
            aria-autocomplete="list"
            aria-controls="palette-list"
            aria-activedescendant={filtered[selected] ? `palette-item-${filtered[selected].id}` : undefined}
            role="combobox"
            aria-expanded="true"
          />
          <kbd className="hidden sm:flex items-center gap-1 text-[10px] text-[#A7A29A] bg-[#1B1B1D] border border-[#2A2A2E] rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <ul
          id="palette-list"
          ref={listRef}
          role="listbox"
          aria-label="Search results"
          className="max-h-80 overflow-y-auto py-2"
        >
          {filtered.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-[#A7A29A]">
              No results found
            </li>
          )}
          {Object.entries(grouped).map(([category, items]) => (
            <li key={category} role="group" aria-label={category}>
              <div className="px-4 py-1 text-[9px] font-bold tracking-widest uppercase text-[#A7A29A]">
                {category}
              </div>
              {items.map((item) => {
                const idx = filtered.indexOf(item);
                const isSelected = idx === selected;
                return (
                  <button
                    key={item.id}
                    id={`palette-item-${item.id}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelected(idx)}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-2 text-sm text-left',
                      'transition-colors duration-100',
                      isSelected
                        ? 'bg-[#C9A22715] text-[#C9A227]'
                        : 'text-[#E8E6E3] hover:bg-[#1B1B1D]'
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      {item.icon && (
                        <span className="text-[#A7A29A]" aria-hidden>
                          {item.icon}
                        </span>
                      )}
                      {item.label}
                    </span>
                    <ArrowRight size={12} className="text-[#A7A29A] flex-shrink-0" aria-hidden />
                  </button>
                );
              })}
            </li>
          ))}
        </ul>

        <div className="px-4 py-2 border-t border-[#2A2A2E] flex items-center gap-4 text-[10px] text-[#A7A29A]">
          <span><kbd className="bg-[#1B1B1D] border border-[#2A2A2E] rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="bg-[#1B1B1D] border border-[#2A2A2E] rounded px-1">↵</kbd> select</span>
          <span><kbd className="bg-[#1B1B1D] border border-[#2A2A2E] rounded px-1">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
