import type { Affirmation, AffirmationDailyStatus, AppSettings } from './types';

type CompletionPeriod = 'morning' | 'evening';

type EnforcementTone = 'locked' | 'warning' | 'critical';

export interface AffirmationDisciplineState {
  todayKey: string;
  isEveningMode: boolean;
  activePool: Affirmation[];
  currentAffirmation: Affirmation | null;
  script: string;
  completedBlocks: number;
  progressPct: number;
  streakDays: number;
  requiredPeriod: CompletionPeriod;
  requiredPeriodComplete: boolean;
  missedRequiredPeriod: boolean;
  remainingPeriods: CompletionPeriod[];
  nextCompletionLabel: string;
  enforcementTone: EnforcementTone;
  enforcementLabel: string;
  enforcementMessage: string;
}

export function getAffirmationDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function parseTimeToMinutes(value?: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map((entry) => Number(entry) || 0);
  return (hours * 60) + minutes;
}

export function getIsEveningMode(settings: AppSettings, now = new Date()) {
  const eveningModeStart = parseTimeToMinutes(settings.qlaEveningModeStartTime || '16:00') ?? (16 * 60);
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();
  return currentMinutes >= eveningModeStart;
}

export function getAffirmationPool(
  affirmations: Affirmation[],
  settings: AppSettings,
  currentIndex: number,
  now = new Date(),
) {
  const active = affirmations.filter((item) => item.isActive !== false);
  const isEveningMode = getIsEveningMode(settings, now);
  const focus = settings.qlaAffirmationFocus || 'auto';

  const filtered = active.filter((item) => {
    const timeMatch = !item.timeOfDay || item.timeOfDay === 'any' || (isEveningMode ? item.timeOfDay === 'evening' : item.timeOfDay === 'morning');
    const focusMatch = !item.qlaFocus || focus === 'auto' || item.qlaFocus === focus;
    return timeMatch && focusMatch;
  });

  const pool = filtered.length > 0 ? filtered : active;
  const orderedPool = pool.slice().sort((a, b) => a.order - b.order);
  const currentAffirmation = orderedPool.length > 0 ? orderedPool[((currentIndex % orderedPool.length) + orderedPool.length) % orderedPool.length] : null;

  return {
    active,
    pool: orderedPool,
    currentAffirmation,
    isEveningMode,
    script: orderedPool.map((item) => item.text).join(' '),
  };
}

export function getAffirmationDisciplineState(args: {
  affirmations: Affirmation[];
  settings: AppSettings;
  currentIndex: number;
  affirmationStatusByDate: Record<string, AffirmationDailyStatus>;
  now?: Date;
}): AffirmationDisciplineState {
  const { affirmations, settings, currentIndex, affirmationStatusByDate, now = new Date() } = args;
  const todayKey = getAffirmationDateKey(now);
  const { pool, currentAffirmation, isEveningMode, script } = getAffirmationPool(affirmations, settings, currentIndex, now);

  const todayStatus = affirmationStatusByDate[todayKey] ?? {
    date: todayKey,
    morningCompleted: false,
    eveningCompleted: false,
  };

  const completedBlocks = Number(todayStatus.morningCompleted) + Number(todayStatus.eveningCompleted);
  const progressPct = Math.round((completedBlocks / 2) * 100);

  let streakDays = 0;
  const cursor = new Date(now);
  while (true) {
    const key = getAffirmationDateKey(cursor);
    const status = affirmationStatusByDate[key];
    if (!status || (!status.morningCompleted && !status.eveningCompleted)) break;
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const requiredPeriod: CompletionPeriod = isEveningMode ? 'evening' : 'morning';
  const requiredPeriodComplete = requiredPeriod === 'morning' ? todayStatus.morningCompleted : todayStatus.eveningCompleted;
  const missedRequiredPeriod = !requiredPeriodComplete;
  const remainingPeriods: CompletionPeriod[] = [
    ...(!todayStatus.morningCompleted ? ['morning' as const] : []),
    ...(!todayStatus.eveningCompleted ? ['evening' as const] : []),
  ];
  const nextCompletionLabel = remainingPeriods.length > 0 ? `Complete ${remainingPeriods[0]} affirmations` : 'Affirmation stack complete';

  let enforcementTone: EnforcementTone = 'locked';
  let enforcementLabel = 'Locked in';
  let enforcementMessage = 'Affirmation stack is complete for the current phase. Keep execution pressure on the scoreboard.';

  if (missedRequiredPeriod) {
    enforcementTone = isEveningMode ? 'critical' : 'warning';
    enforcementLabel = isEveningMode ? 'Execution blocked' : 'Foundation incomplete';
    enforcementMessage = isEveningMode
      ? 'Evening affirmations are still open. Log the stack before calling this day disciplined.'
      : 'Morning affirmations are still open. Identity is not set yet, so execution quality is exposed.';
  }

  return {
    todayKey,
    isEveningMode,
    activePool: pool,
    currentAffirmation,
    script,
    completedBlocks,
    progressPct,
    streakDays,
    requiredPeriod,
    requiredPeriodComplete,
    missedRequiredPeriod,
    remainingPeriods,
    nextCompletionLabel,
    enforcementTone,
    enforcementLabel,
    enforcementMessage,
  };
}
