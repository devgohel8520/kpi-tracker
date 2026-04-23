# KPI Tracker - Vercel + Neon PostgreSQL

## Quick Deploy

### Step 1: Create Neon Project
1. Go to https://console.neon.tech
2. Create new project (name: kpi-tracker)
3. Copy **Connection String** (DATABASE_URL)

### Step 2: Create Database Tables
In Neon SQL Editor, run:
```sql
CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT);
CREATE TABLE sessions (user_id INT PRIMARY KEY, token TEXT NOT NULL);
CREATE TABLE kpis (id SERIAL PRIMARY KEY, user_id INT NOT NULL, name TEXT NOT NULL, target DECIMAL DEFAULT 0, unit TEXT, frequency TEXT DEFAULT 'daily', color TEXT DEFAULT '#3b82f6', created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE records (id SERIAL PRIMARY KEY, user_id INT NOT NULL, kpi_id INT NOT NULL, value DECIMAL NOT NULL, recorded_at TIMESTAMP DEFAULT NOW());
```

### Step 3: Deploy to Vercel
```bash
npm i -g vercel
vercel
```

### Step 4: Add Environment Variable
In Vercel dashboard → Settings → Environment Variables:
- `DATABASE_URL` = your-neon-connection-string

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Landing page |
| `login.html` | Login |
| `signup.html` | Sign up |
| `app.html` | Main app |
| `neon-client.js` | Neon API client |

---

## Tech Stack
- **Frontend**: Static HTML/JS (Tailwind CSS)
- **Backend**: Vercel serverless API
- **Database**: Neon PostgreSQL

---

## Local Development
1. Create Neon project & run SQL
2. `vercel dev` (runs locally with API)
3. Or open `index.html` in browser for localStorage mode