# Module Requirements

Functional and non-functional requirements for each module in the Links system, traceable to the features documented in `features.md`.

---

## 1. `scraper.py` — Content Extractor

### Functional Requirements

| ID | Requirement | Source |
|----|------------|--------|
| SCR-01 | Accept any URL and return normalized metadata (`title`, `description`, `platform`, `thumbnail_url`, `author`, `hashtags`) | Content Ingestion |
| SCR-02 | Auto-detect platform from URL domain: `youtube.com`/`youtu.be` → youtube, `instagram.com` → instagram, `tiktok.com` → tiktok, all others → other | Content Ingestion |
| SCR-03 | YouTube: extract metadata via `yt-dlp --dump-json` (title, description, uploader, thumbnail, duration). No video download. | Content Ingestion |
| SCR-04 | Instagram: extract post metadata via `instaloader` (caption, hashtags, owner username, display URL) | Content Ingestion |
| SCR-05 | TikTok: extract metadata via `yt-dlp`, fallback to `instaloader` or generic scraper on failure | Content Ingestion |
| SCR-06 | Generic/Other: fetch HTML and extract `og:title`, `og:description`, `og:image` from `<meta>` tags | Content Ingestion |
| SCR-07 | If the platform-specific scraper fails, automatically fall back to the generic `og:` meta scraper | Content Ingestion |
| SCR-08 | Support a manual text paste fallback: if `manual_text` is provided, skip scraping and use it as the description | Content Ingestion |

### Non-Functional Requirements

| ID | Requirement |
|----|------------|
| SCR-NF-01 | Scraping timeout: maximum 15 seconds per URL |
| SCR-NF-02 | No video/image binary downloads — metadata extraction only |
| SCR-NF-03 | Graceful failure: never crash the request pipeline; always return at least a partial result or a clear error |

### Dependencies

- `yt-dlp >= 2024.0`
- `instaloader >= 4.10`
- `requests >= 2.31`
- `beautifulsoup4 >= 4.12`

---

## 2. `gemini.py` — AI Enrichment

### Functional Requirements

| ID | Requirement | Source |
|----|------------|--------|
| GEM-01 | `categorize_post(title, description)` must return a JSON object with exactly these fields: `category` (str), `subcategory` (str), `tags` (list, max 5), `summary` (str, max 20 words), `sentiment` (enum: positive/neutral/negative), `content_type` (enum: educational/entertainment/opinion/news) | Auto-enrichment |
| GEM-02 | `ask_feed(posts_json, question)` must return a natural language answer grounded in the provided posts | Ask Your Feed |
| GEM-03 | The ask function must instruct the model to say "I don't have that information in your saved content" when the answer is not in the data | Ask Your Feed |
| GEM-04 | The categorization prompt must enforce JSON-only output with no markdown fencing or preamble | Auto-enrichment |
| GEM-05 | On receiving a 429 rate-limit response from Gemini, raise a `GeminiRateLimitError` that propagates as HTTP 429 to the client | Error Handling |
| GEM-06 | On receiving invalid JSON from the categorization call, retry once with the same prompt. If still invalid, raise `GeminiParseError` | Error Handling |
| GEM-07 | Use `gemini-2.0-flash` model for all calls | Architecture |

### Non-Functional Requirements

| ID | Requirement |
|----|------------|
| GEM-NF-01 | Categorization calls: temperature = 0.3 for deterministic output |
| GEM-NF-02 | Ask calls: temperature = 0.7 for more natural responses |
| GEM-NF-03 | Categorization max output tokens: 256 |
| GEM-NF-04 | Ask max output tokens: 1024 |
| GEM-NF-05 | Respect Gemini free tier: 15 RPM, 1M tokens/day |
| GEM-NF-06 | API key must be loaded from environment variable `GEMINI_API_KEY` |

### Dependencies

- `google-generativeai >= 0.5`

---

## 3. `db.py` — Database Layer

### Functional Requirements

| ID | Requirement | Source |
|----|------------|--------|
| DB-01 | `insert_post(user_id, post)` must insert a post row and return the inserted record | Save Flow |
| DB-02 | `get_post_by_url(user_id, url)` must check for duplicate URLs per user. Return existing post if found, `None` otherwise | Duplicate Detection |
| DB-03 | `get_posts(user_id, ...)` must support filtering by: `category`, `platform`, `sentiment`, `content_type` | Organization |
| DB-04 | `get_posts()` must support keyword search via substring match (`ilike`) against `title`, `summary`, and stringified `tags` | Organization |
| DB-05 | `get_posts()` must return results ordered by `saved_at DESC` (newest first) | Organization |
| DB-06 | `get_posts()` must support pagination via `limit` and `offset` parameters | Organization |
| DB-07 | `delete_post(user_id, post_id)` must delete only posts owned by the authenticated user | Organization |
| DB-08 | `get_category_counts(user_id)` must return a list of `{ category, count }` for the sidebar | Organization |
| DB-09 | `get_analytics_overview(user_id)` must return aggregated stats: total posts, by platform, by sentiment, by content type, top tags, posts per week | Analytics |
| DB-10 | All queries must be scoped to `user_id` — users must never see other users' data | Security |
| DB-11 | For the Ask flow, `get_posts()` must support fetching up to 500 most recent posts (metadata only) | Ask Your Feed |

