"""
Links API — FastAPI application.

All route definitions live here. Each route composes modules:
scraper.py → gemini.py → db.py
"""

import csv
import io
import json
import os

from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

load_dotenv(override=True)

from models import (
    SaveRequest,
    SaveResponse,
    PostOut,
    AskRequest,
    AskResponse,
    CategoryCount,
    AnalyticsOverview,
)
from scraper import scrape, ScrapingError
from gemini import (
    categorize_post,
    ask_feed,
    GeminiRateLimitError,
    GeminiParseError,
)
import db

# ── App setup ─────────────────────────────────────────────────────────

app = FastAPI(
    title="Links API",
    description="Social media content ingestion and categorization",
    version="1.0.0",
)

frontend_origin = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth helper ───────────────────────────────────────────────────────

def _get_user_id(authorization: str | None) -> str:
    """
    Extract user_id from the Supabase JWT in the Authorization header.
    In production, validate the JWT properly. For now, we decode
    the payload to get the sub claim.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = authorization.replace("Bearer ", "")

    # Dev bypass — matches frontend VITE_DEV_BYPASS=true
    if token == "dev-bypass-token":
        return "00000000-0000-0000-0000-000000000001"

    try:
        import base64
        # JWT is three parts: header.payload.signature
        payload = token.split(".")[1]
        # Add padding
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += "=" * padding
        decoded = base64.urlsafe_b64decode(payload)
        claims = json.loads(decoded)
        user_id = claims.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no sub claim")
        return user_id
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


# ── Routes ────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check — no auth required."""
    return {"status": "ok"}


@app.post("/save", response_model=SaveResponse)
async def save_post(
    body: SaveRequest,
    authorization: str | None = Header(None),
):
    """
    Ingest a URL: scrape → classify via Gemini → save to DB.
    Returns the enriched post.
    """
    user_id = _get_user_id(authorization)

    # ── Step 1: Duplicate check ───────────────────────────────────
    existing = db.get_post_by_url(user_id, body.url)
    if existing:
        return SaveResponse(post=PostOut(**existing), is_duplicate=True)

    # ── Step 2: Scrape metadata ───────────────────────────────────
    try:
        scraped = await scrape(body.url, body.manual_text)
    except ScrapingError as e:
        raise HTTPException(status_code=422, detail=f"Scraping failed: {e}")

    # ── Step 3: Classify via Gemini ───────────────────────────────
    try:
        analysis = await categorize_post(scraped.title, scraped.description)
    except (GeminiRateLimitError, GeminiParseError) as e:
        # Save without AI enrichment rather than failing entirely
        analysis = {
            "category": "Uncategorized",
            "subcategory": "",
            "tags": [],
            "summary": scraped.title[:100] if scraped.title else "",
            "sentiment": "neutral",
            "content_type": "uncategorized",
        }

    # ── Step 4: Save to database ──────────────────────────────────
    post_data = {
        "url": body.url,
        "platform": scraped.platform,
        "title": scraped.title or None,
        "summary": analysis.get("summary"),
        "category": analysis.get("category"),
        "subcategory": analysis.get("subcategory"),
        "tags": analysis.get("tags", []),
        "sentiment": analysis.get("sentiment"),
        "content_type": analysis.get("content_type"),
        "thumbnail_url": scraped.thumbnail_url,
        "author": scraped.author,
    }

    try:
        saved = db.insert_post(user_id, post_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    return SaveResponse(post=PostOut(**saved), is_duplicate=False)


@app.get("/posts", response_model=list[PostOut])
async def list_posts(
    authorization: str | None = Header(None),
    category: str | None = Query(None),
    platform: str | None = Query(None),
    sentiment: str | None = Query(None),
    content_type: str | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Fetch user's posts with optional filters."""
    user_id = _get_user_id(authorization)
    posts = db.get_posts(
        user_id,
        category=category,
        platform=platform,
        sentiment=sentiment,
        content_type=content_type,
        search=search,
        limit=limit,
        offset=offset,
    )
    return [PostOut(**p) for p in posts]


@app.get("/posts/{post_id}", response_model=PostOut)
async def get_post(
    post_id: str,
    authorization: str | None = Header(None),
):
    """Fetch a single post by ID."""
    user_id = _get_user_id(authorization)
    post = db.get_post_by_id(user_id, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return PostOut(**post)


@app.delete("/posts/{post_id}")
async def delete_post_route(
    post_id: str,
    authorization: str | None = Header(None),
):
    """Delete a post by ID."""
    user_id = _get_user_id(authorization)
    deleted = db.delete_post(user_id, post_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"deleted": True}


@app.post("/ask", response_model=AskResponse)
async def ask(
    body: AskRequest,
    authorization: str | None = Header(None),
):
    """Ask a question about your saved content."""
    user_id = _get_user_id(authorization)

    # Fetch up to 500 most recent posts
    posts = db.get_posts(user_id, limit=500)

    if not posts:
        return AskResponse(
            answer="You haven't saved any content yet. Start by saving some links!"
        )

    # Build context — only metadata fields
    context = [
        {
            "title": p.get("title"),
            "summary": p.get("summary"),
            "category": p.get("category"),
            "tags": p.get("tags", []),
            "platform": p.get("platform"),
            "sentiment": p.get("sentiment"),
            "saved_at": p.get("saved_at"),
        }
        for p in posts
    ]

    try:
        answer = await ask_feed(json.dumps(context), body.question)
    except GeminiRateLimitError:
        raise HTTPException(
            status_code=429,
            detail="AI service rate limit reached. Please try again in a minute.",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {e}")

    return AskResponse(answer=answer)


@app.get("/categories", response_model=list[CategoryCount])
async def get_categories(
    authorization: str | None = Header(None),
):
    """Get all categories with post counts."""
    user_id = _get_user_id(authorization)
    counts = db.get_category_counts(user_id)
    return [CategoryCount(**c) for c in counts]


@app.get("/analytics/overview", response_model=AnalyticsOverview)
async def get_analytics(
    authorization: str | None = Header(None),
):
    """Get aggregated analytics for the dashboard."""
    user_id = _get_user_id(authorization)
    overview = db.get_analytics_overview(user_id)
    return AnalyticsOverview(**overview)


@app.get("/export")
async def export_posts(
    authorization: str | None = Header(None),
    category: str | None = Query(None),
    format: str = Query("json", pattern="^(json|csv)$"),
):
    """Export posts as JSON or CSV."""
    user_id = _get_user_id(authorization)
    posts = db.get_posts(user_id, category=category, limit=10000)

    if format == "csv":
        output = io.StringIO()
        if posts:
            writer = csv.DictWriter(output, fieldnames=posts[0].keys())
            writer.writeheader()
            for p in posts:
                # Convert tags list to comma-separated string for CSV
                row = {**p, "tags": ", ".join(p.get("tags", []))}
                writer.writerow(row)
        content = output.getvalue()
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=links_export.csv"},
        )
    else:
        return StreamingResponse(
            io.BytesIO(json.dumps(posts, indent=2, default=str).encode()),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=links_export.json"},
        )
