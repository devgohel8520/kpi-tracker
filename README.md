# KPI Tracker - Vercel + Supabase Deployment

## Quick Deploy to Vercel

### Step 1: Create Supabase Project
1. Go to https://supabase.com and create free account
2. Create new project (name: kpi-tracker)
3. Wait for setup to complete

### Step 2: Setup Database
1. In Supabase dashboard, go to **SQL Editor**
2. Copy the entire content of `supabase-setup.sql`
3. Paste and run

### Step 3: Get Credentials
1. Go to **Settings > API**
2. Copy **Project URL** (e.g., `https://abc123.supabase.co`)
3. Copy **anon public key** (starts with `eyJ...`)

### Step 4: Configure Frontend
Open `supabase-client.js` and replace the placeholder values:

```javascript
const SUPABASE_URL = 'https://abc123.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### Step 5: Deploy to Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Or push to GitHub and connect in Vercel dashboard

### Alternative: GitHub Pages (Even Simpler)
Since Vercel hosts static sites for free, you can just:
1. Upload all HTML + JS files to a GitHub repository
2. Enable GitHub Pages in repository settings
3. Your files become available at `https://username.github.io/repo-name/`

---

## Files to Upload

| File | Purpose |
|------|---------|
| `landing.html` | Landing/Home page |
| `login.html` | Login page |
| `signup.html` | Sign up page |
| `app.html` | Main KPI tracking app |
| `supabase-client.js` | Supabase client & data layer |
| `supabase-setup.sql` | Database schema (run in Supabase) |

---

## Project Structure

```
kpi-tracker/
├── landing.html      # Landing page
├── login.html       # Login page  
├── signup.html      # Sign up page
├── app.html        # Main app (dashboard, KPIs, records)
├── supabase-client.js  # Data layer (replaces common.js)
├── supabase-setup.sql   # Database schema
└── README.md      # This file
```

---

## Testing Locally

1. Create Supabase project
2. Run `supabase-setup.sql` in SQL Editor
3. Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `supabase-client.js`
4. Open `landing.html` in browser (use a local server like VS Code Live Server)
5. Sign up, then use the app

---

## Supabase Free Tier Limits

- 500MB Database
- 2GB Storage  
- 100MB File Storage
- 50K Monthly active users
- 500MB Bandwidth/month

**More than enough for personal KPI tracking!**