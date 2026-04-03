# Data Flow

## Save Flow

```
1. User pastes a URL in the frontend (Home.jsx)

2. Frontend sends:
   POST /save
   { url: "https://youtube.com/watch?v=..." }

3. scraper.py
   - Detects platform from URL domain
   - Runs the appropriate scraper:
       YouTube   → yt-dlp (title, description, transcript if available)
       Instagram → instaloader (caption, hashtags)
       TikTok    → instaloader or yt-dlp (caption, description)
       Other     → raw HTML metadata (og:title, og:description)
   - Returns: { title, description, platform }

4. gemini.py
   - Receives extracted text
   - Sends categorization prompt to Gemini 2.0 Flash
   - Returns JSON:
       {
         category:     "Finance",
         subcategory:  "Investing",
         tags:         ["ETF", "index funds", "passive income"],
         summary:      "Overview of passive investing using index ETFs.",
         sentiment:    "positive",
         content_type: "educational"
       }

5. db.py
   - Writes enriched post to Supabase:
       posts ← {
         user_id, url, platform, title,
         summary, category, tags,
         sentiment, content_type, saved_at
       }

6. Frontend receives the saved post object and prepends it to the feed
```

---

## Ask Your Feed Flow

```
1. User types a question in Ask.jsx

2. Frontend sends:
   POST /ask
   { question: "What have I saved about investing?" }

3. db.py
   - Fetches all posts for the authenticated user
   - Returns only metadata fields (no raw HTML or scraped content):
       [{ title, summary, category, tags, platform, sentiment, saved_at }]
   - Capped at 500 most recent posts

4. gemini.py builds the prompt:

   System:
     "You are an assistant that helps users explore their saved
      social media content. Answer based only on the content below.
      If the answer is not in the saved content, say so."

   Context:
     <all posts as a JSON array>

   User:
     "What have I saved about investing?"

5. Gemini 2.0 Flash responds

6. Frontend displays the answer in the chat UI (Ask.jsx)
```

---

## Gemini Prompt Design

### Categorization prompt (used in save flow)

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

### Ask prompt (used in ask your feed flow)

```
You are an assistant that helps users explore their saved social media content.
Answer the user's question based only on the saved content provided below.
If the answer is not in the saved content, say so clearly.

Saved content:
{posts_as_json}

User question: {question}
```

---

## Platform Detection Logic

```python
def detect_platform(url: str) -> str:
    if "youtube.com" in url or "youtu.be" in url:
        return "youtube"
    elif "instagram.com" in url:
        return "instagram"
    elif "tiktok.com" in url:
        return "tiktok"
    else:
        return "other"
```

---

## Error Handling

| Failure point | Behavior |
|---|---|
| Scraper fails on URL | Fall back to raw og:title / og:description metadata |
| Platform not supported | Return raw metadata with platform set to "other" |
| Gemini rate limit hit (15 RPM) | Return 429, frontend shows retry message |
| Duplicate URL | Detected before scraping, return existing post immediately |
| Supabase write fails | Return 500, frontend shows error toast |