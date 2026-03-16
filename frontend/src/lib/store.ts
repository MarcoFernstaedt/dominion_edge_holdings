'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AppState,
  AppSettings,
  Company,
  Contact,
  Interaction,
  Deal,
  UnderwritingScenario,
  BoardSeat,
  BoardCandidate,
  CapTableEntry,
  ChecklistPhase,
  Task,
  Document,
  EmailThread,
  OutreachTemplate,
  Notification,
  Meeting,
  ID,
} from './types';
import { CHECKLIST_PHASES } from '@/data/checklistData';
import { DEFAULT_BOARD_SEATS } from '@/data/boardSeats';
import { SYSTEM_TEMPLATES } from '@/data/outreachTemplates';

const DEFAULT_SETTINGS: AppSettings = {
  reducedMotion: false,
  highContrast: false,
  density: 'standard',
  keyboardShortcutsEnabled: true,
  aiDraftingEnabled: true,
  aiReplyEnabled: true,
  aiBriefingEnabled: true,
  primaryModel: 'claude-sonnet-4-20250514',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  emailMode: 'smtp_only',
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  fromName: 'Marco Fernstaedt',
  fromEmail: '',
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Companies ──────────────────────────────────────────────────────────
      companies: [],
      addCompany: (company: Company) =>
        set((s) => ({ companies: [...s.companies, company] })),
      updateCompany: (id: ID, updates: Partial<Company>) =>
        set((s) => ({
          companies: s.companies.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
          ),
        })),
      deleteCompany: (id: ID) =>
        set((s) => ({ companies: s.companies.filter((c) => c.id !== id) })),

      // ── Contacts ───────────────────────────────────────────────────────────
      contacts: [],
      addContact: (contact: Contact) =>
        set((s) => ({ contacts: [...s.contacts, contact] })),
      updateContact: (id: ID, updates: Partial<Contact>) =>
        set((s) => ({
          contacts: s.contacts.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
          ),
        })),
      deleteContact: (id: ID) =>
        set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) })),

      // ── Interactions ───────────────────────────────────────────────────────
      interactions: [],
      addInteraction: (interaction: Interaction) =>
        set((s) => ({ interactions: [...s.interactions, interaction] })),

      // ── Deals ──────────────────────────────────────────────────────────────
      deals: [],
      addDeal: (deal: Deal) =>
        set((s) => ({ deals: [...s.deals, deal] })),
      updateDeal: (id: ID, updates: Partial<Deal>) =>
        set((s) => ({
          deals: s.deals.map((d) =>
            d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
          ),
        })),
      deleteDeal: (id: ID) =>
        set((s) => ({ deals: s.deals.filter((d) => d.id !== id) })),

      // ── Underwriting ───────────────────────────────────────────────────────
      underwritingScenarios: [],
      addScenario: (scenario: UnderwritingScenario) =>
        set((s) => ({ underwritingScenarios: [...s.underwritingScenarios, scenario] })),
      updateScenario: (id: ID, updates: Partial<UnderwritingScenario>) =>
        set((s) => ({
          underwritingScenarios: s.underwritingScenarios.map((sc) =>
            sc.id === id ? { ...sc, ...updates } : sc
          ),
        })),
      deleteScenario: (id: ID) =>
        set((s) => ({ underwritingScenarios: s.underwritingScenarios.filter((sc) => sc.id !== id) })),

      // ── Board ──────────────────────────────────────────────────────────────
      boardSeats: DEFAULT_BOARD_SEATS,
      setBoardSeats: (seats: BoardSeat[]) => set({ boardSeats: seats }),
      boardCandidates: [],
      addCandidate: (candidate: BoardCandidate) =>
        set((s) => ({ boardCandidates: [...s.boardCandidates, candidate] })),
      updateCandidate: (id: ID, updates: Partial<BoardCandidate>) =>
        set((s) => ({
          boardCandidates: s.boardCandidates.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
          ),
        })),
      deleteCandidate: (id: ID) =>
        set((s) => ({ boardCandidates: s.boardCandidates.filter((c) => c.id !== id) })),
      capTable: [],
      addCapTableEntry: (entry: CapTableEntry) =>
        set((s) => ({ capTable: [...s.capTable, entry] })),
      updateCapTableEntry: (id: ID, updates: Partial<CapTableEntry>) =>
        set((s) => ({
          capTable: s.capTable.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),
      deleteCapTableEntry: (id: ID) =>
        set((s) => ({ capTable: s.capTable.filter((e) => e.id !== id) })),

      // ── Checklist ──────────────────────────────────────────────────────────
      checklistPhases: CHECKLIST_PHASES,
      toggleChecklistItem: (phaseId: string, itemId: ID) =>
        set((s) => ({
          checklistPhases: s.checklistPhases.map((phase) =>
            phase.id === phaseId
              ? {
                  ...phase,
                  items: phase.items.map((item) =>
                    item.id === itemId
                      ? {
                          ...item,
                          isComplete: !item.isComplete,
                          completedAt: !item.isComplete ? new Date().toISOString() : undefined,
                        }
                      : item
                  ),
                }
              : phase
          ),
        })),

      // ── Tasks ──────────────────────────────────────────────────────────────
      tasks: [],
      addTask: (task: Task) =>
        set((s) => ({ tasks: [...s.tasks, task] })),
      updateTask: (id: ID, updates: Partial<Task>) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
          ),
        })),
      deleteTask: (id: ID) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      // ── Documents ──────────────────────────────────────────────────────────
      documents: [],
      addDocument: (doc: Document) =>
        set((s) => ({ documents: [...s.documents, doc] })),
      updateDocument: (id: ID, updates: Partial<Document>) =>
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
          ),
        })),
      deleteDocument: (id: ID) =>
        set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),

      // ── Email Threads ──────────────────────────────────────────────────────
      emailThreads: [],
      addEmailThread: (thread: EmailThread) =>
        set((s) => ({ emailThreads: [...s.emailThreads, thread] })),
      updateEmailThread: (id: ID, updates: Partial<EmailThread>) =>
        set((s) => ({
          emailThreads: s.emailThreads.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

      // ── Outreach Templates ─────────────────────────────────────────────────
      outreachTemplates: SYSTEM_TEMPLATES,
      addOutreachTemplate: (template: OutreachTemplate) =>
        set((s) => ({ outreachTemplates: [...s.outreachTemplates, template] })),
      updateOutreachTemplate: (id: ID, updates: Partial<OutreachTemplate>) =>
        set((s) => ({
          outreachTemplates: s.outreachTemplates.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

      // ── Meetings ────────────────────────────────────────────────────────────
      meetings: [] as Meeting[],
      addMeeting: (meeting: Meeting) =>
        set((s) => ({ meetings: [meeting, ...s.meetings] })),
      updateMeeting: (id: ID, updates: Partial<Meeting>) =>
        set((s) => ({
          meetings: s.meetings.map((m) => m.id === id ? { ...m, ...updates } : m),
        })),
      deleteMeeting: (id: ID) =>
        set((s) => ({ meetings: s.meetings.filter((m) => m.id !== id) })),

      // ── Notifications ──────────────────────────────────────────────────────
      notifications: [],
      addNotification: (n: Notification) =>
        set((s) => ({ notifications: [n, ...s.notifications].slice(0, 50) })),
      markNotificationRead: (id: ID) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
        })),
      clearAllNotifications: () => set({ notifications: [] }),

      // ── Settings ───────────────────────────────────────────────────────────
      settings: DEFAULT_SETTINGS,
      updateSettings: (updates: Partial<AppSettings>) =>
        set((s) => ({ settings: { ...s.settings, ...updates } })),

      // ── Affirmations ───────────────────────────────────────────────────────
      currentAffirmationIndex: 0,
      setAffirmationIndex: (idx: number) => set({ currentAffirmationIndex: idx }),
    }),
    {
      name: 'deh-aos-store',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      ),
      partialize: (state) => ({
        companies: state.companies,
        contacts: state.contacts,
        interactions: state.interactions,
        deals: state.deals,
        underwritingScenarios: state.underwritingScenarios,
        boardSeats: state.boardSeats,
        boardCandidates: state.boardCandidates,
        capTable: state.capTable,
        checklistPhases: state.checklistPhases,
        tasks: state.tasks,
        documents: state.documents,
        emailThreads: state.emailThreads,
        outreachTemplates: state.outreachTemplates,
        meetings: state.meetings,
        settings: state.settings,
        currentAffirmationIndex: state.currentAffirmationIndex,
      }),
    }
  )
);
