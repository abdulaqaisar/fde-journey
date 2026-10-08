import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { topics } from '../data/topics'
import {
  defaultJourneyState,
  normalizeJourneyState,
  touchActivity,
  type JourneyState,
} from '../lib/activity'

export type { JourneyState, TopicNote } from '../lib/activity'

/**
 * Loads journey state from the repo-backed API.
 */
async function fetchState(): Promise<JourneyState> {
  const response = await fetch('/api/progress')
  if (!response.ok) {
    throw new Error('Failed to load progress')
  }
  return normalizeJourneyState(await response.json())
}

/**
 * Persists journey state into data/progress.json via the Vite API.
 */
async function persistState(state: JourneyState): Promise<void> {
  const response = await fetch('/api/progress', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  })
  if (!response.ok) {
    throw new Error('Failed to save progress')
  }
}

/**
 * Persists journey progress, notes, and current topic in the project repo.
 */
export function useJourney() {
  const [state, setState] = useState<JourneyState>(defaultJourneyState)
  const [ready, setReady] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const skipNextPersist = useRef(true)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchState()
      .then((loaded) => {
        if (cancelled) return
        skipNextPersist.current = true
        setState(loaded)
        setReady(true)
      })
      .catch(() => {
        if (cancelled) return
        skipNextPersist.current = true
        setState(defaultJourneyState)
        setReady(true)
        setSaveError('Could not load progress from the repo file.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    if (skipNextPersist.current) {
      skipNextPersist.current = false
      return
    }

    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
    }

    saveTimer.current = window.setTimeout(() => {
      persistState(state)
        .then(() => setSaveError(null))
        .catch(() => setSaveError('Could not save progress to data/progress.json.'))
    }, 1200)

    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current)
      }
    }
  }, [state, ready])

  const completedSet = useMemo(() => new Set(state.completed), [state.completed])

  const progress = useMemo(() => {
    const done = state.completed.length
    return {
      done,
      total: topics.length,
      percent: Math.round((done / topics.length) * 100),
      streak: state.streak,
      longestStreak: state.longestStreak,
      lastActivityAt: state.lastActivityAt,
    }
  }, [state.completed.length, state.streak, state.longestStreak, state.lastActivityAt])

  /**
   * Selects a topic as the active learning focus.
   */
  const selectTopic = useCallback((id: number) => {
    setState((prev) => ({ ...prev, currentId: id }))
  }, [])

  /**
   * Marks the current topic complete and advances to the next incomplete one.
   */
  const completeAndAdvance = useCallback(() => {
    setState((prev) => {
      const completed = prev.completed.includes(prev.currentId)
        ? prev.completed
        : [...prev.completed, prev.currentId].sort((a, b) => a - b)

      const next =
        topics.find((topic) => topic.id > prev.currentId && !completed.includes(topic.id)) ??
        topics.find((topic) => !completed.includes(topic.id))

      return touchActivity({
        ...prev,
        completed,
        currentId: next?.id ?? prev.currentId,
      })
    })
  }, [])

  /**
   * Toggles completion for a topic without changing the current focus.
   */
  const toggleComplete = useCallback((id: number) => {
    setState((prev) => {
      const exists = prev.completed.includes(id)
      const next = {
        ...prev,
        completed: exists
          ? prev.completed.filter((item) => item !== id)
          : [...prev.completed, id].sort((a, b) => a - b),
      }
      return exists ? next : touchActivity(next)
    })
  }, [])

  /**
   * Saves a personal note for a topic and counts as daily activity.
   */
  const saveNote = useCallback((id: number, text: string) => {
    setState((prev) =>
      touchActivity({
        ...prev,
        notes: {
          ...prev.notes,
          [String(id)]: {
            text,
            updatedAt: new Date().toISOString(),
          },
        },
      }),
    )
  }, [])

  /**
   * Explicit check-in for the day without completing a topic.
   */
  const checkInToday = useCallback(() => {
    setState((prev) => touchActivity(prev))
  }, [])

  /**
   * Moves to the previous or next topic in order.
   */
  const moveBy = useCallback((delta: number) => {
    setState((prev) => {
      const nextId = Math.min(topics.length, Math.max(1, prev.currentId + delta))
      return { ...prev, currentId: nextId }
    })
  }, [])

  return {
    state,
    ready,
    saveError,
    completedSet,
    progress,
    selectTopic,
    completeAndAdvance,
    toggleComplete,
    saveNote,
    checkInToday,
    moveBy,
  }
}