### Non-Functional Requirements

| ID | Requirement |
|----|------------|
| DB-NF-01 | Use Supabase Python client directly — no ORM |
| DB-NF-02 | Supabase client initialized as singleton (one instance per app lifecycle) |
| DB-NF-03 | Use `SUPABASE_SERVICE_KEY` for backend operations (bypasses RLS for server-side) |
| DB-NF-04 | Connection must fail fast with clear error if env vars are missing |

### Dependencies

- `supabase >= 2.0`

---

## 4. `main.py` — API Router

### Functional Requirements

| ID | Requirement | Source |
|----|------------|--------|
| API-01 | `POST /save` — Accept a URL, run scraper → gemini → db pipeline, return enriched post | Save Flow |
| API-02 | `POST /save` — If URL is a duplicate, return existing post with `is_duplicate: true` flag | Duplicate Detection |
| API-03 | `POST /save` — If `manual_text` is provided and scraping fails, use manual text as description | Content Ingestion |
| API-04 | `GET /posts` — Return user's posts with optional query params: `category`, `platform`, `sentiment`, `content_type`, `search`, `limit`, `offset` | Organization |
| API-05 | `GET /posts/{post_id}` — Return single post by ID | Organization |
| API-06 | `DELETE /posts/{post_id}` — Delete a post, enforce ownership check | Organization |
| API-07 | `POST /ask` — Accept a question, fetch all user posts, send to Gemini, return answer | Ask Your Feed |
| API-08 | `GET /categories` — Return categories with post counts for the sidebar | Organization |
| API-09 | `GET /analytics/overview` — Return aggregated analytics data | Analytics |
| API-10 | `GET /export` — Export posts as CSV or JSON, filtered by category | Export |
| API-11 | All routes except auth endpoints require valid Supabase JWT in `Authorization` header | Security |
| API-12 | Return HTTP 429 with retry information when Gemini rate limit is hit | Error Handling |
| API-13 | Return HTTP 500 with structured error JSON on Supabase write failures | Error Handling |

### Non-Functional Requirements

