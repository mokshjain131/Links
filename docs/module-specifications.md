# Module Specifications

Detailed technical specification for each module in the Links system.

---

## Backend Modules

### 1. `main.py` — API Router

**Purpose:** Single entry point for the FastAPI application. Defines all HTTP routes, middleware, and CORS configuration.

#### Routes

| Method | Path | Request Body | Response | Description |
|--------|------|-------------|----------|-------------|
| `POST` | `/save` | `SaveRequest` | `SaveResponse` | Ingest a URL, scrape, enrich via Gemini, save to DB |
| `GET` | `/posts` | — (query params: `category`, `platform`, `sentiment`, `content_type`, `search`, `limit`, `offset`) | `List[PostOut]` | Fetch user's posts with optional filters |
| `GET` | `/posts/{post_id}` | — | `PostOut` | Fetch a single post by ID |
| `DELETE` | `/posts/{post_id}` | — | `{ "deleted": true }` | Delete a post |
| `POST` | `/ask` | `AskRequest` | `AskResponse` | Ask a question about saved content |
| `GET` | `/categories` | — | `List[CategoryCount]` | Get all categories with post counts |
| `GET` | `/analytics/overview` | — | `AnalyticsOverview` | Aggregated stats for dashboard |
| `GET` | `/export` | query params: `category`, `format` (`csv`\|`json`) | File download | Export posts |

#### Middleware & Config

- **CORS:** Allow frontend origin (`localhost:5173` in dev, production domain in prod)
- **Auth:** Extract Supabase JWT from `Authorization: Bearer <token>` header, validate against Supabase, extract `user_id`
- **Error handling:** Global exception handler returns structured JSON errors

#### Dependencies

- `fastapi`, `uvicorn`, `python-dotenv`
- Internal: `scraper`, `gemini`, `db`, `models`

---

### 2. `scraper.py` — Content Extractor

**Purpose:** Given a URL, detect the platform, invoke the correct scraping tool, and return normalized metadata.

#### Public Interface

```python
class ScrapedContent:
    """Normalized output from any scraper."""
    title: str
    description: str
    platform: str           # "youtube" | "instagram" | "tiktok" | "other"
    thumbnail_url: str | None
    author: str | None
    hashtags: list[str]

def detect_platform(url: str) -> str:
    """Returns platform identifier from URL domain."""

async def scrape(url: str) -> ScrapedContent:
    """Main entry point. Detects platform and dispatches to correct scraper."""
```

#### Platform-specific Scrapers

| Platform | Tool | Extracted Fields |
|----------|------|-----------------|
| YouTube | `yt-dlp` (metadata only, no download) | title, description, uploader, thumbnail, duration |
| Instagram | `instaloader` | caption, hashtags, owner username, display_url |
| TikTok | `yt-dlp` (fallback: `instaloader`) | description, uploader, thumbnail |
| Other | `requests` + `BeautifulSoup` | `og:title`, `og:description`, `og:image` from HTML `<meta>` tags |

#### Internal Functions

```python
async def _scrape_youtube(url: str) -> ScrapedContent:
    """Uses yt-dlp with --dump-json to extract metadata without downloading video."""

async def _scrape_instagram(url: str) -> ScrapedContent:
    """Uses instaloader to fetch post metadata. Handles login/session if needed."""

async def _scrape_tiktok(url: str) -> ScrapedContent:
    """Uses yt-dlp for TikTok. Falls back to og: metadata on failure."""

async def _scrape_generic(url: str) -> ScrapedContent:
    """Fetches HTML, parses og: meta tags using BeautifulSoup."""
```

#### Error Behavior

- If the platform-specific scraper fails → falls back to `_scrape_generic()`
- If `_scrape_generic()` also fails → raises `ScrapingError` with the URL and reason
- Timeout: 15 seconds per scrape attempt

#### Dependencies

- `yt-dlp`, `instaloader`, `requests`, `beautifulsoup4`

---

### 3. `gemini.py` — AI Enrichment

**Purpose:** All interactions with the Google Gemini 2.0 Flash API. Two capabilities: content classification and feed Q&A.

#### Public Interface

```python
class ContentAnalysis:
    """Output of content classification."""
    category: str
    subcategory: str
    tags: list[str]         # max 5
    summary: str            # max 20 words
    sentiment: str          # "positive" | "neutral" | "negative"
    content_type: str       # "educational" | "entertainment" | "opinion" | "news"

async def categorize_post(title: str, description: str) -> ContentAnalysis:
    """Sends content to Gemini for classification. Returns structured analysis."""

async def ask_feed(posts_json: str, question: str) -> str:
    """Sends user's saved posts + question to Gemini. Returns natural language answer."""
```

