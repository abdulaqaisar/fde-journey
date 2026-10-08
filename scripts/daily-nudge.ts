import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import nodemailer from 'nodemailer'
import OpenAI from 'openai'
import { daysSinceActivity, normalizeJourneyState } from '../src/lib/activity.ts'
import { getLevelById, getTopicById, topics } from '../src/data/topics.ts'

dotenv.config()

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const progressPath = path.join(root, 'data/progress.json')
const logPath = path.join(root, 'data/last-nudge.json')

interface NudgeMessage {
  subject: string
  whatsapp: string
  emailText: string
  emailHtml: string
  mode: 'shame' | 'push' | 'praise'
}

/**
 * Loads journey progress from the repo file.
 */
function loadProgress() {
  const raw = JSON.parse(fs.readFileSync(progressPath, 'utf8'))
  return normalizeJourneyState(raw)
}

/**
 * Builds OpenAI context for today's accountability nudge.
 */
function buildContext() {
  const progress = loadProgress()
  const topic = getTopicById(progress.currentId) ?? topics[0]
  const level = getLevelById(topic.levelId)
  const missedDays = daysSinceActivity(progress.lastActivityAt)
  const learnedToday = missedDays === 0
  const mode: NudgeMessage['mode'] = learnedToday
    ? 'praise'
    : missedDays >= 2 || !Number.isFinite(missedDays)
      ? 'shame'
      : 'push'

  return { progress, topic, level, missedDays, learnedToday, mode }
}

const insightPool = [
  'FDE insight: customers buy outcomes, not model names. Frame every PoC around the business workflow you will change this week.',
  'FDE insight: RAG quality dies in chunking and metadata, not in fancy frameworks. Treat ingestion like a production data pipeline.',
  'FDE insight: agents without permissions, evals, and human-in-the-loop are demos. Production agents need boring software engineering.',
  'FDE insight: latency, cost, and groundedness are a triangle. Architects choose the tradeoff explicitly — amateurs discover it in production.',
  'FDE insight: if you cannot explain the system to a non-technical stakeholder in 2 minutes, you do not understand the architecture yet.',
  'FDE insight: prompt changes are product changes. Version them, test them, and measure regressions like code.',
]

/**
 * Builds a strong local fallback nudge when OpenAI is unavailable.
 */
function buildFallbackNudge(): NudgeMessage {
  const { progress, topic, level, missedDays, mode } = buildContext()
  const insight = insightPool[topic.id % insightPool.length]
  const missedLabel = Number.isFinite(missedDays) ? String(missedDays) : 'too many'
  const roast =
    mode === 'shame'
      ? `Abdullah, ${missedLabel} day(s) with zero FDE progress? The AI market is shipping while your NestJS comfort zone stays warm. That gap is becoming expensive.`
      : mode === 'praise'
        ? `Good. You showed up. Streak ${progress.streak}. Do not romanticize it — protect it with today's topic.`
        : `Morning call. Streak ${progress.streak}. One topic today or you donate another day to people hungrier than you.`

  const mission = `Today's mission: #${topic.id} — ${topic.title} (Level ${level?.id}: ${level?.title}).\nOpen FDE Journey → Copy daily prompt → Learn → Mark done.`
  const body = `${roast}\n\n${mission}\n\n${insight}\n\nProgress: ${progress.completed.length}/${topics.length}. Best streak: ${progress.longestStreak}.`

  return {
    mode,
    subject:
      mode === 'shame'
        ? `FDE Journey shame alert — ${missedLabel} day(s) behind`
        : mode === 'praise'
          ? `FDE streak ${progress.streak} — keep going`
          : `FDE Journey daily push — topic #${topic.id}`,
    whatsapp: body.slice(0, 900),
    emailText: body,
    emailHtml: `<div style="font-family:Arial,sans-serif;line-height:1.5;white-space:pre-wrap">${body}</div>`,
  }
}

/**
 * Asks OpenAI for a brutal-but-useful daily FDE nudge, with local fallback.
 */