| ID | Requirement |
|----|------------|
| API-NF-01 | CORS: Allow configured frontend origin only |
| API-NF-02 | All responses must be JSON (except `/export` file download) |
| API-NF-03 | API must be deployable to Render free tier |
| API-NF-04 | Startup time must work within Render's cold-start constraints (~30s) |
| API-NF-05 | All env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GEMINI_API_KEY`, `FRONTEND_ORIGIN`) must be validated at startup |

### Dependencies

- `fastapi >= 0.110`
- `uvicorn >= 0.29`
- `python-dotenv >= 1.0`

---

## 5. `models.py` — Pydantic Schemas

### Functional Requirements

| ID | Requirement | Source |
|----|------------|--------|
| MDL-01 | `SaveRequest` must validate `url` as a non-empty string, `manual_text` as optional | Save Flow |
| MDL-02 | `PostOut` must include all database fields: `id`, `url`, `platform`, `title`, `summary`, `category`, `subcategory`, `tags`, `sentiment`, `content_type`, `saved_at` | Save Flow |
| MDL-03 | `SaveResponse` must include `post: PostOut` and `is_duplicate: bool` | Save Flow |
| MDL-04 | `AskRequest` must validate `question` as a non-empty string | Ask Your Feed |
| MDL-05 | `AskResponse` must include `answer: str` | Ask Your Feed |
| MDL-06 | `CategoryCount` must include `category: str` and `count: int` | Organization |
| MDL-07 | `AnalyticsOverview` must include `total_posts`, `by_platform`, `by_sentiment`, `by_content_type`, `top_tags`, `posts_per_week` | Analytics |

### Non-Functional Requirements

| ID | Requirement |
|----|------------|
| MDL-NF-01 | All schemas must be Pydantic v2 `BaseModel` subclasses |
| MDL-NF-02 | Schemas must generate accurate OpenAPI documentation via FastAPI's auto-docs |

### Dependencies

- `pydantic >= 2.0`

---

## 6. Frontend — `Home.jsx`

### Functional Requirements

| ID | Requirement | Source |
|----|------------|--------|
| FE-HOME-01 | URL input field with "Save" button. Submit triggers `POST /save` | Content Ingestion |
| FE-HOME-02 | Show loading spinner while save request is in progress | UX |
| FE-HOME-03 | Show success toast with post title on successful save | UX |
| FE-HOME-04 | Show error toast with message on failed save | UX |
| FE-HOME-05 | Display feed of `PostCard` components, newest first | Organization |
| FE-HOME-06 | Support infinite scroll or "Load More" pagination | Organization |
| FE-HOME-07 | Search bar with debounced input — filters posts by keyword | Organization |
| FE-HOME-08 | Filter dropdowns: platform, sentiment, content type | Organization |
| FE-HOME-09 | Show "duplicate" indicator when saving an already-saved URL | Duplicate Detection |

---

## 7. Frontend — `Category.jsx`

### Functional Requirements

| ID | Requirement | Source |
|----|------------|--------|
| FE-CAT-01 | Display `CategorySidebar` with clickable category list and post counts | Organization |
| FE-CAT-02 | Clicking a category filters the feed to only that category | Organization |
| FE-CAT-03 | Sub-filters for platform, sentiment, content type within a category | Organization |
| FE-CAT-04 | Bar chart: posts per category | Analytics |
| FE-CAT-05 | Pie chart: platform breakdown | Analytics |
| FE-CAT-06 | Sentiment distribution chart | Analytics |
| FE-CAT-07 | Most used tags display (tag cloud or ranked list) | Analytics |
| FE-CAT-08 | Posts over time chart (weekly view) | Analytics |

---

## 8. Frontend — `Ask.jsx`

### Functional Requirements

| ID | Requirement | Source |
|----|------------|--------|
| FE-ASK-01 | Chat-style message list with user and assistant bubbles | Ask Your Feed |
| FE-ASK-02 | Text input with send button at the bottom | Ask Your Feed |
| FE-ASK-03 | Disable input while waiting for response | UX |
| FE-ASK-04 | Show typing indicator while Gemini is processing | UX |
| FE-ASK-05 | Auto-scroll to bottom on new messages | UX |
| FE-ASK-06 | Chat history is local only — not persisted across sessions | Architecture |

---

## 9. Frontend — `PostCard.jsx`

### Functional Requirements

| ID | Requirement | Source |
|----|------------|--------|
| FE-PC-01 | Display platform icon with platform-specific color | UX |
| FE-PC-02 | Display post title as clickable link to original URL (opens new tab) | UX |
| FE-PC-03 | Display one-sentence summary | Auto-enrichment |
| FE-PC-04 | Display category + subcategory as badge | Auto-enrichment |
| FE-PC-05 | Display tags as pill chips | Auto-enrichment |
| FE-PC-06 | Display sentiment indicator (green/gray/red) | Auto-enrichment |
| FE-PC-07 | Display content type label | Auto-enrichment |
| FE-PC-08 | Display relative timestamp ("3h ago", "2 days ago") | UX |
| FE-PC-09 | Delete button with confirmation dialog | Organization |
| FE-PC-10 | Copy summary to clipboard button | Export |

---

## 10. Frontend — Export

### Functional Requirements

| ID | Requirement | Source |
|----|------------|--------|
| FE-EXP-01 | Export any category as CSV file download | Export |
| FE-EXP-02 | Export any category as JSON file download | Export |
| FE-EXP-03 | Copy individual post summary to clipboard | Export |

---

## 11. Cross-cutting Requirements

### Authentication

| ID | Requirement | Source |
|----|------------|--------|
| AUTH-01 | Email/password sign-up and login via Supabase Auth | Architecture |
| AUTH-02 | All API routes require valid JWT (except health check) | Security |
| AUTH-03 | Frontend: auth-guarded routes — redirect unauthenticated users to login | Security |
| AUTH-04 | Frontend: `supabase.js` manages auth state via Supabase JS client | Architecture |

### Error Handling

| ID | Requirement | Source |
|----|------------|--------|
| ERR-01 | Scraper failure → fall back to `og:` meta tags | Data Flow |
| ERR-02 | Unsupported platform → return raw metadata with `platform: "other"` | Data Flow |
| ERR-03 | Gemini rate limit (429) → HTTP 429 to client, frontend shows retry message | Data Flow |
| ERR-04 | Duplicate URL → return existing post, no re-scraping | Data Flow |
| ERR-05 | Supabase write failure → HTTP 500, frontend shows error toast | Data Flow |

### Performance

| ID | Requirement |
|----|------------|
| PERF-01 | Save flow (scrape + gemini + db) should complete in < 10 seconds for 90% of requests |
| PERF-02 | Ask flow should respond in < 5 seconds for feeds ≤ 500 posts |
| PERF-03 | Feed loading: initial page load should fetch ≤ 50 posts |
| PERF-04 | Frontend: debounce search input by 300ms |

---

## Dependency Summary

### Backend (`requirements.txt`)

```
fastapi>=0.110
uvicorn>=0.29
python-dotenv>=1.0
pydantic>=2.0
supabase>=2.0
google-generativeai>=0.5
yt-dlp>=2024.0
instaloader>=4.10
requests>=2.31
beautifulsoup4>=4.12
```

### Frontend (`package.json`)

```json
{
  "dependencies": {
    "react": "^18.3",
    "react-dom": "^18.3",
    "react-router-dom": "^6.23",
    "@supabase/supabase-js": "^2.43",
    "recharts": "^2.12"
  },
  "devDependencies": {
    "vite": "^5.4",
    "@vitejs/plugin-react": "^4.3"
  }
}
```