#### Prompt Templates

**Categorization Prompt:**
```
You are a content classifier. Given the following social media post
metadata, return a JSON object with these exact fields:
- category        (string)
- subcategory     (string)
- tags            (array of strings, max 5)
- summary         (one sentence, max 20 words)
- sentiment       (one of: positive, neutral, negative)
- content_type    (one of: educational, entertainment, opinion, news)

Respond only with the JSON object. No preamble, no markdown, no explanation.

Title: {title}
Description: {description}
```

**Ask Prompt:**
```
You are an assistant that helps users explore their saved social media content.
Answer the user's question based only on the saved content provided below.
If the answer is not in the saved content, say so clearly.

Saved content:
{posts_as_json}

User question: {question}
```

#### Configuration

| Parameter | Value |
|-----------|-------|
| Model | `gemini-2.0-flash` |
| Temperature | `0.3` (categorization), `0.7` (ask) |
| Max output tokens | `256` (categorization), `1024` (ask) |
| Response MIME type | `application/json` (categorization only) |

#### Error Handling

- **Rate limit (429):** Raise `GeminiRateLimitError` → `main.py` returns HTTP 429 to client
- **Invalid JSON response:** Retry once with stricter prompt; if still invalid, raise `GeminiParseError`
- **API key missing:** Fail fast at startup with clear error message

#### Dependencies

- `google-generativeai` (Google AI Python SDK)

---

### 4. `db.py` — Database Layer

**Purpose:** All Supabase read/write operations. No ORM — uses the Supabase Python client directly.

#### Public Interface

```python
def get_client() -> supabase.Client:
    """Returns initialized Supabase client (singleton)."""

async def insert_post(user_id: str, post: dict) -> dict:
    """Insert a new post. Returns the inserted row."""

async def get_post_by_url(user_id: str, url: str) -> dict | None:
    """Check for duplicate. Returns existing post or None."""

async def get_posts(
    user_id: str,
    category: str | None = None,
    platform: str | None = None,
    sentiment: str | None = None,
    content_type: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0
) -> list[dict]:
    """Fetch posts with optional filters. Ordered by saved_at DESC."""

async def get_post_by_id(user_id: str, post_id: str) -> dict | None:
    """Fetch a single post by ID."""

async def delete_post(user_id: str, post_id: str) -> bool:
    """Delete a post. Returns True if deleted, False if not found."""

async def get_category_counts(user_id: str) -> list[dict]:
    """Returns [{ category, count }] for sidebar and analytics."""

async def get_analytics_overview(user_id: str) -> dict:
    """Returns aggregated stats: total posts, platform breakdown,
    sentiment distribution, top tags, posts per week."""
```

#### Search Implementation

- `search` parameter performs `ilike` matching against `title`, `summary`, and `tags` (cast to text)
- No full-text search or vector search in v1 — simple substring matching

#### Dependencies

- `supabase` (Python client)

---

### 5. `models.py` — Pydantic Schemas

**Purpose:** Define all request/response data shapes for type safety and auto-generated OpenAPI docs.

#### Schemas

```python
# --- Requests ---

class SaveRequest(BaseModel):
    url: str                            # Required. The URL to ingest.
    manual_text: str | None = None      # Optional. Fallback if scraping fails.

class AskRequest(BaseModel):
    question: str                       # The user's natural language question.

# --- Responses ---

class PostOut(BaseModel):
    id: str
    url: str
    platform: str
    title: str | None
    summary: str | None
    category: str | None
    subcategory: str | None
    tags: list[str]
    sentiment: str | None
    content_type: str | None
    saved_at: str                       # ISO 8601 timestamp

class SaveResponse(BaseModel):
    post: PostOut
    is_duplicate: bool                  # True if URL already existed

class AskResponse(BaseModel):
    answer: str

class CategoryCount(BaseModel):
    category: str
    count: int

class AnalyticsOverview(BaseModel):
    total_posts: int
    by_platform: dict[str, int]         # { "youtube": 42, "instagram": 15, ... }
    by_sentiment: dict[str, int]        # { "positive": 30, "neutral": 20, "negative": 7 }
    by_content_type: dict[str, int]
    top_tags: list[dict]                # [{ "tag": "investing", "count": 12 }, ...]
    posts_per_week: list[dict]          # [{ "week": "2026-W13", "count": 5 }, ...]
```

---

## Frontend Modules

### 6. `lib/supabase.js` — Auth & Client

**Purpose:** Initialize the Supabase JS client. Expose auth helpers.

```javascript
// Exports:
export const supabase          // Supabase client instance
export function getAccessToken()  // Returns current JWT for API calls
export function onAuthChange(callback)  // Listen for auth state changes
```