async function generateNudge(): Promise<NudgeMessage> {
  const { progress, topic, level, missedDays, learnedToday, mode } = buildContext()
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    console.warn('OPENAI_API_KEY missing — using local fallback nudge')
    return buildFallbackNudge()
  }

  try {
    const client = new OpenAI({ apiKey })
    const system = `You are the ruthless accountability coach for Abdullah Qaisar's FDE Journey.
He is a Node.js/NestJS engineer aiming for AI FDE / AI Architect roles.
Tone: direct, slightly roasting, never cruel about identity — roast the inaction.
Always include one concrete FDE/AI architecture insight he can use today.
Keep WhatsApp under 900 characters. Email can be a bit longer.
Return ONLY valid JSON with keys: subject, whatsapp, emailText, emailHtml.`

    const user = `Progress snapshot:
- Current topic: #${topic.id} — ${topic.title}
- Level: ${level?.id} ${level?.title}
- Completed topics: ${progress.completed.length}/${topics.length}
- Streak: ${progress.streak}
- Longest streak: ${progress.longestStreak}
- Last activity: ${progress.lastActivityAt ?? 'never'}
- Days since activity: ${Number.isFinite(missedDays) ? missedDays : 'never started'}
- Learned today already: ${learnedToday}
- Desired mode: ${mode}

If mode is shame: roast him hard for falling behind FDE prep, mention how the industry moves while he stalls, then give today's mission.
If mode is push: firm morning push to do today's topic.
If mode is praise: short respect for showing up, still push the next topic + insight.

Include:
1) accountability message
2) today's topic call-to-action
3) one fresh FDE/AI systems insight (RAG, agents, evals, enterprise delivery, architecture tradeoffs, etc.)
4) remind him to open the FDE Journey app, copy the daily prompt, and mark done`

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.85,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('OpenAI returned an empty nudge')
    }

    const parsed = JSON.parse(content) as Partial<NudgeMessage>
    return {
      mode,
      subject: parsed.subject || 'FDE Journey — show up today',
      whatsapp: parsed.whatsapp || 'Open FDE Journey and learn today.',
      emailText: parsed.emailText || parsed.whatsapp || 'Open FDE Journey and learn today.',
      emailHtml:
        parsed.emailHtml ||
        `<pre style="font-family:sans-serif;white-space:pre-wrap">${parsed.emailText || parsed.whatsapp}</pre>`,
    }
  } catch (error) {
    console.warn(
      'OpenAI nudge failed, using local fallback:',
      error instanceof Error ? error.message : String(error),
    )
    return buildFallbackNudge()
  }
}

/**
 * Sends the daily nudge email via SMTP or FormSubmit fallback.
 */
async function sendEmail(nudge: NudgeMessage) {
  const to = process.env.NUDGE_EMAIL || 'abdullahqaisar31@gmail.com'

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true') !== 'false',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: nudge.subject,
      text: nudge.emailText,
      html: nudge.emailHtml,
    })

    return { channel: 'smtp', to }
  }

  const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      name: 'FDE Journey Coach',
      subject: nudge.subject,
      message: nudge.emailText,
      _template: 'table',
      _captcha: 'false',
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Email send failed: ${response.status} ${body}`)
  }

  return { channel: 'formsubmit', to }
}

/**
 * Sends the daily nudge over WhatsApp via CallMeBot.
 */
async function sendWhatsApp(nudge: NudgeMessage) {
  const phone = (process.env.WHATSAPP_PHONE || '923098180851').replace(/\D/g, '')
  const apiKey = process.env.CALLMEBOT_API_KEY

  if (!apiKey) {
    return { channel: 'whatsapp', skipped: true, reason: 'CALLMEBOT_API_KEY missing' }
  }

  const url = new URL('https://api.callmebot.com/whatsapp.php')
  url.searchParams.set('phone', phone)
  url.searchParams.set('text', nudge.whatsapp)
  url.searchParams.set('apikey', apiKey)

  const response = await fetch(url)
  const body = await response.text()
  if (!response.ok || /error|invalid|failed/i.test(body)) {
    throw new Error(`WhatsApp send failed: ${body}`)
  }

  return { channel: 'whatsapp', phone, body }
}

/**
 * Persists a local log of the last nudge attempt.
 */
function writeLog(payload: unknown) {
  fs.writeFileSync(logPath, `${JSON.stringify(payload, null, 2)}\n`)
}

/**
 * Generates and delivers the daily FDE accountability nudge.
 */
async function main() {
  console.log('Generating daily FDE nudge...')
  const context = buildContext()
  const nudge = await generateNudge()

  const results: Record<string, unknown> = {
    at: new Date().toISOString(),
    mode: nudge.mode,
    topicId: context.topic.id,
    missedDays: Number.isFinite(context.missedDays) ? context.missedDays : null,
  }

  try {
    results.email = await sendEmail(nudge)
    console.log('Email sent via', (results.email as { channel: string }).channel)
  } catch (error) {
    results.emailError = error instanceof Error ? error.message : String(error)
    console.error('Email failed:', results.emailError)
  }

  try {
    results.whatsapp = await sendWhatsApp(nudge)
    if ((results.whatsapp as { skipped?: boolean }).skipped) {
      console.warn('WhatsApp skipped:', (results.whatsapp as { reason: string }).reason)
    } else {
      console.log('WhatsApp sent')
    }
  } catch (error) {
    results.whatsappError = error instanceof Error ? error.message : String(error)
    console.error('WhatsApp failed:', results.whatsappError)
  }

  results.preview = {
    subject: nudge.subject,
    whatsapp: nudge.whatsapp,
  }

  writeLog(results)
  console.log('Nudge complete. Log saved to data/last-nudge.json')
  console.log('\n--- WhatsApp preview ---\n')
  console.log(nudge.whatsapp)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
