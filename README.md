# Thunderbird Website

Alpine weather forecasts via satellite SMS - website for thunderbird.bot

## Quick Start (Local)

### Full Stack (Frontend + Backend)

```bash
# Start both servers with one command
./dev.sh
```

This starts:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

### Frontend Only

```bash
npm install
npm run dev
```

Open http://localhost:3000

### Backend Only

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

## Deploy to Vercel

### Option 1: GitHub + Vercel (Recommended)

1. Push to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create thunderbird-web --private --push
```

2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repo
5. Vercel auto-detects Next.js — just click Deploy

### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## Connect Domain

1. In Vercel dashboard → Your project → Settings → Domains
2. Add `thunderbird.bot`
3. Vercel gives you DNS records to add

At your domain registrar, add:
- **A Record**: `@` → `76.76.21.21`
- **CNAME**: `www` → `cname.vercel-dns.com`

(Vercel will show exact values — use those)

## Pages

- `/` - Landing page
- `/trails/western-arthurs` - Western Arthurs info
- `/trails/overland-track` - Overland Track info  
- `/how-it-works` - How the service works
- `/pricing` - Pricing info
- `/faq` - Frequently asked questions
- `/register` - Waitlist signup
- `/contact` - Contact info
- `/terms` - Terms of service
- `/privacy` - Privacy policy
- `/safety` - Safety disclaimer

## Next Steps

When ready to add payments:
1. Set up Stripe account
2. Add environment variables in Vercel
3. Connect webhook endpoint

## Environment Variables (for later)

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
```
