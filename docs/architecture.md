# Architecture

## System Overview

```
User
  ↓
React Frontend (Vite)
  ↓
FastAPI Backend
  ├── scraper.py     → yt-dlp / instaloader
  ├── gemini.py      → Gemini 2.0 Flash API
  └── db.py          → Supabase (Postgres + Auth)
```

---

## Layers

### 1. Frontend — React + Vite

Three pages, no state management library. Just `useState` and `useEffect`.

| Page | Responsibility |
|---|---|
| `Home.jsx` | Paste URL, view feed, search and filter posts |
| `Category.jsx` | Filtered view by category, analytics charts |
| `Ask.jsx` | Chat interface for ask your feed |

Auth state is managed by the Supabase JS client directly in the browser. All backend communication is over REST.

---

### 2. Backend — FastAPI (Render free tier)

Five modules. Each does one job.

| Module | Responsibility |
|---|---|
| `main.py` | All route definitions |
| `scraper.py` | Extracts metadata from URLs via yt-dlp and instaloader |
| `gemini.py` | All Gemini API calls: categorize, summarize, sentiment, ask |
| `db.py` | All Supabase read/write queries |
| `models.py` | Pydantic request and response schemas |

No ORM. Supabase Python client is used directly.

---

### 3. External Services — all free tier

| Service | Role | Free limit |
|---|---|---|
| Supabase | Postgres database + Auth | 500MB DB, 50k MAU |
| Gemini 2.0 Flash | All AI tasks | 1M tokens/day, 15 RPM |
| Render | FastAPI hosting | 750 hrs/month |

> **Note:** Render free tier spins down after inactivity. First request after idle takes ~30s.

---

## Database Schema

Two tables only.

```sql
-- Managed by Supabase Auth
users (
  id        uuid primary key,
  email     text
)

-- One row per saved post
posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id),
  url          text not null,
  platform     text,           -- youtube | instagram | tiktok | other
  title        text,
  summary      text,
  category     text,
  tags         text[],
  sentiment    text,           -- positive | neutral | negative
  content_type text,           -- educational | entertainment | opinion | news
  saved_at     timestamptz default now()
)
```

---

## Key Design Decisions

- No self-hosted ML models. Gemini handles all intelligence remotely.
- No vector DB or embeddings. Gemini's 1M token context window fits all user posts as plain JSON.
- No task queues. Save requests are synchronous — acceptable for a single user project.
- No ORM. Supabase Python client is lightweight and sufficient.
- Duplicate detection is a simple URL string match before scraping.
- Platform detection is done by checking the URL domain to pick the right scraper.