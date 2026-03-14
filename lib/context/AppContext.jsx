'use client';

import { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { PHASES } from '@/lib/data/checklist';

const INITIAL_CHECKLIST = PHASES.reduce((acc, phase) => {
  phase.items.forEach(item => { acc[item.id] = item.done; });
  return acc;
}, {});

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [checklistState, setChecklistState] = useLocalStorage('deh_checklist', INITIAL_CHECKLIST);
  const [boardContacts, setBoardContacts] = useLocalStorage('deh_board', []);
  const [deals, setDeals] = useLocalStorage('deh_deals', []);

  const derived = useMemo(() => {
    const totalItems = Object.keys(checklistState).length;
    const completedItems = Object.values(checklistState).filter(Boolean).length;
    const overallProgress = Math.round((completedItems / totalItems) * 100);
    const boardSeatsCommitted = boardContacts.filter(c => c.status === 'Committed').length;

    let activePhase = 'Complete';
    for (const phase of PHASES) {
      const done = phase.items.filter(i => checklistState[i.id]).length;
      if (done < phase.items.length) { activePhase = phase.name; break; }
    }

    return { totalItems, completedItems, overallProgress, boardSeatsCommitted, activePhase };
  }, [checklistState, boardContacts]);

  return (
    <AppContext.Provider value={{
      checklistState, setChecklistState,
      boardContacts, setBoardContacts,
      deals, setDeals,
      ...derived,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
