import cron from 'node-cron'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Runs the daily nudge script once.
 */
function runNudge() {
  console.log(`[${new Date().toISOString()}] Firing daily nudge...`)
  const child = spawn('npx', ['tsx', 'scripts/daily-nudge.ts'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })

  child.on('exit', (code) => {
    console.log(`[${new Date().toISOString()}] Nudge exited with code ${code ?? 'null'}`)
  })
}

const expression = process.env.NUDGE_CRON || '0 9 * * *'

if (!cron.validate(expression)) {
  throw new Error(`Invalid NUDGE_CRON expression: ${expression}`)
}

console.log(`FDE Journey nudge scheduler running. Cron: ${expression} (Asia/Karachi)`)
cron.schedule(expression, runNudge, { timezone: 'Asia/Karachi' })

if (process.env.NUDGE_RUN_ON_START === 'true') {
  runNudge()
}
