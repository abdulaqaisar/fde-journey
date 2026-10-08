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

export interface CurriculumTopic {
  id: number
  title: string
  levelId: number
}

export interface CurriculumLevel {
  id: number
  title: string
  note: string | null
  tone: string
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
 * Normalizes progress payloads into a full journey state.
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

const OWNER = process.env.GITHUB_OWNER || 'abdulaqaisar'
const REPO = process.env.GITHUB_REPO || 'fde-journey'
const PATH = 'data/progress.json'
const BRANCH = process.env.GITHUB_BRANCH || 'main'

/**
 * Returns a GitHub token used to read/write progress in the repo.
 */
function githubToken(): string | undefined {
  return process.env.GITHUB_PROGRESS_TOKEN || process.env.GITHUB_TOKEN
}

/**
 * Loads journey progress from GitHub Contents API.
 */
export async function loadProgressFromGitHub(): Promise<JourneyState> {
  const token = githubToken()
  if (!token) return defaultJourneyState

  const response = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${BRANCH}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'fde-journey',
      },
    },
  )

  if (response.status === 404) return defaultJourneyState
  if (!response.ok) throw new Error(`GitHub progress read failed: ${response.status}`)

  const payload = (await response.json()) as { content?: string }
  const decoded = Buffer.from(payload.content || '', 'base64').toString('utf8')
  return normalizeJourneyState(JSON.parse(decoded))
}

/**
 * Saves journey progress back into data/progress.json via GitHub.
 */
export async function saveProgressToGitHub(state: JourneyState): Promise<JourneyState> {
  const token = githubToken()
  if (!token) throw new Error('GITHUB_PROGRESS_TOKEN is required in production')

  const current = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${BRANCH}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'fde-journey',
      },
    },
  )

  let sha: string | undefined
  if (current.ok) {
    const payload = (await current.json()) as { sha?: string }
    sha = payload.sha
  }

  const normalized = normalizeJourneyState(state)
  const response = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`,
    {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'fde-journey',
      },
      body: JSON.stringify({
        message: `chore: update learning progress (#${normalized.currentId})`,
        content: Buffer.from(`${JSON.stringify(normalized, null, 2)}\n`).toString('base64'),
        branch: BRANCH,
        ...(sha ? { sha } : {}),
      }),
    },
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`GitHub progress write failed: ${response.status} ${text}`)
  }

  return normalized
}
