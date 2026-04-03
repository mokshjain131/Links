# Links — Setup Guide

> Step-by-step instructions for setting up the Links project from scratch.

---

## Prerequisites

| Requirement        | Version    | Purpose                          |
|--------------------|-----------|----------------------------------|
| **Python**         | 3.11+     | Backend runtime                   |
| **Node.js**        | 18+ (20 recommended) | Frontend build tooling   |
| **npm**            | 9+        | Node package manager              |
| **yt-dlp**         | Latest    | YouTube/TikTok metadata scraping  |
| **Git**            | Any       | Version control                   |

### External Accounts Required

| Service       | URL                            | Purpose                        | Free Tier |
|---------------|--------------------------------|--------------------------------|-----------|
| **Supabase**  | https://supabase.com           | Database + Authentication      | Yes       |
| **Google AI Studio** | https://aistudio.google.com | Gemini API key                | Yes (rate-limited) |

---

## 1. Clone the Repository

```bash
git clone https://github.com/your-username/Links.git
cd Links
```

---

## 2. Supabase Project Setup

### 2.1 Create a Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Click **New project**.
3. Choose an organization, name the project (e.g. "Links"), set a database password, and select a region.
4. Wait for the project to be provisioned (~2 minutes).

### 2.2 Get Your API Keys

1. In your project dashboard, go to **Settings → API**.
2. Copy the following values:
   - **Project URL** — e.g. `https://abcdefghijk.supabase.co`
   - **anon / public key** — starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS...`

### 2.3 Run the Database Migration

1. In the Supabase dashboard, go to **SQL Editor**.
2. Click **New query**.
3. Paste the contents of `backend/migration.sql`:

```sql
create table if not exists posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  url          text not null,
  platform     text,
  title        text,
  summary      text,
  category     text,
  subcategory  text,
  tags         text[] default '{}',
  sentiment    text,
  content_type text,
  thumbnail_url text,
  author       text,
  saved_at     timestamptz default now()
);

create index if not exists idx_posts_user_id on posts(user_id);
create index if not exists idx_posts_category on posts(user_id, category);
create index if not exists idx_posts_saved_at on posts(user_id, saved_at desc);
create unique index if not exists idx_posts_user_url on posts(user_id, url);

alter table posts disable row level security;
```

4. Click **Run**. You should see "Success. No rows returned."

### 2.4 Disable Email Confirmation (Recommended for Development)

1. In the Supabase dashboard, go to **Authentication → Providers → Email**.
2. Toggle **off** "Confirm email".
3. Click **Save**.

This allows immediate login after signup without needing to click a confirmation email link.

---

## 3. Get a Gemini API Key

1. Go to [aistudio.google.com/api-keys](https://aistudio.google.com/api-keys).
2. Click **Create API key**.
3. Select or create a Google Cloud project.
4. Copy the API key (starts with `AIzaSy...`).

> **Free Tier Limits**: Gemini 2.5 Flash has a free tier with rate limits (requests per minute and per day). If you hit rate limits, the app will still save posts with "Uncategorized" classification and you can re-save later.

---

## 4. Backend Setup

### 4.1 Create a Virtual Environment

```bash
cd backend
python -m venv venv
```

### 4.2 Activate the Virtual Environment

**Windows (PowerShell):**
```powershell
.\venv\Scripts\Activate.ps1
```

**Windows (Command Prompt):**
```cmd
.\venv\Scripts\activate.bat
```

**macOS / Linux:**
```bash
source venv/bin/activate
```

### 4.3 Install Python Dependencies

```bash
pip install -r requirements.txt
```

This installs:

| Package              | Purpose                                     |
|----------------------|---------------------------------------------|
| `fastapi`            | Web framework for REST API                  |
| `uvicorn`            | ASGI server to run FastAPI                  |
| `python-dotenv`      | Loads `.env` file into environment variables |
| `pydantic`           | Request/response schema validation          |
| `supabase`           | Supabase Python client (database access)    |
| `google-genai`       | Google Gemini AI SDK                        |
| `yt-dlp`             | YouTube/TikTok metadata scraping            |
| `instaloader`        | Instagram post metadata scraping            |
| `requests`           | HTTP client for generic scraping            |
| `beautifulsoup4`     | HTML parsing for `og:` meta tags            |

### 4.4 Install yt-dlp System Binary

`yt-dlp` is also needed as a command-line tool (called via `subprocess`):

```bash
pip install yt-dlp
```

Verify it works:
```bash
yt-dlp --version
```

### 4.5 Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Edit `backend/.env`:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-anon-key
GEMINI_API_KEY=AIzaSy...your-gemini-key
FRONTEND_ORIGIN=http://localhost:5173
```

> **Note**: Use the **anon/public key** from Supabase (not the service_role key) since RLS is disabled in development.

### 4.6 Start the Backend Server