- Auth state is managed entirely by Supabase JS — no Redux or Zustand
- The JWT is sent as `Authorization: Bearer <token>` on every backend API call

---

### 7. `pages/Home.jsx` — Main Feed

**Purpose:** The primary page. URL input at top, scrollable feed below, search bar.

#### UI Sections

| Section | Behavior |
|---------|----------|
| **URL Input** | Text input + "Save" button. Shows loading spinner during save. Shows success/error toast after. |
| **Search Bar** | Debounced text input. Filters feed client-side initially, falls back to API search for large datasets. |
| **Feed** | List of `PostCard` components, newest first. Infinite scroll or "Load More" button. |
| **Filter Bar** | Dropdown filters: platform, sentiment, content type. Applied as query params to `GET /posts`. |

#### State

- `posts: PostOut[]` — the current feed
- `loading: boolean` — save or fetch in progress
- `filters: { category, platform, sentiment, content_type, search }` — active filters
- `error: string | null` — last error message

---

### 8. `pages/Category.jsx` — Category Explorer

**Purpose:** Filtered view by category with analytics.

#### UI Sections

| Section | Behavior |
|---------|----------|
| **Sidebar** | `CategorySidebar` component — list of all categories with post counts. Clicking a category filters the feed. |
| **Filtered Feed** | Same `PostCard` list as Home, but scoped to selected category. Sub-filters for platform, sentiment. |
| **Analytics Panel** | Charts rendered below or alongside the feed. Bar chart (posts per category), Pie chart (platform breakdown), Sentiment distribution. |

---

### 9. `pages/Ask.jsx` — Ask Your Feed

**Purpose:** Chat interface for querying saved content via natural language.

#### UI Sections

| Section | Behavior |
|---------|----------|
| **Message List** | Alternating user and assistant message bubbles. Scrolls to bottom on new message. |
| **Input Bar** | `AskBar` component — text input + send button. Disabled while awaiting response. |
| **Loading State** | Typing indicator dots while Gemini is processing. |

#### State

- `messages: { role: "user" | "assistant", content: string }[]` — chat history (local only, not persisted)
- `loading: boolean` — waiting for response

---

### 10. `components/PostCard.jsx`

**Purpose:** Reusable card displaying a single saved post.

#### Props

```javascript
{
  post: PostOut  // The post data object
  onDelete?: (id: string) => void  // Optional delete callback
}
```

#### Visual Elements

- Platform icon (YouTube red, Instagram gradient, TikTok black, generic globe)
- Title (linked to original URL, opens in new tab)
- One-sentence summary
- Category + subcategory badge
- Tags as pill chips
- Sentiment indicator (green/gray/red dot or emoji)
- Content type label
- Relative timestamp ("3h ago", "2 days ago")
- Delete button (with confirmation)

---

### 11. `components/CategorySidebar.jsx`

**Purpose:** Vertical navigation listing all categories with post counts.

#### Props

```javascript
{
  categories: CategoryCount[]
  selected: string | null
  onSelect: (category: string) => void
}
```

---

### 12. `components/AskBar.jsx`

**Purpose:** Text input for the Ask Your Feed chat.

#### Props

```javascript
{
  onSubmit: (question: string) => void
  disabled: boolean
}
```

---

## Environment Configuration

### Backend `.env`

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
GEMINI_API_KEY=AIza...
FRONTEND_ORIGIN=http://localhost:5173
```

### Frontend `.env`

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:8000
```

---

## Database Schema (SQL Migration)

```sql
-- Run this in Supabase SQL Editor

create table if not exists posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  url          text not null,
  platform     text check (platform in ('youtube', 'instagram', 'tiktok', 'other')),
  title        text,
  summary      text,
  category     text,
  subcategory  text,
  tags         text[] default '{}',
  sentiment    text check (sentiment in ('positive', 'neutral', 'negative')),
  content_type text check (content_type in ('educational', 'entertainment', 'opinion', 'news')),
  thumbnail_url text,
  author       text,
  saved_at     timestamptz default now()
);

-- Index for common queries
create index idx_posts_user_id on posts(user_id);
create index idx_posts_category on posts(user_id, category);
create index idx_posts_saved_at on posts(user_id, saved_at desc);

-- Unique constraint for duplicate detection
create unique index idx_posts_user_url on posts(user_id, url);

-- Row Level Security
alter table posts enable row level security;

create policy "Users can only see their own posts"
  on posts for select using (auth.uid() = user_id);

create policy "Users can only insert their own posts"
  on posts for insert with check (auth.uid() = user_id);

create policy "Users can only delete their own posts"
  on posts for delete using (auth.uid() = user_id);
```
