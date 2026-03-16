'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Mail,
  Send,
  KanbanSquare,
  Calculator,
  Briefcase,
  FileText,
  Building2,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'command-center', label: 'Command Center', href: '/command-center', icon: LayoutDashboard },
  { id: 'checklist', label: 'Checklist', href: '/checklist', icon: CheckSquare },
  { id: 'crm', label: 'CRM', href: '/crm/companies', icon: Users },
  { id: 'inbox', label: 'Inbox', href: '/inbox', icon: Mail },
  { id: 'outreach', label: 'Outreach', href: '/outreach', icon: Send },
  { id: 'pipeline', label: 'Pipeline', href: '/pipeline', icon: KanbanSquare },
  { id: 'underwriting', label: 'Underwriting', href: '/underwriting', icon: Calculator },
  { id: 'board', label: 'Board', href: '/board', icon: Briefcase },
  { id: 'documents', label: 'Documents', href: '/documents', icon: FileText },
  { id: 'post-acquisition', label: 'Post-Acquisition', href: '/post-acquisition', icon: Building2 },
  { id: 'reports', label: 'Reports', href: '/reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarNavProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SidebarNav({ collapsed, onToggle }: SidebarNavProps) {
  const pathname = usePathname();
  const checklistPhases = useAppStore((s) => s.checklistPhases);
  const deals = useAppStore((s) => s.deals);

  const totalItems = checklistPhases.flatMap((p) => p.items).length;
  const completedItems = checklistPhases.flatMap((p) => p.items).filter((i) => i.isComplete).length;
  const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const activeDealCount = deals.filter((d) => d.status === 'active').length;

  function isActive(item: NavItem): boolean {
    if (item.id === 'crm') return pathname.startsWith('/crm');
    if (item.id === 'board') return pathname.startsWith('/board');
    if (item.id === 'pipeline') return pathname.startsWith('/pipeline');
    if (item.id === 'underwriting') return pathname.startsWith('/underwriting');
    if (item.id === 'documents') return pathname.startsWith('/documents');
    if (item.id === 'outreach') return pathname.startsWith('/outreach');
    if (item.id === 'post-acquisition') return pathname.startsWith('/post-acquisition');
    return pathname === item.href;
  }

  const badges: Record<string, number> = {
    pipeline: activeDealCount > 0 ? activeDealCount : 0,
  };

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        'flex flex-col h-full bg-[#141414] border-r border-[#2A2A2E] transition-all duration-200',
        collapsed ? 'w-[60px]' : 'w-[220px]'
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'flex items-center gap-3 border-b border-[#2A2A2E]',
          collapsed ? 'px-4 py-4 justify-center' : 'px-4 py-4'
        )}
      >
        <div
          className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 font-bold text-sm text-black"
          style={{ background: '#D4AF37' }}
          aria-hidden="true"
        >
          D
        </div>
        {!collapsed && (
          <div>
            <div className="text-[11px] font-bold tracking-[0.1em] text-[#D4AF37] leading-tight">
              DOMINION EDGE
            </div>
            <div className="text-[9px] tracking-[0.15em] text-[#A7A29A] uppercase leading-tight">
              Holdings · AOS
            </div>
          </div>
        )}
      </div>

      {/* Nav Items */}
      <ul className="flex-1 py-2 overflow-y-auto overflow-x-hidden" role="list">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const badge = badges[item.id];
          const Icon = item.icon;

          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors duration-150',
                  'relative border-l-2',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D4AF37]',
                  active
                    ? 'border-[#D4AF37] text-[#D4AF37] bg-[#D4AF3710]'
                    : 'border-transparent text-[#A7A29A] hover:text-[#E8E6E3] hover:bg-[#1B1B1D]',
                  collapsed && 'justify-center px-0'
                )}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  size={16}
                  aria-hidden
                  className="flex-shrink-0"
                />
                {!collapsed && (
                  <span className="truncate">{item.label}</span>
                )}
                {!collapsed && badge != null && badge > 0 && (
                  <span
                    className="ml-auto flex-shrink-0 h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold bg-[#D4AF37] text-black flex items-center justify-center"
                    aria-label={`${badge} items`}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Progress footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-[#2A2A2E]">
          <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-1.5">
            Checklist Progress
          </div>
          <div
            className="h-1 rounded-full bg-[#2A2A2E] overflow-hidden"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Checklist ${progressPct}% complete`}
          >
            <div
              className="h-full rounded-full bg-[#D4AF37] transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-[10px] text-[#D4AF37] mt-1">
            {progressPct}% — {completedItems}/{totalItems} steps
          </div>
        </div>
      )}

      {/* Toggle */}
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center justify-center border-t border-[#2A2A2E] py-3 px-4',
          'text-[#A7A29A] hover:text-[#E8E6E3] hover:bg-[#1B1B1D] transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D4AF37]'
        )}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
      >
        {collapsed ? <ChevronRight size={14} aria-hidden /> : <ChevronLeft size={14} aria-hidden />}
        {!collapsed && <span className="text-xs ml-2">Collapse</span>}
      </button>
    </nav>
  );
}
