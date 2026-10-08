# FDE Journey

Daily learning companion for the AI → FDE → Architect roadmap.

## Run the app

```bash
npm install
npm run dev
```

## Daily accountability nudges

Every morning the project can email/WhatsApp you:

- today's topic
- a roast if you skipped
- an FDE insight

### 1) Configure secrets

Copy `.env.example` to `.env` and fill:

- `OPENAI_API_KEY` (add billing credits at OpenAI)
- `CALLMEBOT_API_KEY` for WhatsApp
- optional Gmail SMTP vars for reliable email

WhatsApp (CallMeBot) one-time setup:

1. Add `+34 644 59 71 67` in WhatsApp contacts
2. Message: `I allow callmebot to send me messages`
3. Put the received apikey in `.env` as `CALLMEBOT_API_KEY`

Email: first FormSubmit send asks you to confirm `abdullahqaisar31@gmail.com`. After that, daily mail works. SMTP is better long-term.

### 2) Send a nudge now

```bash
npm run nudge
```

### 3) Keep it running locally

```bash
npm run nudge:schedule
```

Default: every day at **09:00 Asia/Karachi**.

### 4) GitHub Action (laptop off still works)

Workflow: `.github/workflows/daily-nudge.yml` at 09:00 PKT.

Set repo secret:

```bash
gh secret set OPENAI_API_KEY --repo abdulaqaisar/fde-journey
gh secret set CALLMEBOT_API_KEY --repo abdulaqaisar/fde-journey
```

## Progress storage

Notes, streak, and completed topics save to `data/progress.json` while `npm run dev` is running.
