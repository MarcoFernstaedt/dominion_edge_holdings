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
  CalendarDays,
  Bot,
  ChevronLeft,
  ChevronRight,
  X,
  Radar,
  TrendingUp,
  Activity,
  BookOpen,
  Store,
  UserCheck,
  MessageCircle,
  Network,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

// ─── Nav item definition ──────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  matchPrefix?: boolean;
  exactMatch?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// ─── Navigation groups (ordered by operational priority) ─────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { id: 'command-center', label: 'Command Center', href: '/command-center', icon: LayoutDashboard, exactMatch: true },
      { id: 'playbook',       label: 'Playbook',       href: '/playbook',       icon: BookOpen,        matchPrefix: true },
      { id: 'execution',      label: 'Execution',      href: '/execution',      icon: Activity,        matchPrefix: true },
      { id: 'checklist',      label: 'Checklist',      href: '/checklist',      icon: CheckSquare,     matchPrefix: true },
    ],
  },
  {
    label: 'Deal Flow',
    items: [
      { id: 'pipeline',       label: 'Pipeline',       href: '/pipeline',       icon: KanbanSquare,   exactMatch: true },
      { id: 'sourcing-radar', label: 'Sourcing Radar', href: '/pipeline/sourcing-radar', icon: Radar, matchPrefix: true },
      { id: 'deal-feed',      label: 'Deal Feed',      href: '/deal-feed',      icon: Store,          matchPrefix: true },
      { id: 'underwriting',   label: 'Underwriting',   href: '/underwriting',   icon: Calculator,     matchPrefix: true },
    ],
  },
  {
    label: 'Relationships',
    items: [
      { id: 'crm',            label: 'CRM',            href: '/crm/companies',  icon: Users,          matchPrefix: true },
      { id: 'board',          label: 'Board',          href: '/board',          icon: Briefcase,      matchPrefix: true },
      { id: 'relationships',  label: 'Relationships',  href: '/relationships',  icon: UserCheck,      matchPrefix: true },
      { id: 'conversations',  label: 'Conversations',  href: '/conversations',  icon: MessageCircle,  matchPrefix: true },
    ],
  },
  {
    label: 'Capital',
    items: [
      { id: 'capital-raising', label: 'Capital Raising', href: '/capital-raising', icon: TrendingUp, matchPrefix: true },
    ],
  },
  {
    label: 'Communication',
    items: [
      { id: 'outreach',  label: 'Outreach', href: '/outreach',  icon: Send,        matchPrefix: true },
      { id: 'meetings',  label: 'Meetings', href: '/meetings',  icon: CalendarDays, matchPrefix: true },
      { id: 'inbox',     label: 'Inbox',    href: '/inbox',     icon: Mail,        matchPrefix: true },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { id: 'network',          label: 'Network Intel',   href: '/network',          icon: Network,   matchPrefix: true },
      { id: 'agents',           label: 'AI Agents',       href: '/agents',           icon: Bot,       matchPrefix: true },
      { id: 'artifacts',        label: 'Artifacts',       href: '/artifacts',        icon: Layers,    matchPrefix: true },
      { id: 'documents',        label: 'Documents',       href: '/documents',        icon: FileText,  matchPrefix: true },
      { id: 'post-acquisition', label: 'Post-Acquisition',href: '/post-acquisition', icon: Building2, matchPrefix: true },
      { id: 'reports',          label: 'Reports',         href: '/reports',          icon: BarChart3, matchPrefix: true },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'settings', label: 'Settings', href: '/settings', icon: Settings, matchPrefix: true },
    ],
  },
];

// Flat list for active-check lookup
const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