```bash
uv run uvicorn main:app --reload --port 8001
```
*(Note: Port 8001 is deliberately used to avoid common Windows port zombie freezing issues on 8000).*

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Application startup complete.
```

### 4.7 Verify the Backend

Open your browser or use curl:
```bash
curl http://localhost:8001/health
```

Expected response:
```json
{"status": "ok"}
```

---

## 5. Frontend Setup

### 5.1 Install Node Dependencies

```bash
cd frontend
npm install
```

This installs:

| Package              | Purpose                                    |
|----------------------|--------------------------------------------|
| `react`              | UI library                                 |
| `react-dom`          | React DOM renderer                         |
| `react-router-dom`   | Client-side routing                        |
| `@supabase/supabase-js` | Supabase JavaScript client (auth)      |
| `recharts`           | Chart library for analytics                |
| `vite`               | Build tool and dev server                  |
| `@vitejs/plugin-react` | Vite React plugin (JSX/HMR support)     |

### 5.2 Configure Environment Variables

Create `frontend/.env`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-anon-key
VITE_API_URL=http://localhost:8001
VITE_DEV_BYPASS=false
```

> **Dev Bypass Mode**: Set `VITE_DEV_BYPASS=true` to skip Supabase auth entirely. Useful when you don't have Supabase configured or are hitting auth rate limits. The backend automatically recognizes the bypass token.

### 5.3 Start the Frontend Dev Server

```bash
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
```

---

## 6. First Run — End-to-End Test

1. Open **http://localhost:5173/** in your browser.
2. You should see the **Links** login page.
3. Click **"Sign up"** and create an account with email + password (min 6 characters).
4. After signing up, you'll be automatically logged in (if email confirmation is disabled).
5. On the Feed page, **paste a YouTube URL** into the input field, e.g.:
   ```
   https://www.youtube.com/watch?v=dQw4w9WgXcQ
   ```
6. Click **"Save Link"**.
7. Wait 5–15 seconds. The backend will:
   - Scrape the video metadata via yt-dlp
   - Send the title/description to Gemini for AI classification
   - Save the enriched post to Supabase
8. The post should appear in your feed with:
   - Title (e.g. "Rick Astley - Never Gonna Give You Up")
   - Category (e.g. "Music"), subcategory (e.g. "Pop Music")
   - Tags (e.g. "Rick Astley", "80s Music", "Pop")
   - Sentiment (e.g. "Neutral")
   - Content type (e.g. "Entertainment")
9. Navigate to **Categories** to see analytics charts.
10. Navigate to **Ask** and try: "What have I saved?"

---

## 7. Troubleshooting

### "Email not confirmed" error on login

**Cause**: Supabase has email confirmation enabled by default.
**Fix**: Go to Supabase Dashboard → Authentication → Providers → Email → toggle off "Confirm email".

### 429 Too Many Requests when saving links

**Cause**: Gemini free tier rate limit exceeded.
**Behavior**: Posts are still saved with "Uncategorized" category. AI classification will work again after the rate limit resets.
**Fix**: Wait for the rate limit to reset (resets daily), or upgrade to a paid Gemini plan.

### CORS errors in the browser console

**Cause**: Backend CORS is configured for `http://localhost:5173` by default.
**Fix**: Make sure `FRONTEND_ORIGIN` in `backend/.env` matches your frontend URL exactly. Restart the backend after changing.

### "Scraping failed" error

**Cause**: `yt-dlp` is not installed or outdated.
**Fix**:
```bash
pip install --upgrade yt-dlp
```

### Posts show "Uncategorized" instead of proper categories

**Cause**: Either Gemini API key is invalid, rate-limited, or `max_output_tokens` is too low.
**Fix**: Verify your API key at [aistudio.google.com](https://aistudio.google.com). Check the backend logs for specific error messages.

### Database connection errors

**Cause**: Supabase project may be paused (free tier projects pause after 7 days of inactivity).
**Fix**: Go to the Supabase dashboard and unpause the project.

---

## 8. Production Deployment

### Backend (e.g. Render, Railway)

1. Set all environment variables from `backend/.env` in the deployment platform.
2. **Build command**: `pip install -r requirements.txt`
3. **Start command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Update `FRONTEND_ORIGIN` to match your deployed frontend URL.

### Frontend (e.g. Vercel, Netlify)

1. Set all environment variables from `frontend/.env` in the deployment platform.
2. **Build command**: `npm run build`
3. **Output directory**: `dist`
4. Update `VITE_API_URL` to point to your deployed backend URL.
5. Configure the hosting platform to redirect all routes to `index.html` (SPA routing).

### Security Checklist

- [ ] Enable Row-Level Security (RLS) on the `posts` table with policies scoped to `auth.uid()`.
- [ ] Add a foreign key constraint from `posts.user_id` to `auth.users(id)`.
- [ ] Use the Supabase **service_role key** on the backend (NOT the anon key) to bypass RLS server-side.
- [ ] Set `VITE_DEV_BYPASS=false` (or remove the variable entirely).
- [ ] Enable email confirmation in Supabase for production.
- [ ] Validate JWTs properly on the backend (use a JWT library with secret verification instead of just decoding).
- [ ] Add rate limiting to the backend API.

---

## 9. Development Tips

### Hot Reloading

- **Backend**: `uvicorn main:app --reload` watches for file changes automatically.
- **Frontend**: Vite provides instant HMR (Hot Module Replacement).

### Testing the API Directly

The FastAPI backend auto-generates interactive API docs:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Useful Commands

```bash
# Backend
cd backend
.\venv\Scripts\activate          # Activate virtualenv (Windows)
python -m uvicorn main:app --reload --port 8001  # Start backend

# Frontend
cd frontend
npm run dev                      # Start dev server
npm run build                    # Production build
npm run preview                  # Preview production build
```
