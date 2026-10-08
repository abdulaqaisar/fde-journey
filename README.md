# FDE Journey

Daily AI → FDE → Architect learning companion.

**Live app:** [https://fde-journey.vercel.app](https://fde-journey.vercel.app)  
**Dashboard:** [Vercel project](https://vercel.com/abdullah-qaisars-projects/fde-journey)  
**Repo:** [abdulaqaisar/fde-journey](https://github.com/abdulaqaisar/fde-journey)

## Local development

```bash
npm install
npm run dev
```

Local progress saves to `data/progress.json` through the Vite middleware.

## Production (Vercel)

On Vercel:

- UI is served from the Vite build
- `GET/PUT /api/progress` syncs progress into GitHub `data/progress.json`
- `GET /api/nudge` sends the daily accountability message
- Cron runs daily at **09:00 Asia/Karachi** (`0 4 * * *` UTC)

### Environment variables (already set on Vercel)

- `GITHUB_PROGRESS_TOKEN`
- `OPENAI_API_KEY`
- `NUDGE_EMAIL`
- `WHATSAPP_PHONE`
- `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH`

### Make email reliable from Vercel

FormSubmit is often blocked on Vercel IPs. Add Gmail SMTP:

1. Create a [Google App Password](https://myaccount.google.com/apppasswords)
2. Set these Vercel envs:

```bash
npx vercel env add SMTP_HOST production
# smtp.gmail.com
npx vercel env add SMTP_PORT production
# 465
npx vercel env add SMTP_USER production
# abdullahqaisar31@gmail.com
npx vercel env add SMTP_PASS production
# your-app-password
npx vercel env add SMTP_FROM production
# FDE Journey <abdullahqaisar31@gmail.com>
```

### WhatsApp

1. Add `+34 644 59 71 67` in WhatsApp contacts
2. Message: `I allow callmebot to send me messages`
3. Set `CALLMEBOT_API_KEY` in `.env` and Vercel

```bash
npx vercel env add CALLMEBOT_API_KEY production
```

### Manual nudge

```bash
curl https://fde-journey.vercel.app/api/nudge
# or locally
npm run nudge
```

GitHub Action `.github/workflows/daily-nudge.yml` is a second daily backup path.