// ─── Active state logic ───────────────────────────────────────────────────────

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.exactMatch) return pathname === item.href;
  if (item.matchPrefix) return pathname.startsWith(item.href);
  return pathname === item.href;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface SidebarNavProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SidebarNav({ collapsed, onToggle, isMobile = false }: SidebarNavProps) {
  const pathname = usePathname();
  const checklistPhases = useAppStore((s) => s.checklistPhases);
  const deals = useAppStore((s) => s.deals);

  const totalItems     = checklistPhases.flatMap((p) => p.items).length;
  const completedItems = checklistPhases.flatMap((p) => p.items).filter((i) => i.isComplete).length;
  const progressPct    = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const activeDealCount = deals.filter((d) => d.status === 'active').length;

  const showLabel = isMobile || !collapsed;

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        'flex flex-col h-full bg-[#111111] border-r border-[#262626]',
        !isMobile && 'transition-all duration-200',
        collapsed && !isMobile ? 'w-[56px]' : 'w-[232px] sm:w-[220px]'
      )}
    >
      {/* ── Brand block ─────────────────────────────────────────────────── */}
      <div
        className={cn(
          'flex items-center gap-3 border-b border-[#262626] flex-shrink-0 py-[18px]',
          collapsed && !isMobile ? 'px-4 justify-center' : 'px-4'
        )}
      >
        {/* Logo — clickable, navigates to command center */}
        <Link
          href="/command-center"
          className={cn(
            'flex items-center gap-2.5 min-w-0 flex-1',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded',
            collapsed && !isMobile && 'flex-initial'
          )}
          aria-label="Dominion Edge Holdings — go to Command Center"
        >
          {/* D logo mark */}
          <div
            className="w-6 h-6 rounded-[4px] flex items-center justify-center flex-shrink-0 font-bold text-[11px] text-black"
            style={{ background: '#C9A227' }}
            aria-hidden="true"
          >
            D
          </div>

          {showLabel && (
            <div className="min-w-0">
              <div className="text-[11px] font-bold tracking-[0.12em] text-[#C9A227] leading-tight truncate">
                DOMINION EDGE HOLDINGS
              </div>
            </div>
          )}
        </Link>

        {/* Mobile close */}
        {isMobile && (
          <button
            onClick={onToggle}
            className="ml-auto flex-shrink-0 text-[#737373] hover:text-[#E5E5E5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded p-1"
            aria-label="Close navigation"
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>

      {/* ── Nav groups ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {NAV_GROUPS.map((group, groupIdx) => (
          <div key={group.label} className={cn(groupIdx > 0 && 'mt-1')}>
            {/* Group label — hidden when collapsed */}
            {showLabel && (
              <div className="px-4 pt-3 pb-1">
                <span className="text-[9px] font-semibold tracking-[0.14em] uppercase text-[#737373]">
                  {group.label}
                </span>
              </div>
            )}

            {/* Group items */}
            <ul role="list">
              {group.items.map((item) => {
                const active = isItemActive(item, pathname);
                const Icon   = item.icon;
                const showBadge = item.id === 'pipeline' && activeDealCount > 0;

                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 py-2 text-sm font-medium transition-colors duration-100',
                        'relative border-l-[2px]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A227]',
                        showLabel ? 'px-4' : 'px-0 justify-center',
                        active
                          ? 'border-[#C9A227] text-[#C9A227] bg-[#C9A22710]'
                          : 'border-transparent text-[#737373] hover:text-[#E5E5E5] hover:bg-[#1A1A1A]'
                      )}
                      aria-current={active ? 'page' : undefined}
                      title={!showLabel ? item.label : undefined}
                      onClick={isMobile ? onToggle : undefined}
                    >
                      <Icon
                        size={15}
                        aria-hidden
                        className={cn(
                          'flex-shrink-0',
                          active ? 'text-[#C9A227]' : 'text-[#737373] group-hover:text-[#E5E5E5]'
                        )}
                      />

                      {showLabel && (
                        <span className="truncate flex-1 text-[13px]">{item.label}</span>
                      )}

                      {showLabel && showBadge && (
                        <span
                          className="flex-shrink-0 h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold bg-[#C9A227] text-black flex items-center justify-center"
                          aria-label={`${activeDealCount} active deals`}
                        >
                          {activeDealCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* ── Progress footer (desktop expanded only) ─────────────────────── */}
      {showLabel && !isMobile && (
        <div className="px-4 py-3 border-t border-[#262626] flex-shrink-0">
          <div className="text-[9px] tracking-[0.12em] uppercase text-[#737373] mb-1.5">
            QLA Progress
          </div>
          <div
            className="h-0.5 rounded-full bg-[#262626] overflow-hidden"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`QLA checklist ${progressPct}% complete`}
          >
            <div
              className="h-full rounded-full bg-[#C9A227] transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-[10px] text-[#C9A227] mt-1.5">
            {progressPct}% · {completedItems}/{totalItems} steps
          </div>
        </div>
      )}

      {/* ── Desktop collapse toggle ──────────────────────────────────────── */}
      {!isMobile && (
        <button
          onClick={onToggle}
          className={cn(
            'flex items-center justify-center border-t border-[#262626] py-3 px-4 flex-shrink-0',
            'text-[#737373] hover:text-[#E5E5E5] hover:bg-[#1A1A1A] transition-colors duration-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A227]'
          )}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? (
            <ChevronRight size={13} aria-hidden />
          ) : (
            <>
              <ChevronLeft size={13} aria-hidden />
              <span className="text-[11px] ml-2 tracking-wide">Collapse</span>
            </>
          )}
        </button>
      )}
    </nav>
  );
}
