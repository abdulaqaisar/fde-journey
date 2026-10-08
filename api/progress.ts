import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  loadProgressFromGitHub,
  normalizeJourneyState,
  saveProgressToGitHub,
} from './lib/shared.js'

/**
 * Reads or writes learning progress for the deployed app.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  try {
    if (req.method === 'GET') {
      res.status(200).json(await loadProgressFromGitHub())
      return
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      res.status(200).json(await saveProgressToGitHub(normalizeJourneyState(req.body)))
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Progress API failed',
    })
  }
}
