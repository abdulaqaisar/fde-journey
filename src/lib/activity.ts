export interface TopicNote {
  text: string
  updatedAt: string
}

export interface JourneyState {
  currentId: number
  completed: number[]
  notes: Record<string, TopicNote>
  lastActivityAt: string | null
  streak: number
  longestStreak: number
}

export const defaultJourneyState: JourneyState = {
  currentId: 1,
  completed: [],
  notes: {},
  lastActivityAt: null,
  streak: 0,
  longestStreak: 0,
}

/**
 * Formats a date as YYYY-MM-DD in Pakistan time.
 */
export function dateKeyPKT(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Returns yesterday's YYYY-MM-DD key in Pakistan time.
 */
export function yesterdayKeyPKT(from = new Date()): string {
  const today = dateKeyPKT(from)
  const [year, month, day] = today.split('-').map(Number)
  const utcGuess = new Date(Date.UTC(year, month - 1, day))
  utcGuess.setUTCDate(utcGuess.getUTCDate() - 1)
  return dateKeyPKT(utcGuess)
}

/**
 * Counts whole calendar days since the last learning activity (PKT).
 */
export function daysSinceActivity(lastActivityAt: string | null, now = new Date()): number {
  if (!lastActivityAt) return Number.POSITIVE_INFINITY
  const last = dateKeyPKT(new Date(lastActivityAt))
  const today = dateKeyPKT(now)
  const lastDate = new Date(`${last}T00:00:00+05:00`)
  const todayDate = new Date(`${today}T00:00:00+05:00`)
  return Math.max(0, Math.round((todayDate.getTime() - lastDate.getTime()) / 86_400_000))
}

/**
 * Updates streak fields when the learner checks in.
 */
export function touchActivity(state: JourneyState, now = new Date()): JourneyState {
  const today = dateKeyPKT(now)
  const last = state.lastActivityAt ? dateKeyPKT(new Date(state.lastActivityAt)) : null

  if (last === today) {
    return {
      ...state,
      lastActivityAt: now.toISOString(),
    }
  }

  const streak = last === yesterdayKeyPKT(now) ? (state.streak || 0) + 1 : 1

  return {
    ...state,
    lastActivityAt: now.toISOString(),
    streak,
    longestStreak: Math.max(state.longestStreak || 0, streak),
  }
}

/**
 * Normalizes progress payloads from disk/API into a full journey state.
 */
export function normalizeJourneyState(
  parsed: Partial<JourneyState> | null | undefined,
): JourneyState {
  return {
    currentId: parsed?.currentId ?? 1,
    completed: Array.isArray(parsed?.completed) ? parsed.completed : [],
    notes: parsed?.notes ?? {},
    lastActivityAt: parsed?.lastActivityAt ?? null,
    streak: parsed?.streak ?? 0,
    longestStreak: parsed?.longestStreak ?? 0,
  }
}
