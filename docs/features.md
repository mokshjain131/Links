# Features

## Content Ingestion

- Paste any URL from YouTube, Instagram, TikTok, or other platforms
- scraper.py auto-detects platform from the URL domain
- Extracts title, description, caption, and hashtags — no video processing
- Manual text paste fallback if a URL fails to scrape
- Duplicate URL detection before scraping (simple string match)

---

## Auto-enrichment via Gemini

Every saved post is automatically enriched with the following fields.
No user input required.

| Field | Description |
|---|---|
| Category | Top-level topic (e.g. Finance, Fitness, Tech) |
| Subcategory | More specific topic (e.g. Investing, Strength Training) |
| Tags | Up to 5 keywords extracted from the content |
| Summary | One-sentence TL;DR, max 20 words |
| Sentiment | Positive, neutral, or negative |
| Content type | Educational, entertainment, opinion, or news |

---

## Organization

- Filter feed by category, subcategory, platform, sentiment, or content type
- Search across all saved posts by keyword
- Collections to manually group posts by theme or project
- Duplicate URL detection prevents saving the same post twice

---

## Ask Your Feed

A chat interface where the user asks natural language questions about their saved content.

**How it works:**
- All saved post metadata is fetched from Supabase (capped at 500 most recent)
- Sent to Gemini as context along with the user's question
- Gemini answers based only on the saved content

**Example questions:**
- "What have I saved about investing this month?"
- "Summarize everything I have on stoicism"
- "Which topics do I save the most?"
- "Have I saved anything contradictory about diet?"
- "Which creators do I save the most from?"

---

## Analytics

Simple counters and charts. No ML involved — just aggregating the database.

- Posts saved per category (bar chart)
- Platform breakdown (pie chart)
- Sentiment distribution across your feed
- Most used tags
- Posts saved over time (weekly view)

---

## Export

- Export any category or collection as CSV or JSON
- Copy a post's summary to clipboard

---

## What is intentionally excluded (v1)

These features are good v2 candidates but add complexity without core value right now.

- Trend alerts and background jobs
- Collaborative/shared workspaces
- Push to Notion, newsletter, or Obsidian
- Full-text search inside video transcripts