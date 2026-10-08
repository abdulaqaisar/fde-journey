import type { VercelRequest, VercelResponse } from '@vercel/node'
import { runDailyNudge } from './lib/nudge.js'
import { loadProgressFromGitHub } from './lib/shared.js'

/**
 * Verifies cron/manual auth for the nudge endpoint.
 */
function isAuthorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true

  const auth = req.headers.authorization
  if (auth === `Bearer ${secret}`) return true

  const cronHeader = req.headers['x-vercel-cron-schedule']
  const userAgent = String(req.headers['user-agent'] || '')
  if (cronHeader || userAgent.includes('vercel-cron')) return true

  return false
}

/**
 * Sends the daily FDE accountability nudge (email/WhatsApp).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const progress = await loadProgressFromGitHub()
    const results = await runDailyNudge(progress)
    res.status(200).json({ ok: true, results })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Nudge failed',
    })
  }
}
