import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { runDailyNudge } from '../api/lib/nudge.js'
import { normalizeJourneyState } from '../api/lib/shared.js'

dotenv.config()

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const progressPath = path.join(root, 'data/progress.json')
const logPath = path.join(root, 'data/last-nudge.json')

/**
 * Loads journey progress from the local repo file.
 */
function loadProgress() {
  const raw = JSON.parse(fs.readFileSync(progressPath, 'utf8'))
  return normalizeJourneyState(raw)
}

/**
 * Generates and delivers the daily FDE accountability nudge.
 */
async function main() {
  console.log('Generating daily FDE nudge...')
  const results = await runDailyNudge(loadProgress())
  fs.writeFileSync(logPath, `${JSON.stringify(results, null, 2)}\n`)
  console.log('Nudge complete. Log saved to data/last-nudge.json')

  const preview = results.preview as { whatsapp?: string; subject?: string }
  if (results.email) console.log('Email sent via', (results.email as { channel: string }).channel)
  if (results.emailError) console.error('Email failed:', results.emailError)
  if ((results.whatsapp as { skipped?: boolean } | undefined)?.skipped) {
    console.warn('WhatsApp skipped:', (results.whatsapp as { reason: string }).reason)
  } else if (results.whatsapp) {
    console.log('WhatsApp sent')
  }
  if (results.whatsappError) console.error('WhatsApp failed:', results.whatsappError)

  console.log('\n--- WhatsApp preview ---\n')
  console.log(preview?.whatsapp || preview?.subject || '')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
