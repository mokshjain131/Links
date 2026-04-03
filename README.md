# Links

Save, categorize, and explore your social media content with AI-powered analysis.

Paste any URL from YouTube, Instagram, TikTok, or the web — Links automatically extracts metadata, classifies it with Gemini 2.0 Flash (topic, sentiment, content type), and organizes everything into a searchable feed.

## Features

- **Content Ingestion** — Paste URLs from YouTube, Instagram, TikTok, or any website
- **AI Classification** — Auto-categorize, summarize, tag, and sentiment-analyze each post via Gemini
- **Smart Organization** — Filter by category, platform, sentiment, or content type. Search by keyword.
- **Ask Your Feed** — Chat with your saved content using natural language questions
- **Analytics** — Bar charts, pie charts, sentiment distribution, top tags, weekly trends
- **Export** — Download any category as CSV or JSON

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Backend | Python FastAPI |
| Database | Supabase (Postgres + Auth) |
| AI | Google Gemini 2.0 Flash |
| Scraping | yt-dlp + instaloader |

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- A [Supabase](https://supabase.com) project (free tier)
- A [Google AI Studio](https://aistudio.google.com) API key

### 1. Clone & set up environment

```bash
git clone <repo-url> links
cd links
```

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

pip install -r requirements.txt

# Copy .env.example to .env and fill in your keys
cp .env.example .env
```

Run the Supabase SQL migration (found in `docs/module-specifications.md`) in your Supabase SQL Editor.

Start the backend:

```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend

# Copy .env.example to .env and fill in your keys
cp .env.example .env

npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
links/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx          # paste URL, see feed
│   │   │   ├── Category.jsx      # filtered view + analytics
│   │   │   └── Ask.jsx           # ask your feed chat
│   │   ├── components/
│   │   │   ├── PostCard.jsx
│   │   │   ├── CategorySidebar.jsx
│   │   │   └── AskBar.jsx
│   │   ├── lib/
│   │   │   ├── supabase.js       # Supabase client
│   │   │   └── api.js            # API client
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css             # Design system
│   ├── index.html
│   └── package.json
│
├── backend/
│   ├── main.py                   # FastAPI app, all routes
│   ├── scraper.py                # yt-dlp + instaloader logic
│   ├── gemini.py                 # all Gemini API calls
│   ├── db.py                     # Supabase queries
│   ├── models.py                 # Pydantic schemas
│   └── requirements.txt
│
├── docs/
│   ├── architecture.md
│   ├── data-flow.md
│   ├── features.md
│   ├── module-specifications.md
│   └── module-requirements.md
│
└── README.md
```

## License

MIT
