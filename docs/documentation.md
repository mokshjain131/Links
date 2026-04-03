# Links — Complete Technical Documentation

> Full-stack system for ingesting, classifying, and analyzing social media content links.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Database Schema](#database-schema)
4. [Backend — Python / FastAPI](#backend--python--fastapi)
   - [main.py — Application & Routes](#mainpy--application--routes)
   - [models.py — Pydantic Schemas](#modelspy--pydantic-schemas)
   - [scraper.py — Content Scraping](#scraperpy--content-scraping)
   - [gemini.py — AI Classification & Q&A](#geminipy--ai-classification--qa)
   - [db.py — Database Layer](#dbpy--database-layer)
5. [Frontend — React / Vite](#frontend--react--vite)
   - [App.jsx — Root Component](#appjsx--root-component)
   - [lib/supabase.js — Supabase Client](#libsupabasejs--supabase-client)
   - [lib/api.js — API Client](#libapijs--api-client)
   - [pages/Home.jsx — Feed Page](#pageshomejsx--feed-page)
   - [pages/Category.jsx — Categories & Analytics](#pagescategoryjsx--categories--analytics)
   - [pages/Ask.jsx — AI Chat](#pagesaskjsx--ai-chat)
   - [components/PostCard.jsx — Post Display](#componentspostcardjsx--post-display)
   - [components/CategorySidebar.jsx — Category Navigation](#componentscategorysidebarjsx--category-navigation)
   - [components/AskBar.jsx — Chat Input](#componentsaskbarjsx--chat-input)
6. [Data Flow](#data-flow)
7. [Authentication](#authentication)
8. [AI Classification Details](#ai-classification-details)
9. [API Reference](#api-reference)
10. [Environment Variables](#environment-variables)

---

## Architecture Overview

```
┌──────────────┐     HTTP/JSON      ┌──────────────────┐     REST API      ┌────────────┐
│   React/Vite │ ──────────────────▶│   FastAPI (py)   │ ──────────────────▶│  Supabase  │
│   Frontend   │ ◀──────────────────│   Backend        │ ◀──────────────────│  Postgres  │
│  :5173/5174  │                    │  :8001           │                    │  (cloud)   │
└──────────────┘                    └──────┬───────────┘                    └────────────┘
                                           │
                              ┌────────────┼──────────────┐
                              ▼            ▼              ▼
                        ┌──────────┐ ┌──────────┐  ┌────────────┐
                        │  yt-dlp  │ │instaloadr│  │  Gemini AI │
                        │ (scrape) │ │ (scrape) │  │ (classify) │
                        └──────────┘ └──────────┘  └────────────┘
```

- **Frontend**: React 19 + Vite 5 SPA with Supabase Auth
- **Backend**: FastAPI (Python 3.11+) REST API
- **Database**: Supabase (hosted Postgres) with REST client
- **AI**: Google Gemini 2.5 Flash for classification and Q&A
- **Scraping**: `yt-dlp` (YouTube/TikTok), `instaloader` (Instagram), `BeautifulSoup` (generic)

---

## Project Structure

```
Links/
├── backend/
│   ├── .env                 # Backend environment variables
│   ├── .env.example         # Template for backend env
│   ├── main.py              # FastAPI app, routes, auth helper
│   ├── models.py            # Pydantic request/response schemas
│   ├── scraper.py           # URL scraping (yt-dlp, instaloader, og:tags)
│   ├── gemini.py            # Gemini AI classification + Ask Your Feed
│   ├── db.py                # Supabase database CRUD + analytics
│   ├── migration.sql        # SQL to create the posts table
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── .env                 # Frontend environment variables
│   ├── index.html           # HTML entry point
│   ├── package.json         # Node.js dependencies
│   ├── vite.config.js       # Vite configuration
│   └── src/
│       ├── main.jsx         # React DOM entry point
│       ├── App.jsx          # Root component (auth + routing)
│       ├── index.css         # Global design system (dark theme)
│       ├── lib/
│       │   ├── supabase.js  # Supabase client init + auth helpers
│       │   └── api.js       # Backend API client wrapper
│       ├── pages/
│       │   ├── Home.jsx     # Feed page (save URL, list posts)
│       │   ├── Category.jsx # Category explorer + analytics charts
│       │   └── Ask.jsx      # AI chat interface
│       └── components/
│           ├── PostCard.jsx       # Single post card display
│           ├── CategorySidebar.jsx # Category list with counts
│           └── AskBar.jsx         # Chat input bar
├── docs/
│   ├── architecture.md      # High-level architecture notes
│   ├── data-flow.md         # Data flow diagrams
│   ├── features.md          # Feature specifications
│   ├── documentation.md     # This file
│   └── setup.md             # Setup & installation guide
├── README.md
└── notes.txt
```

---

## Database Schema

**Table: `posts`** (Supabase Postgres)

| Column          | Type           | Default                   | Description                                   |
|-----------------|----------------|---------------------------|-----------------------------------------------|
| `id`            | `uuid`         | `gen_random_uuid()`       | Primary key                                   |
| `user_id`       | `uuid`         | —                         | Owner user ID (from Supabase Auth JWT `sub`)   |
| `url`           | `text`         | —                         | Original URL of the ingested content           |
| `platform`      | `text`         | —                         | Detected platform: `youtube`, `instagram`, `tiktok`, `other` |
| `title`         | `text`         | —                         | Content title (scraped)                        |
| `summary`       | `text`         | —                         | AI-generated one-sentence summary              |
| `category`      | `text`         | —                         | AI-assigned top-level category (e.g. Music, Tech) |
| `subcategory`   | `text`         | —                         | AI-assigned sub-category (e.g. Pop Music)      |
| `tags`          | `text[]`       | `'{}'`                    | AI-assigned keyword tags (max 5)               |
| `sentiment`     | `text`         | —                         | AI-assigned: `positive`, `neutral`, `negative` |
| `content_type`  | `text`         | —                         | AI-assigned: `educational`, `entertainment`, `opinion`, `news` |
| `thumbnail_url` | `text`         | —                         | Content thumbnail image URL                    |
| `author`        | `text`         | —                         | Content creator/uploader name                  |
| `saved_at`      | `timestamptz`  | `now()`                   | Timestamp when the post was saved              |

**Indexes:**

| Index Name              | Columns                      | Purpose                          |
|-------------------------|------------------------------|----------------------------------|
| `idx_posts_user_id`     | `(user_id)`                  | Fast lookup by user              |
| `idx_posts_category`    | `(user_id, category)`        | Filter by category               |
| `idx_posts_saved_at`    | `(user_id, saved_at DESC)`   | Chronological feed ordering      |
| `idx_posts_user_url`    | `(user_id, url)` — UNIQUE    | Duplicate URL detection          |

**Row-Level Security:** Disabled for development. In production, add RLS policies scoped to `auth.uid()`.

---

## Backend — Python / FastAPI

### main.py — Application & Routes

The main application file. Initializes FastAPI, configures CORS, defines the auth helper, and declares all API endpoints.

#### `app` (FastAPI instance)

- **Title**: `Links API`
- **Version**: `1.0.0`
- **CORS**: Allows all origins (`"*"`) with `allow_credentials=False` to securely prevent local development port conflicts.

#### `_get_user_id(authorization: str | None) -> str`

Extracts the user ID from the `Authorization: Bearer <JWT>` header.

- **Dev bypass**: If the token is exactly `"dev-bypass-token"`, returns the fixed UUID `00000000-0000-0000-0000-000000000001`. This matches the frontend's `VITE_DEV_BYPASS=true` mode.
- **Normal flow**: Base64-decodes the JWT payload (second segment), parses the JSON, and extracts the `sub` claim (Supabase user ID).
- **Raises**: `HTTPException(401)` if the header is missing, malformed, or the token has no `sub` claim.

#### `GET /health`

Health check endpoint. No authentication required.

- **Response**: `{ "status": "ok" }`

#### `POST /save`

Ingests a URL through the full pipeline: duplicate check → scrape → classify → save.

- **Request body** (`SaveRequest`): `{ "url": "...", "manual_text": "..." }`
- **Auth**: Required (Bearer JWT)
- **Pipeline**:
  1. **Duplicate check**: Calls `db.get_post_by_url()`. If the URL already exists for this user, returns `{ post: ..., is_duplicate: true }`.
  2. **Scrape**: Calls `scraper.scrape(url, manual_text)`. On failure, returns HTTP 422.
  3. **Classify**: Calls `gemini.categorize_post(title, description)`. On rate-limit or parse error, falls back to a default dict with `category: "Uncategorized"`, `sentiment: "neutral"`, `content_type: "uncategorized"`.
  4. **Save**: Calls `db.insert_post()` with merged scrape + classification data.
- **Response** (`SaveResponse`): `{ post: PostOut, is_duplicate: false }`

#### `GET /posts`

Fetches the user's posts with optional filters.

- **Query params**: `category`, `platform`, `sentiment`, `content_type`, `search`, `limit` (1–200, default 50), `offset` (default 0)
- **Auth**: Required
- **Response**: `PostOut[]`

#### `GET /posts/{post_id}`

Fetches a single post by UUID, scoped to the authenticated user.

- **Auth**: Required
- **Response**: `PostOut` or HTTP 404

#### `DELETE /posts/{post_id}`

Deletes a post owned by the authenticated user.

- **Auth**: Required
- **Response**: `{ "deleted": true }` or HTTP 404

#### `POST /ask`

Ask a natural-language question about saved content.

- **Request body** (`AskRequest`): `{ "question": "..." }`
- **Auth**: Required
- **Pipeline**:
  1. Fetches up to 500 most recent posts for the user.
  2. Builds a context JSON array with `title`, `summary`, `category`, `tags`, `platform`, `sentiment`, `saved_at` fields.
  3. Calls `gemini.ask_feed(context_json, question)`.
- **Response** (`AskResponse`): `{ "answer": "..." }`

#### `GET /categories`

Returns all categories with their post counts for the authenticated user.

- **Auth**: Required
- **Response**: `CategoryCount[]` — `[{ "category": "Music", "count": 5 }, ...]`

#### `GET /analytics/overview`

Returns aggregated analytics data.

- **Auth**: Required
- **Response** (`AnalyticsOverview`):
  ```json
  {
    "total_posts": 42,
    "by_platform": { "youtube": 30, "instagram": 12 },
    "by_sentiment": { "positive": 20, "neutral": 15, "negative": 7 },
    "by_content_type": { "entertainment": 25, "educational": 17 },
    "top_tags": [{ "tag": "music", "count": 10 }, ...],
    "posts_per_week": [{ "week": "2026-W13", "count": 5 }, ...]
  }
  ```

#### `GET /export`

Exports posts as JSON or CSV file download.

- **Query params**: `category` (optional filter), `format` (`"json"` or `"csv"`, default `"json"`)
- **Auth**: Required
- **Response**: Streamed file download with `Content-Disposition: attachment` header. CSV converts the `tags` array to a comma-separated string.

---

### models.py — Pydantic Schemas

All request/response schemas using Pydantic v2 `BaseModel`.

#### Request Models

| Model          | Fields                                                | Used By        |
|----------------|-------------------------------------------------------|----------------|
| `SaveRequest`  | `url: str` (min_length=1), `manual_text: Optional[str]` | `POST /save`   |
| `AskRequest`   | `question: str` (min_length=1)                        | `POST /ask`    |

#### Response Models

| Model              | Fields                                                                                                  | Used By              |
|--------------------|---------------------------------------------------------------------------------------------------------|----------------------|
| `PostOut`          | `id`, `url`, `platform`, `title?`, `summary?`, `category?`, `subcategory?`, `tags[]`, `sentiment?`, `content_type?`, `thumbnail_url?`, `author?`, `saved_at` | Multiple endpoints   |
| `SaveResponse`     | `post: PostOut`, `is_duplicate: bool`                                                                   | `POST /save`         |
| `AskResponse`      | `answer: str`                                                                                           | `POST /ask`          |
| `CategoryCount`    | `category: str`, `count: int`                                                                           | `GET /categories`    |
| `AnalyticsOverview`| `total_posts`, `by_platform`, `by_sentiment`, `by_content_type`, `top_tags[]`, `posts_per_week[]`        | `GET /analytics/overview` |

---

### scraper.py — Content Scraping

Extracts metadata from URLs without downloading media files.

#### Constants

- `SCRAPE_TIMEOUT = 15` — Timeout in seconds for all HTTP requests and subprocess calls.

#### `ScrapedContent` (dataclass)

Normalized output from any scraper.

| Field           | Type              | Default | Description                     |
|-----------------|-------------------|---------|---------------------------------|
| `title`         | `str`             | `""`    | Content title                   |
| `description`   | `str`             | `""`    | Content description / caption   |
| `platform`      | `str`             | `"other"` | Detected platform            |
| `thumbnail_url` | `str | None`      | `None`  | Thumbnail image URL             |
| `author`        | `str | None`      | `None`  | Content creator                 |
| `hashtags`      | `list[str]`       | `[]`    | Extracted hashtags              |

#### `ScrapingError` (Exception)

Raised when all scraping strategies fail for a URL.

#### `detect_platform(url: str) -> str`

Parses the URL domain to identify the platform.

- `youtube.com` or `youtu.be` → `"youtube"`
- `instagram.com` → `"instagram"`
- `tiktok.com` → `"tiktok"`
- Everything else → `"other"`

#### `async scrape(url: str, manual_text: str | None = None) -> ScrapedContent`

Main entry point. Dispatches to the platform-specific scraper, with cascading fallbacks:

1. **Platform-specific scraper** (`_scrape_youtube`, `_scrape_instagram`, `_scrape_tiktok`, `_scrape_generic`) — based on `detect_platform()` result.
2. **Generic og: scraper** (`_scrape_generic`) — if the platform-specific scraper fails and the platform isn't already `"other"`.
3. **Manual text** — if `manual_text` is provided and all scrapers fail.
4. **ScrapingError** — raised if nothing works.

#### `_scrape_youtube(url: str) -> ScrapedContent`

Uses `yt-dlp --dump-json --no-download` as a subprocess.

- Extracts: `title`, `description`, `thumbnail`, `uploader` / `channel`
- **Timeout**: 15 seconds
- **Raises**: `ScrapingError` if `yt-dlp` exits with non-zero code

#### `_scrape_instagram(url: str) -> ScrapedContent`

Uses the `instaloader` Python library.

- Creates an `Instaloader` instance with all downloads disabled (`download_pictures=False`, etc.)
- Extracts the shortcode from the URL using `_extract_instagram_shortcode()`.
- Fetches the post via `Post.from_shortcode()`.
- Extracts: `caption` (first 100 chars as title, full as description), `url` (image), `owner_username`, hashtags via regex `#(\w+)`.
- **Raises**: `ScrapingError` if shortcode extraction fails or `instaloader` is not installed.

#### `_extract_instagram_shortcode(url: str) -> str | None`

Regex-based extraction of the Instagram shortcode from URL patterns:
- `/p/<shortcode>`
- `/reel/<shortcode>`
- `/reels/<shortcode>`

Returns `None` if no pattern matches.

#### `_scrape_tiktok(url: str) -> ScrapedContent`

Uses `yt-dlp --dump-json --no-download` (same as YouTube).

- Extracts: `title`, `description`, `thumbnail`, `uploader` / `creator`
- **Timeout**: 15 seconds

#### `_scrape_generic(url: str) -> ScrapedContent`

Fetches the HTML with a Chrome-like User-Agent header and parses OpenGraph `og:` meta tags using BeautifulSoup.

- Extracts `og:title` (falls back to `<title>`), `og:description`, `og:image`.
- Also checks `name="og:..."` attribute as fallback for `property="og:..."`.
- **Raises**: `ScrapingError` if no title and no description are found.

---

### gemini.py — AI Classification & Q&A

Integration with Google Gemini 2.5 Flash for content classification and natural-language feed querying.

#### Exceptions

| Exception            | Description                                      |
|----------------------|--------------------------------------------------|
| `GeminiRateLimitError` | Gemini returned HTTP 429 or "resource exhausted" |
| `GeminiParseError`   | Gemini output could not be parsed as valid JSON   |

#### `_ensure_configured()`

Configures the `google-genai` SDK once (singleton pattern). Reads `GEMINI_API_KEY` from the environment. Raises `RuntimeError` if the key is not set.

#### `CATEGORIZE_PROMPT` (string template)

The prompt sent to Gemini for classification. Instructs the model to return a JSON object with these exact fields:

- `category` — top-level topic (e.g. Finance, Fitness, Tech, Cooking, Music)
- `subcategory` — more specific topic (e.g. Investing, Strength Training)
- `tags` — array of up to 5 keyword strings
- `summary` — one sentence, max 20 words
- `sentiment` — one of: `positive`, `neutral`, `negative`
- `content_type` — one of: `educational`, `entertainment`, `opinion`, `news`

Template variables: `{title}`, `{description}`.

#### `ASK_PROMPT` (string template)

The prompt for Ask Your Feed Q&A. Instructs Gemini to answer only from the provided saved content. Template variables: `{posts_json}`, `{question}`.

#### `async categorize_post(title: str, description: str) -> dict`

Sends content metadata to Gemini for classification.

- **Model**: `gemini-2.5-flash`
- **Attempt 1**: Sends the `CATEGORIZE_PROMPT` with `temperature=0.3`, `max_output_tokens=2048`. Parses the response.
- **Attempt 2**: If parse fails, retries with `temperature=0.1` and an appended instruction `"IMPORTANT: Return ONLY valid JSON. No markdown fences."`.
- **Returns**: dict with keys: `category`, `subcategory`, `tags`, `summary`, `sentiment`, `content_type`.
- **Raises**: `GeminiParseError` if both attempts fail, `GeminiRateLimitError` if rate-limited.
- **Note**: `max_output_tokens` is set to 2048 (not 256) because Gemini 2.5 Flash is a thinking model that uses internal reasoning tokens within the output budget. 256 tokens was insufficient and caused truncated JSON responses.

#### `async ask_feed(posts_json: str, question: str) -> str`

Sends the user's saved posts context + their question to Gemini.

- **Model**: `gemini-2.5-flash`
- **Config**: `temperature=0.7`, `max_output_tokens=4096`
- **Input cap**: `posts_json` is truncated to 50,000 characters.
- **Returns**: Natural language answer string.
- **Raises**: `RuntimeError` on any failure.

#### `async _call_gemini(model, prompt, temperature, max_tokens) -> str`

Internal helper that calls `model.generate_content()` with the specified generation config.

- Returns the stripped response text.
- Detects rate-limit errors by checking for `"429"` or `"resource exhausted"` in the error string and raises `GeminiRateLimitError`.
- Raises `GeminiParseError` if the response text is empty.

#### `_parse_categorization(text: str) -> dict`

Parses the raw Gemini text response into a structured dict.

1. **Strip markdown fences**: If the text starts with ` ``` `, removes fence lines.
2. **JSON parse**: Attempts `json.loads()`. Raises `GeminiParseError` on decode failure.
3. **Field validation**: Checks that all 6 required fields are present (`category`, `subcategory`, `tags`, `summary`, `sentiment`, `content_type`).
4. **Normalization**:
   - Caps `tags` to 5 entries.
   - Lowercases `sentiment` and `content_type`.
5. **Enum validation**:
   - If `sentiment` is not in `(positive, neutral, negative)` → defaults to `"neutral"`.
   - If `content_type` is not in `(educational, entertainment, opinion, news)` → defaults to `"educational"`.

---

### db.py — Database Layer

All Supabase Postgres read/write operations. Uses the Supabase Python client directly — no ORM.

#### `_client` (module-level)

Singleton `Client | None`. Initialized on first `get_client()` call.

#### `get_client() -> Client`

Returns the Supabase client. Initializes it on first call using `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` from the environment. Raises `RuntimeError` if either env var is missing.

#### `insert_post(user_id: str, post: dict) -> dict`

Inserts a new row into `posts`. Merges `user_id` with the provided `post` dict. Returns the inserted record as a dict.

- The `post` dict should contain: `url`, `platform`, `title`, `summary`, `category`, `subcategory`, `tags`, `sentiment`, `content_type`, `thumbnail_url`, `author`.

#### `delete_post(user_id: str, post_id: str) -> bool`

Deletes a post matching both `id` and `user_id` (ownership check). Returns `True` if a row was deleted, `False` otherwise.

#### `get_post_by_url(user_id: str, url: str) -> dict | None`

Checks for a duplicate URL for this user. Returns the existing post dict or `None`.

#### `get_post_by_id(user_id: str, post_id: str) -> dict | None`

Fetches a single post by its UUID, scoped to the authenticated user. Returns the post dict or `None`.

#### `get_posts(user_id, category?, platform?, sentiment?, content_type?, search?, limit=50, offset=0) -> list[dict]`

Fetches posts with optional filters, ordered by `saved_at DESC`.

- **Filters**: Each parameter adds an `.eq()` clause if not `None`.
- **Search**: Uses `.or_()` with `ilike` on both `title` and `summary` columns (substring match, case-insensitive).
- **Pagination**: Uses `.range(offset, offset + limit - 1)` for offset-based pagination.

#### `get_category_counts(user_id: str) -> list[dict]`

Returns category counts as `[{ "category": "...", "count": N }]`, sorted by count descending.

- Fetches all `category` values for the user, then aggregates client-side using Python's `Counter.most_common()`.
- **Design note**: Client-side aggregation is used because the Supabase REST API does not natively support `GROUP BY` queries.

#### `get_analytics_overview(user_id: str) -> dict`

Returns comprehensive analytics data, all computed client-side from a single query that fetches `platform`, `sentiment`, `content_type`, `tags`, and `saved_at`.

Counters used:
- `by_platform` — `Counter` of platform values
- `by_sentiment` — `Counter` of sentiment values
- `by_content_type` — `Counter` of content_type values
- `tag_counter` — `Counter` of all individual tags across all posts
- `week_counter` — `Counter` of ISO week strings (format `YYYY-Www`, e.g. `2026-W13`)

Returns:
- `total_posts`: Total count
- `by_platform`: Dict of platform → count
- `by_sentiment`: Dict of sentiment → count
- `by_content_type`: Dict of content_type → count
- `top_tags`: Top 20 tags as `[{ "tag": "...", "count": N }]`
- `posts_per_week`: Weekly post counts as `[{ "week": "2026-W13", "count": N }]`, sorted chronologically

---

## Frontend — React / Vite

### App.jsx — Root Component

The root component handles authentication state, routing, and the top navigation bar.

#### State Variables

| State           | Type                 | Default       | Description                                |
|-----------------|----------------------|---------------|--------------------------------------------|
| `session`       | `object \| null \| undefined` | `undefined` | Supabase session. `undefined` = loading, `null` = logged out. |
| `authMode`      | `"login" \| "signup"` | `"login"`    | Current auth form mode                      |
| `email`         | `string`             | `""`          | Email input value                           |
| `password`      | `string`             | `""`          | Password input value                        |
| `authError`     | `string \| null`     | `null`        | Error message from auth attempts            |
| `authLoading`   | `boolean`            | `false`       | Whether an auth action is in progress       |

#### Dev Bypass Mode

When `VITE_DEV_BYPASS=true`, the component skips Supabase auth entirely and creates a fake session:
```javascript
{ access_token: "dev-bypass-token", user: { id: "dev-user-id", email: "dev@links.local" } }
```

#### `handleAuth(e)` — Auth Form Submit Handler

- **Signup mode**: Calls `supabase.auth.signUp()`. If session is returned immediately (email confirm disabled), sets session. Otherwise, attempts `signInWithPassword()`. If the sign-in fails with "email not confirmed", shows a detailed error message with Supabase dashboard instructions.
- **Login mode**: Calls `supabase.auth.signInWithPassword()`.

#### `handleLogout()`

Calls `supabase.auth.signOut()` and sets session to `null`.

#### Rendering Logic

1. **`session === undefined`**: Shows a loading spinner.
2. **`session === null`**: Shows the auth form (email/password, login/signup toggle).
3. **`session` is truthy**: Shows the authenticated app with `BrowserRouter`.

#### Routes

| Path           | Component    | Description               |
|----------------|-------------|---------------------------|
| `/`            | `Home`      | Feed page (default)        |
| `/categories`  | `Category`  | Category explorer          |
| `/ask`         | `Ask`       | AI chat                    |
| `*`            | `Navigate`  | Redirects to `/`           |

#### Navigation Bar

Top nav with: Logo ("Links" with gradient SVG chain icon), nav links (Feed, Categories, Ask), user email display, and Sign Out button.

---

### lib/supabase.js — Supabase Client

#### `supabase` (export)

Singleton Supabase client created with `createClient(url, anonKey)`. Falls back to placeholder values if env vars are not set (with a `console.warn`).

#### `getAccessToken() -> Promise<string | null>`

Returns the current session's JWT access token for API calls. Returns `null` if not authenticated.

#### `onAuthChange(callback) -> Subscription`

Registers a listener for auth state changes. Calls `callback(session)` on any change (login, logout, token refresh). Returns the subscription object (with `.unsubscribe()` method).

---

### lib/api.js — API Client

#### `API_URL` (const)

Base URL from `VITE_API_URL` env var, defaults to `http://localhost:8000`.

#### `apiFetch(path, options?) -> Promise<any>`

Internal wrapper around `fetch()` that:

1. **Gets the auth token**: In dev bypass mode, uses `"dev-bypass-token"`. Otherwise, imports `getAccessToken()` from `supabase.js`.
2. **Sets headers**: Adds `Content-Type: application/json` and `Authorization: Bearer <token>`.
3. **Error handling**: On non-2xx response, parses the response body for a `detail` field and throws an `Error` with the message and a `.status` property.
4. **Download handling**: For CSV or JSON download responses, returns the raw `Response` object instead of parsing JSON.

#### `api` (export object)

| Method                         | HTTP     | Path                    | Description                              |
|-------------------------------|----------|-------------------------|------------------------------------------|
| `savePost(url, manualText?)`  | `POST`   | `/save`                 | Save and classify a URL                  |
| `getPosts(filters?)`          | `GET`    | `/posts?...`            | Fetch posts with optional filter params  |
| `getPost(id)`                 | `GET`    | `/posts/:id`            | Fetch single post                        |
| `deletePost(id)`              | `DELETE` | `/posts/:id`            | Delete a post                            |
| `ask(question)`               | `POST`   | `/ask`                  | Ask a question about saved content       |
| `getCategories()`             | `GET`    | `/categories`           | Get category counts                      |
| `getAnalytics()`              | `GET`    | `/analytics/overview`   | Get analytics data                       |
| `exportPosts(category?, format?)` | `GET` | `/export?format=...`   | Download posts as CSV or JSON            |

---

### pages/Home.jsx — Feed Page

The main landing page after login. Provides URL ingestion and the chronological feed.

#### State Variables

| State           | Type          | Description                                    |
|-----------------|---------------|------------------------------------------------|
| `url`           | `string`      | URL input value                                 |
| `posts`         | `PostOut[]`   | Loaded post data                                |
| `loading`       | `boolean`     | Whether posts are being fetched                 |
| `saving`        | `boolean`     | Whether a save is in progress                   |
| `toast`         | `object|null` | `{ message, type, id }` for toast notifications |
| `search`        | `string`      | Debounced search query                          |
| `searchInput`   | `string`      | Raw search input (debounces to `search`)        |
| `filters`       | `object`      | `{ platform, sentiment, content_type }`         |
| `offset`        | `number`      | Pagination offset                               |
| `hasMore`       | `boolean`     | Whether more posts are available                |

#### `fetchPosts(reset = false)`

Fetches posts from the API with current filters and search. On `reset=true`, replaces the entire post list. Otherwise, appends to it (infinite scroll). Sets `hasMore` based on whether the response contains exactly 50 items.

#### `handleSave(e)`

Saves a URL:
1. Trims the input. Returns early if empty.
2. Calls `api.savePost(url)`.
3. On duplicate, shows an error toast.
4. On success, prepends the new post to the feed, shows a success toast, clears the input.

#### `handleDelete(id)`

Calls `api.deletePost(id)`, then filters the post out of the local state.

#### `showToast(message, type)`

Shows a toast notification that auto-hides after 3.5 seconds.

#### Debounced Search

`searchInput` is debounced with a 300ms `setTimeout`. When `search` changes, `fetchPosts(true)` is triggered via `useEffect`.

#### UI Sections

1. **Toast container** — Floating notification overlay
2. **URL input form** — Text input + "Save Link" button (shows spinner during save)
3. **Filters bar** — Search input + 3 dropdown selects (Platform, Sentiment, Type)
4. **Feed** — Grid of `PostCard` components
5. **Empty state** — Chain link SVG icon + "No saved links yet" message
6. **Load More button** — Shown when `hasMore` is true

---

### pages/Category.jsx — Categories & Analytics

Category explorer with interactive analytics charts (powered by Recharts) and a filtered post feed.

#### State Variables

| State              | Type           | Description                           |
|--------------------|----------------|---------------------------------------|
| `categories`       | `array`        | Category count objects                 |
| `selectedCategory` | `string|null`  | Currently selected category filter     |
| `posts`            | `array`        | Posts for the selected category         |
| `analytics`        | `object|null`  | Analytics overview data                 |
| `loading`          | `boolean`      | Loading state                           |
| `showAnalytics`    | `boolean`      | Toggle for chart visibility             |

#### Chart Colors

```javascript
const COLORS = ["#6c5ce7", "#a78bfa", "#00cec9", "#fdcb6e", "#e17055",
                "#0984e3", "#00b894", "#d63031", "#e84393", "#636e72"];
```

#### Charts (Recharts)

1. **Posts by Category** — `BarChart` with color-coded bars per category
2. **Platform Breakdown** — `PieChart` (donut chart with inner radius 50)
3. **Sentiment Distribution** — Horizontal `BarChart` with color-coded bars (green=positive, yellow=neutral, red=negative)
4. **Posts Over Time** — `LineChart` showing posts per ISO week
5. **Top Tags** — Tag pills with dynamic font size based on count
6. **Overview** — Summary card showing total posts, category count, platform count

#### Export

`handleExport(format)` — Downloads posts via `api.exportPosts()`, creates a blob URL, and triggers a download via a temporary `<a>` element.

---

### pages/Ask.jsx — AI Chat

Chat interface for natural-language Q&A about saved content via Gemini.

#### State Variables

| State      | Type      | Description                                   |
|------------|-----------|-----------------------------------------------|
| `messages` | `array`   | `[{ role: "user"|"assistant", content: "..." }]` |
| `loading`  | `boolean` | Whether a question is being processed          |

#### Initial Message

The chat starts with a welcome message from the assistant with example queries:
- "What have I saved about investing?"
- "Summarize my fitness content"
- "Which topics do I save the most?"
- "Have I saved anything contradictory about diet?"

#### `handleSubmit(question)`

1. Adds the user's question as a `{ role: "user" }` message.
2. Sets `loading=true` (shows typing indicator).
3. Calls `api.ask(question)`.
4. On success, adds the answer as a `{ role: "assistant" }` message.
5. On error, adds a `⚠️` error message.

#### Auto-Scroll

`useEffect` with a `chatEndRef` that scrolls to the bottom on every new message or loading state change.

#### Typing Indicator

When `loading=true`, shows an animated three-dot typing indicator (`.typing-dots` CSS animation).

---

### components/PostCard.jsx — Post Display

Displays a single saved post with all enriched metadata. Used in both the Home feed and the Category feed.

#### Props

| Prop       | Type                       | Description                |
|------------|----------------------------|----------------------------|
| `post`     | `PostOut`                  | The post data to display   |
| `onDelete` | `(id: string) => void`     | Delete callback (optional) |

#### State

- `confirmDelete: boolean` — Two-step delete confirmation. Auto-resets after 3 seconds.
- `copied: boolean` — Copy feedback indicator. Auto-resets after 2 seconds.

#### `handleDelete(e)`

Two-step delete: first click sets `confirmDelete=true` and shows "Confirm delete?" for 3 seconds. Second click within that window calls `onDelete(post.id)`. Includes `e.stopPropagation()` and `e.preventDefault()` to prevent rapid-click state propagation bugs from interrupting the action.

#### `handleCopy()`

Copies `post.summary` to the clipboard using `navigator.clipboard.writeText()`.

#### Display Sections

1. **Header**: Platform badge (YT/IG/TK/🔗), author (`@username`), relative time
2. **Title**: Clickable link to the original URL (opens in new tab)
3. **Summary**: AI-generated one-sentence summary
4. **Badges**: Category, subcategory, sentiment (with colored dot), content type
5. **Tags**: Pill-shaped tag badges
6. **Actions**: Copy summary button, Delete button (with confirmation state)

#### Helper Functions

##### `platformLabel(platform) -> string`

Maps platform strings to short display labels: `youtube → "YT"`, `instagram → "IG"`, `tiktok → "TK"`, `other → "🔗"`.

##### `getRelativeTime(isoStr) -> string`

Converts an ISO 8601 timestamp to a human-readable relative time string:
- `< 60s` → `"just now"`
- `< 1h` → `"Xm ago"`
- `< 24h` → `"Xh ago"`
- `< 7d` → `"Xd ago"`
- `≥ 7d` → Locale-formatted date string

---

### components/CategorySidebar.jsx — Category Navigation

Vertical sidebar listing all categories with post counts.

#### Props

| Prop         | Type                           | Description                     |
|--------------|--------------------------------|---------------------------------|
| `categories` | `CategoryCount[]`              | Category data from API          |
| `selected`   | `string \| null`               | Currently selected category     |
| `onSelect`   | `(category: string|null) => void` | Selection callback           |

#### Rendering

- **"All Posts"** item at the top — shows the sum of all category counts. Active when `selected === null`.
- **Category items** — One item per category with name and count. Active when `selected === cat.category`.
- **Empty state** — "No categories yet. Save some links to get started!" when there are no categories.

---

### components/AskBar.jsx — Chat Input

Text input + send button for the Ask Your Feed chat.

#### Props

| Prop       | Type                        | Description                 |
|------------|-----------------------------|-----------------------------|
| `onSubmit` | `(question: string) => void` | Called with trimmed question |
| `disabled` | `boolean`                   | Disables input when loading  |

#### `handleSubmit(e)`

Prevents default form submission. Trims the question text. If non-empty and not disabled, calls `onSubmit(trimmed)` and clears the input.

---

## Data Flow

### Saving a Link (POST /save)

```
User pastes URL → Frontend POST /save → Backend:
  1. _get_user_id(auth header) → user_id
  2. db.get_post_by_url(user_id, url) → duplicate check
  3. scraper.scrape(url) → ScrapedContent { title, description, platform, ... }
  4. gemini.categorize_post(title, description) → { category, tags, sentiment, ... }
     └─ [fallback on error] → { category: "Uncategorized", ... }
  5. db.insert_post(user_id, merged_data) → saved row
  6. Return SaveResponse { post, is_duplicate }
```

### Asking a Question (POST /ask)

```
User types question → Frontend POST /ask → Backend:
  1. _get_user_id(auth header) → user_id
  2. db.get_posts(user_id, limit=500) → all recent posts
  3. Build context JSON (title, summary, category, tags, platform, sentiment, saved_at)
  4. gemini.ask_feed(context_json, question) → natural language answer
  5. Return AskResponse { answer }
```

---

## Authentication

The system uses **Supabase Auth** with email/password authentication.

### Frontend Auth Flow

1. User enters email/password on the auth screen.
2. `supabase.auth.signUp()` or `signInWithPassword()` is called.
3. On success, a JWT session is stored by the Supabase client.
4. The `onAuthStateChange` listener detects the new session and updates `App` state.
5. All subsequent API calls include the JWT as `Authorization: Bearer <token>`.

### Backend Auth Flow

1. Every API request (except `/health`) includes the JWT in the `Authorization` header.
2. `_get_user_id()` decodes the JWT payload (base64) to extract the `sub` claim (UUID).
3. All database queries are scoped to this `user_id`.

### Dev Bypass Mode

For local development when Supabase is not fully configured:
- **Frontend**: Set `VITE_DEV_BYPASS=true` in `frontend/.env`. Creates a fake session with token `"dev-bypass-token"`.
- **Backend**: Recognizes `"dev-bypass-token"` and returns a fixed user ID `00000000-0000-0000-0000-000000000001`.

---

## AI Classification Details

### Model: Gemini 2.5 Flash

A "thinking" model that performs internal reasoning before producing output. This has an important implication: **thinking tokens count against `max_output_tokens`**. The token budget must be set high enough (2048+) to accommodate both reasoning and the JSON response.

### Classification Fields

| Field          | Type       | Possible Values                                  |
|----------------|-----------|--------------------------------------------------|
| `category`     | `string`  | Open-ended (e.g. Music, Tech, Finance, Fitness)  |
| `subcategory`  | `string`  | Open-ended (e.g. Pop Music, Web Development)     |
| `tags`         | `string[]`| Up to 5 keywords                                 |
| `summary`      | `string`  | One sentence, max 20 words                       |
| `sentiment`    | `enum`    | `positive`, `neutral`, `negative`                |
| `content_type` | `enum`    | `educational`, `entertainment`, `opinion`, `news`|

### Fallback Behavior

If Gemini is rate-limited (`429`) or returns unparseable output, the post is still saved with:
```json
{
  "category": "Uncategorized",
  "subcategory": "",
  "tags": [],
  "summary": "<scraped title, first 100 chars>",
  "sentiment": "neutral",
  "content_type": "uncategorized"
}
```

---

## API Reference

| Method   | Endpoint              | Auth | Request Body                        | Response                    |
|----------|-----------------------|------|-------------------------------------|-----------------------------|
| `GET`    | `/health`             | No   | —                                   | `{ "status": "ok" }`       |
| `POST`   | `/save`               | Yes  | `{ "url": "...", "manual_text": "..." }` | `SaveResponse`         |
| `GET`    | `/posts`              | Yes  | Query: `category`, `platform`, `sentiment`, `content_type`, `search`, `limit`, `offset` | `PostOut[]` |
| `GET`    | `/posts/{post_id}`    | Yes  | —                                   | `PostOut`                   |
| `DELETE` | `/posts/{post_id}`    | Yes  | —                                   | `{ "deleted": true }`       |
| `POST`   | `/ask`                | Yes  | `{ "question": "..." }`            | `AskResponse`               |
| `GET`    | `/categories`         | Yes  | —                                   | `CategoryCount[]`           |
| `GET`    | `/analytics/overview` | Yes  | —                                   | `AnalyticsOverview`         |
| `GET`    | `/export`             | Yes  | Query: `category`, `format` (json/csv) | File download (streaming) |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable              | Required | Example                          | Description                       |
|-----------------------|----------|----------------------------------|-----------------------------------|
| `SUPABASE_URL`        | Yes      | `https://xxx.supabase.co`        | Supabase project URL              |
| `SUPABASE_SERVICE_KEY` | Yes     | `eyJhbGciOiJIUzI1NiIsInR5cCI...` | Supabase anon/service key (JWT)   |
| `GEMINI_API_KEY`      | Yes      | `AIzaSy...`                      | Google AI Studio API key          |
| `FRONTEND_ORIGIN`     | No       | `http://localhost:5173`          | CORS allowed origin (default: 5173)|

### Frontend (`frontend/.env`)

| Variable               | Required | Example                          | Description                       |
|------------------------|----------|----------------------------------|-----------------------------------|
| `VITE_SUPABASE_URL`   | Yes      | `https://xxx.supabase.co`        | Supabase project URL              |
| `VITE_SUPABASE_ANON_KEY`| Yes    | `eyJhbGciOiJIUzI1NiIsInR5cCI...` | Supabase anonymous key (JWT)      |
| `VITE_API_URL`         | No       | `http://localhost:8000`          | Backend API URL (default: 8000)   |
| `VITE_DEV_BYPASS`      | No       | `true`                           | Skip auth for dev (default: false)|
