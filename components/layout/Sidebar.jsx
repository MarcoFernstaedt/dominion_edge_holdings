'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useApp } from '@/lib/context/AppContext';
import ProgressBar from '@/components/ui/ProgressBar';

const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Dashboard',     icon: '⬛' },
  { href: '/checklist',  label: 'QLA Checklist',  icon: '☑'  },
  { href: '/board',      label: 'Board CRM',      icon: '◈'  },
  { href: '/pipeline',   label: 'Deal Pipeline',  icon: '◎'  },
  { href: '/capital',    label: 'Capital',        icon: '⬡'  },
  { href: '/scripts',    label: 'Scripts',        icon: '◻'  },
  { href: '/agents',     label: 'AI Agents',      icon: '◆'  },
  { href: '/resources',  label: 'Resources',      icon: '◑'  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { overallProgress, completedItems, totalItems } = useApp();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside style={{
      width: collapsed ? 60 : 220,
      background: '#111',
      borderRight: '1px solid #1E1E1E',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      transition: 'width 0.2s ease',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1E1E1E', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, background: '#C9A84C', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 700, color: '#0A0A0A' }}>
          D
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.05em', lineHeight: 1.2 }}>DOMINION EDGE</div>
            <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.08em' }}>HOLDINGS</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                background: active ? 'rgba(201,168,76,0.08)' : 'transparent',
                borderLeft: `2px solid ${active ? '#C9A84C' : 'transparent'}`,
                color: active ? '#C9A84C' : '#666',
                fontSize: 13, fontWeight: active ? 600 : 400,
                whiteSpace: 'nowrap', cursor: 'pointer',
                transition: 'color 0.15s, background 0.15s',
              }}>
                <span style={{ fontSize: 15, flexShrink: 0, width: 20, textAlign: 'center' }}>{icon}</span>
                {!collapsed && <span>{label}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Progress */}
      {!collapsed && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid #1E1E1E' }}>
          <div style={{ fontSize: 10, color: '#444', marginBottom: 6, letterSpacing: '0.08em' }}>OVERALL PROGRESS</div>
          <ProgressBar pct={overallProgress} />
          <div style={{ fontSize: 11, color: '#C9A84C', marginTop: 4 }}>
            {overallProgress}% — {completedItems}/{totalItems} steps
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{ padding: '12px 16px', background: 'none', border: 'none', borderTop: '1px solid #1E1E1E', color: '#444', cursor: 'pointer', fontSize: 12, textAlign: 'center' }}
      >
        {collapsed ? '▶' : '◀ Collapse'}
      </button>
    </aside>
  );
}
