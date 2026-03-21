'use client';

/**
 * useBootstrap — Hydrates the Zustand store from the API on app mount.
 *
 * Business data (companies, contacts, deals, tasks, interactions) is the
 * source of truth in PostgreSQL. This hook fetches the data once on mount
 * and populates the store. Subsequent mutations go through the API first,
 * then update the local store optimistically.
 *
 * localStorage only retains non-sensitive UI preferences (settings,
 * affirmation index). All business data is excluded from persistence.
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { companiesApi, contactsApi, dealsApi, tasksApi, interactionsApi } from '@/lib/api';
import type { Company, Contact, Deal, Task, Interaction } from '@/lib/types';

export function useBootstrap() {
  const hydrated = useRef(false);

  const setCompanies    = useAppStore((s) => s.setCompanies);
  const setContacts     = useAppStore((s) => s.setContacts);
  const setDeals        = useAppStore((s) => s.setDeals);
  const setTasks        = useAppStore((s) => s.setTasks);
  const setInteractions = useAppStore((s) => s.setInteractions);
  const setDataReady    = useAppStore((s) => s.setDataReady);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    async function hydrate() {
      try {
        const [companies, contacts, deals, tasks, interactions] = await Promise.allSettled([
          companiesApi.list({}),
          contactsApi.list({}),
          dealsApi.list({}),
          tasksApi.list({}),
          interactionsApi.list({}),
        ]);

        if (companies.status    === 'fulfilled') setCompanies(companies.value       as Company[]);
        if (contacts.status     === 'fulfilled') setContacts(contacts.value         as Contact[]);
        if (deals.status        === 'fulfilled') setDeals(deals.value               as Deal[]);
        if (tasks.status        === 'fulfilled') setTasks(tasks.value               as Task[]);
        if (interactions.status === 'fulfilled') setInteractions(interactions.value as Interaction[]);
      } catch {
        // Silently fail — app works with local data if API is unavailable
      } finally {
        // Signal that bootstrap is complete regardless of success/failure
        setDataReady(true);
      }
    }

    hydrate();
  }, [setCompanies, setContacts, setDeals, setTasks, setInteractions, setDataReady]);
}
