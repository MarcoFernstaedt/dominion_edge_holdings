'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AppState,
  AppSettings,
  Affirmation,
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
  MeetingPrepPacket,
  SourcingCandidate,
  SourceAdapter,
  SourcingRadarRun,
  Investor,
  CapitalStack,
  InvestorMemo,
  FirmMessaging,
  PitchDeck,
  ID,
} from './types';
import { CHECKLIST_PHASES } from '@/data/checklistData';
import { DEFAULT_BOARD_SEATS } from '@/data/boardSeats';
import { SYSTEM_TEMPLATES } from '@/data/outreachTemplates';
import { AFFIRMATIONS as DEFAULT_AFFIRMATIONS } from '@/data/affirmations';

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
      setCompanies: (companies: Company[]) => set({ companies }),
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
      setContacts: (contacts: Contact[]) => set({ contacts }),
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
      setInteractions: (interactions: Interaction[]) => set({ interactions }),
      addInteraction: (interaction: Interaction) =>
        set((s) => ({ interactions: [...s.interactions, interaction] })),

      // ── Deals ──────────────────────────────────────────────────────────────
      deals: [],
      setDeals: (deals: Deal[]) => set({ deals }),
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
      setTasks: (tasks: Task[]) => set({ tasks }),
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

      // ── Meeting Prep Packets ────────────────────────────────────────────────
      meetingPrepPackets: [] as MeetingPrepPacket[],
      addMeetingPrepPacket: (packet: MeetingPrepPacket) =>
        set((s) => ({ meetingPrepPackets: [packet, ...s.meetingPrepPackets].slice(0, 200) })),
      updateMeetingPrepPacket: (id: ID, updates: Partial<MeetingPrepPacket>) =>
        set((s) => ({
          meetingPrepPackets: s.meetingPrepPackets.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          ),
        })),

      // ── Sourcing Radar ──────────────────────────────────────────────────────
      sourcingCandidates: [] as SourcingCandidate[],
      addSourcingCandidate: (c: SourcingCandidate) =>
        set((s) => ({ sourcingCandidates: [c, ...s.sourcingCandidates].slice(0, 1000) })),
      updateSourcingCandidate: (id: ID, updates: Partial<SourcingCandidate>) =>
        set((s) => ({
          sourcingCandidates: s.sourcingCandidates.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
          ),
        })),
      sourceAdapters: [] as SourceAdapter[],
      setSourceAdapters: (adapters: SourceAdapter[]) => set({ sourceAdapters: adapters }),
      sourcingRadarRuns: [] as SourcingRadarRun[],
      addSourcingRadarRun: (run: SourcingRadarRun) =>
        set((s) => ({ sourcingRadarRuns: [run, ...s.sourcingRadarRuns].slice(0, 50) })),

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

      // ── Capital Raising ────────────────────────────────────────────────────
      investors: [] as Investor[],
      addInvestor: (i: Investor) => set((s) => ({ investors: [i, ...s.investors] })),
      updateInvestor: (id: ID, updates: Partial<Investor>) =>
        set((s) => ({ investors: s.investors.map((x) => (x.id === id ? { ...x, ...updates } : x)) })),
      deleteInvestor: (id: ID) =>
        set((s) => ({ investors: s.investors.filter((x) => x.id !== id) })),

      capitalStacks: [] as CapitalStack[],
      addCapitalStack: (st: CapitalStack) => set((s) => ({ capitalStacks: [st, ...s.capitalStacks] })),
      updateCapitalStack: (id: ID, updates: Partial<CapitalStack>) =>
        set((s) => ({ capitalStacks: s.capitalStacks.map((x) => (x.id === id ? { ...x, ...updates } : x)) })),

      investorMemos: [] as InvestorMemo[],
      addInvestorMemo: (m: InvestorMemo) => set((s) => ({ investorMemos: [m, ...s.investorMemos] })),
      updateInvestorMemo: (id: ID, updates: Partial<InvestorMemo>) =>
        set((s) => ({ investorMemos: s.investorMemos.map((x) => (x.id === id ? { ...x, ...updates } : x)) })),
      deleteInvestorMemo: (id: ID) =>
        set((s) => ({ investorMemos: s.investorMemos.filter((x) => x.id !== id) })),

      firmMessaging: [] as FirmMessaging[],
      addFirmMessaging: (f: FirmMessaging) => set((s) => ({ firmMessaging: [f, ...s.firmMessaging] })),
      updateFirmMessaging: (id: ID, updates: Partial<FirmMessaging>) =>
        set((s) => ({ firmMessaging: s.firmMessaging.map((x) => (x.id === id ? { ...x, ...updates } : x)) })),

      pitchDecks: [] as PitchDeck[],
      addPitchDeck: (d: PitchDeck) => set((s) => ({ pitchDecks: [d, ...s.pitchDecks] })),
      updatePitchDeck: (id: ID, updates: Partial<PitchDeck>) =>
        set((s) => ({ pitchDecks: s.pitchDecks.map((x) => (x.id === id ? { ...x, ...updates } : x)) })),
      deletePitchDeck: (id: ID) =>
        set((s) => ({ pitchDecks: s.pitchDecks.filter((x) => x.id !== id) })),

      // ── Affirmations ───────────────────────────────────────────────────────
      affirmations: DEFAULT_AFFIRMATIONS,
      currentAffirmationIndex: 0,
      setAffirmationIndex: (idx: number) => set({ currentAffirmationIndex: idx }),
      addAffirmation: (affirmation: Affirmation) =>
        set((s) => ({
          affirmations: [...s.affirmations, { ...affirmation, order: s.affirmations.length + 1 }],
        })),
      updateAffirmation: (id: string, updates: Partial<Affirmation>) =>
        set((s) => ({
          affirmations: s.affirmations.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),
      deleteAffirmation: (id: string) =>
        set((s) => ({
          affirmations: s.affirmations.filter((a) => a.id !== id),
          // Reset index if it would be out of bounds
          currentAffirmationIndex: Math.min(
            s.currentAffirmationIndex,
            Math.max(0, s.affirmations.length - 2)
          ),
        })),

      // ── Bootstrap state ────────────────────────────────────────────────────
      dataReady: false,
      setDataReady: (ready: boolean) => set({ dataReady: ready }),
    }),
    {
      name: 'deh-aos-store',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      ),
      // ── Persist only non-sensitive UI preferences ──────────────────────────
      // Business data (companies, contacts, deals, tasks, interactions, etc.)
      // lives in PostgreSQL and is hydrated from the API on mount via useBootstrap.
      // localStorage is intentionally excluded from all business entity data.
      partialize: (state) => ({
        settings: state.settings,
        // User preferences — affirmations are personalizable, persist all edits
        affirmations: state.affirmations,
        currentAffirmationIndex: state.currentAffirmationIndex,
        // Checklist and board seats are seeded from static data and safe to cache
        checklistPhases: state.checklistPhases,
        boardSeats: state.boardSeats,
        outreachTemplates: state.outreachTemplates,
      }),
    }
  )
);
