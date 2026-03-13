import { useState } from 'react';
import Dashboard from './modules/Dashboard';
import Checklist from './modules/Checklist';
import BoardCRM from './modules/BoardCRM';
import DealPipeline from './modules/DealPipeline';
import DSCRCalculator from './modules/DSCRCalculator';
import Scripts from './modules/Scripts';
import AIAgents from './modules/AIAgents';
import Resources from './modules/Resources';
import { useLocalStorage } from './hooks/useLocalStorage';
import { PHASES } from './data/checklistData';
import ErrorBoundary from './components/ErrorBoundary';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '⬛' },
  { id: 'checklist', label: 'QLA Checklist', icon: '☑' },
  { id: 'board', label: 'Board CRM', icon: '◈' },
  { id: 'pipeline', label: 'Deal Pipeline', icon: '◎' },
  { id: 'capital', label: 'Capital', icon: '⬡' },
  { id: 'scripts', label: 'Scripts', icon: '◻' },
  { id: 'agents', label: 'AI Agents', icon: '◆' },
  { id: 'resources', label: 'Resources', icon: '◑' },
];

const initialChecklist = PHASES.reduce((acc, phase) => {
  phase.items.forEach(item => {
    acc[item.id] = item.done;
  });
  return acc;
}, {});

export default function App() {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [checklistState, setChecklistState] = useLocalStorage('deh_checklist', initialChecklist);
  const [boardContacts, setBoardContacts] = useLocalStorage('deh_board', []);
  const [deals, setDeals] = useLocalStorage('deh_deals', []);

  const totalItems = Object.keys(checklistState).length;
  const completedItems = Object.values(checklistState).filter(Boolean).length;
  const overallProgress = Math.round((completedItems / totalItems) * 100);
  const boardSeatsCommitted = boardContacts.filter(c => c.status === 'Committed').length;

  const activePhase = (() => {
    for (const phase of PHASES) {
      const phaseItems = phase.items.map(i => i.id);
      const done = phaseItems.filter(id => checklistState[id]).length;
      if (done < phaseItems.length) return phase.name;
    }
    return 'Complete';
  })();

  const renderModule = () => {
    const props = { checklistState, setChecklistState, boardContacts, setBoardContacts, deals, setDeals, overallProgress, boardSeatsCommitted, activePhase };
    switch (activeModule) {
      case 'dashboard': return <Dashboard {...props} setActiveModule={setActiveModule} />;
      case 'checklist': return <Checklist {...props} />;
      case 'board': return <BoardCRM {...props} />;
      case 'pipeline': return <DealPipeline {...props} />;
      case 'capital': return <DSCRCalculator />;
      case 'scripts': return <Scripts />;
      case 'agents': return <AIAgents />;
      case 'resources': return <Resources />;
      default: return <Dashboard {...props} setActiveModule={setActiveModule} />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0A0A0A', color: '#E8E0D0', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? 220 : 60,
        background: '#111111',
        borderRight: '1px solid #1E1E1E',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1E1E1E', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: '#C9A84C', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 700, color: '#0A0A0A' }}>D</div>
          {sidebarOpen && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.05em', lineHeight: 1.2 }}>DOMINION EDGE</div>
              <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.08em' }}>HOLDINGS</div>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '8px 0' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                background: activeModule === item.id ? 'rgba(201, 168, 76, 0.08)' : 'transparent',
                border: 'none',
                borderLeft: activeModule === item.id ? '2px solid #C9A84C' : '2px solid transparent',
                color: activeModule === item.id ? '#C9A84C' : '#666',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeModule === item.id ? 600 : 400,
                textAlign: 'left',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 15, flexShrink: 0, width: 20, textAlign: 'center' }}>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {sidebarOpen && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #1E1E1E' }}>
            <div style={{ fontSize: 10, color: '#444', marginBottom: 4, letterSpacing: '0.08em' }}>OVERALL PROGRESS</div>
            <div style={{ background: '#1A1A1A', borderRadius: 4, height: 4, overflow: 'hidden' }}>
              <div style={{ width: `${overallProgress}%`, height: '100%', background: '#C9A84C', borderRadius: 4, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 11, color: '#C9A84C', marginTop: 4 }}>{overallProgress}% — {completedItems}/{totalItems} steps</div>
          </div>
        )}

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{ padding: '12px 16px', background: 'none', border: 'none', borderTop: '1px solid #1E1E1E', color: '#444', cursor: 'pointer', fontSize: 12 }}
        >
          {sidebarOpen ? '◀ Collapse' : '▶'}
        </button>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'auto', background: '#0D0D0D' }}>
        <ErrorBoundary key={activeModule}>
          {renderModule()}
        </ErrorBoundary>
      </div>
    </div>
  );
}
