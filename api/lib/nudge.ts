import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import nodemailer from 'nodemailer'
import OpenAI from 'openai'
import {
  daysSinceActivity,
  type CurriculumLevel,
  type CurriculumTopic,
  type JourneyState,
} from './shared.js'

interface NudgeMessage {
  subject: string
  whatsapp: string
  emailText: string
  emailHtml: string
  mode: 'shame' | 'push' | 'praise'
}

interface Curriculum {
  levels: CurriculumLevel[]
  topics: CurriculumTopic[]
}

/**
 * Loads the exported curriculum JSON packaged with the function.
 */
function loadCurriculum(): Curriculum {
  const filePath = join(process.cwd(), 'data/curriculum.json')
  return JSON.parse(readFileSync(filePath, 'utf8')) as Curriculum
}

/**
 * Builds accountability context from current progress.
 */
function buildContext(progress: JourneyState) {
  const curriculum = loadCurriculum()
  const topic = curriculum.topics.find((item) => item.id === progress.currentId) ?? curriculum.topics[0]
  const level = curriculum.levels.find((item) => item.id === topic.levelId)
  const missedDays = daysSinceActivity(progress.lastActivityAt)
  const learnedToday = missedDays === 0
  const mode: NudgeMessage['mode'] = learnedToday
    ? 'praise'
    : missedDays >= 2 || !Number.isFinite(missedDays)
      ? 'shame'
      : 'push'

  return { curriculum, topic, level, missedDays, learnedToday, mode }
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
 * Builds a local fallback nudge when OpenAI is unavailable.
 */
function buildFallbackNudge(progress: JourneyState): NudgeMessage {
  const { curriculum, topic, level, missedDays, mode } = buildContext(progress)
  const insight = insightPool[topic.id % insightPool.length]
  const missedLabel = Number.isFinite(missedDays) ? String(missedDays) : 'too many'
  const roast =
    mode === 'shame'
      ? `Abdullah, ${missedLabel} day(s) with zero FDE progress? The AI market is shipping while your NestJS comfort zone stays warm. That gap is becoming expensive.`
      : mode === 'praise'
        ? `Good. You showed up. Streak ${progress.streak}. Do not romanticize it — protect it with today's topic.`
        : `Morning call. Streak ${progress.streak}. One topic today or you donate another day to people hungrier than you.`

  const mission = `Today's mission: #${topic.id} — ${topic.title} (Level ${level?.id}: ${level?.title}).\nOpen https://fde-journey.vercel.app → Copy daily prompt → Learn → Mark done.`
  const body = `${roast}\n\n${mission}\n\n${insight}\n\nProgress: ${progress.completed.length}/${curriculum.topics.length}. Best streak: ${progress.longestStreak}.`

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
 * Generates the daily nudge with OpenAI, falling back locally on failure.
 */
async function generateNudge(progress: JourneyState): Promise<NudgeMessage> {
  const { curriculum, topic, level, missedDays, learnedToday, mode } = buildContext(progress)
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return buildFallbackNudge(progress)

  try {
    const client = new OpenAI({ apiKey })
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.85,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are the ruthless accountability coach for Abdullah Qaisar's FDE Journey.
Tone: direct, slightly roasting. Roast inaction, not identity.
Keep WhatsApp under 900 characters.
Return ONLY valid JSON with keys: subject, whatsapp, emailText, emailHtml.`,
        },
        {
          role: 'user',
          content: `Current topic: #${topic.id} — ${topic.title}
Level: ${level?.id} ${level?.title}
Completed: ${progress.completed.length}/${curriculum.topics.length}
Streak: ${progress.streak}
Last activity: ${progress.lastActivityAt ?? 'never'}
Days since activity: ${Number.isFinite(missedDays) ? missedDays : 'never started'}
Learned today: ${learnedToday}
Mode: ${mode}
App URL: https://fde-journey.vercel.app`,
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) throw new Error('empty')
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
  } catch {
    return buildFallbackNudge(progress)
  }
}

/**
 * Sends email through SMTP or FormSubmit.
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
    throw new Error(`Email send failed: ${response.status} ${await response.text()}`)
  }

  return { channel: 'formsubmit', to }
}

/**
 * Sends WhatsApp through CallMeBot when configured.
 */
async function sendWhatsApp(nudge: NudgeMessage) {
  const phone = (process.env.WHATSAPP_PHONE || '923098180851').replace(/\D/g, '')
  const apiKey = process.env.CALLMEBOT_API_KEY
  if (!apiKey) {
    return { channel: 'whatsapp', skipped: true as const, reason: 'CALLMEBOT_API_KEY missing' }
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
  return { channel: 'whatsapp', phone, body, skipped: false as const }
}

/**
 * Generates and delivers the daily nudge across configured channels.
 */
export async function runDailyNudge(progress: JourneyState) {
  const context = buildContext(progress)
  const nudge = await generateNudge(progress)
  const results: Record<string, unknown> = {
    at: new Date().toISOString(),
    mode: nudge.mode,
    topicId: context.topic.id,
    missedDays: Number.isFinite(context.missedDays) ? context.missedDays : null,
    preview: { subject: nudge.subject, whatsapp: nudge.whatsapp },
  }

  try {
    results.email = await sendEmail(nudge)
  } catch (error) {
    results.emailError = error instanceof Error ? error.message : String(error)
  }

  try {
    results.whatsapp = await sendWhatsApp(nudge)
  } catch (error) {
    results.whatsappError = error instanceof Error ? error.message : String(error)
  }

  return results
}
