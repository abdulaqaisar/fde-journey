import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

const PROGRESS_FILE = path.resolve(process.cwd(), 'data/progress.json')

const defaultProgress = {
  currentId: 1,
  completed: [] as number[],
  notes: {} as Record<string, { text: string; updatedAt: string }>,
  lastActivityAt: null as string | null,
  streak: 0,
  longestStreak: 0,
}

/**
 * Ensures the progress JSON file exists on disk.
 */
function ensureProgressFile() {
  const dir = path.dirname(PROGRESS_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(PROGRESS_FILE)) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(defaultProgress, null, 2))
  }
}

/**
 * Reads progress from the project repo file.
 */
function readProgress() {
  ensureProgressFile()
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'))
  } catch {
    return defaultProgress
  }
}

/**
 * Writes progress into the project repo file.
 */
function writeProgress(body: string) {
  ensureProgressFile()
  const parsed = JSON.parse(body)
  fs.writeFileSync(PROGRESS_FILE, `${JSON.stringify(parsed, null, 2)}\n`)
  return parsed
}

/**
 * Collects the full request body as a string.
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/**
 * Vite middleware that stores journey progress in data/progress.json.
 */
function progressMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  if (!req.url?.startsWith('/api/progress')) {
    next()
    return
  }

  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'GET') {
    res.statusCode = 200
    res.end(JSON.stringify(readProgress()))
    return
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    readBody(req)
      .then((body) => {
        const saved = writeProgress(body)
        res.statusCode = 200
        res.end(JSON.stringify(saved))
      })
      .catch((error: Error) => {
        res.statusCode = 400
        res.end(JSON.stringify({ error: error.message }))
      })
    return
  }

  res.statusCode = 405
  res.end(JSON.stringify({ error: 'Method not allowed' }))
}

/**
 * Registers the progress API on the Vite dev server.
 */
export function progressApiPlugin(): Plugin {
  return {
    name: 'fde-progress-api',
    configureServer(server: ViteDevServer) {
      ensureProgressFile()
      server.middlewares.use(progressMiddleware)
    },
  }
}
