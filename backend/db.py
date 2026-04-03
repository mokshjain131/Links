"""
Supabase database layer.

All read/write operations go through this module.
Uses the Supabase Python client directly — no ORM.
"""

import os
from collections import Counter
from datetime import datetime, timezone

from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# ── Singleton client ──────────────────────────────────────────────────

_client: Client | None = None


def get_client() -> Client:
    """Return the Supabase client, initializing on first call."""
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment"
            )
        _client = create_client(url, key)
    return _client


# ── Write operations ──────────────────────────────────────────────────

def insert_post(user_id: str, post: dict) -> dict:
    """
    Insert a new post row. Returns the inserted record.

    The `post` dict should contain: url, platform, title, summary,
    category, subcategory, tags, sentiment, content_type,
    thumbnail_url, author.
    """
    row = {
        "user_id": user_id,
        **post,
    }
    result = get_client().table("posts").insert(row).execute()
    return result.data[0]


def delete_post(user_id: str, post_id: str) -> bool:
    """Delete a post owned by user_id. Returns True if deleted."""
    result = (
        get_client()
        .table("posts")
        .delete()
        .eq("id", post_id)
        .eq("user_id", user_id)
        .execute()
    )
    return len(result.data) > 0


# ── Read operations ───────────────────────────────────────────────────

def get_post_by_url(user_id: str, url: str) -> dict | None:
    """Check for duplicate URL. Returns existing post or None."""
    result = (
        get_client()
        .table("posts")
        .select("*")
        .eq("user_id", user_id)
        .eq("url", url)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def get_post_by_id(user_id: str, post_id: str) -> dict | None:
    """Fetch a single post by ID, scoped to user."""
    result = (
        get_client()
        .table("posts")
        .select("*")
        .eq("id", post_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def get_posts(
    user_id: str,
    category: str | None = None,
    platform: str | None = None,
    sentiment: str | None = None,
    content_type: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """
    Fetch posts with optional filters. Ordered by saved_at DESC.
    """
    query = (
        get_client()
        .table("posts")
        .select("*")
        .eq("user_id", user_id)
    )

    if category:
        query = query.eq("category", category)
    if platform:
        query = query.eq("platform", platform)
    if sentiment:
        query = query.eq("sentiment", sentiment)
    if content_type:
        query = query.eq("content_type", content_type)
    if search:
        # Substring search across title and summary via ilike
        pattern = f"%{search}%"
        query = query.or_(f"title.ilike.{pattern},summary.ilike.{pattern}")

    result = (
        query
        .order("saved_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data


def get_category_counts(user_id: str) -> list[dict]:
    """
    Return category counts: [{ "category": "...", "count": N }, ...].
    Done client-side since Supabase REST doesn't support GROUP BY.
    """
    result = (
        get_client()
        .table("posts")
        .select("category")
        .eq("user_id", user_id)
        .execute()
    )
    counts = Counter(row["category"] for row in result.data if row.get("category"))
    return [
        {"category": cat, "count": n}
        for cat, n in counts.most_common()
    ]


def get_analytics_overview(user_id: str) -> dict:
    """
    Return aggregated analytics: total posts, breakdowns by platform /
    sentiment / content_type, top tags, and posts per week.
    """
    result = (
        get_client()
        .table("posts")
        .select("platform, sentiment, content_type, tags, saved_at")
        .eq("user_id", user_id)
        .execute()
    )
    rows = result.data

    # ── Totals and breakdowns ─────────────────────────────────────
    total = len(rows)
    by_platform: Counter = Counter()
    by_sentiment: Counter = Counter()
    by_content_type: Counter = Counter()
    tag_counter: Counter = Counter()
    week_counter: Counter = Counter()

    for row in rows:
        if row.get("platform"):
            by_platform[row["platform"]] += 1
        if row.get("sentiment"):
            by_sentiment[row["sentiment"]] += 1
        if row.get("content_type"):
            by_content_type[row["content_type"]] += 1
        for tag in (row.get("tags") or []):
            tag_counter[tag] += 1
        if row.get("saved_at"):
            try:
                dt = datetime.fromisoformat(row["saved_at"])
                iso_week = dt.strftime("%G-W%V")
                week_counter[iso_week] += 1
            except (ValueError, TypeError):
                pass

    top_tags = [
        {"tag": tag, "count": n}
        for tag, n in tag_counter.most_common(20)
    ]

    posts_per_week = [
        {"week": week, "count": n}
        for week, n in sorted(week_counter.items())
    ]

    return {
        "total_posts": total,
        "by_platform": dict(by_platform),
        "by_sentiment": dict(by_sentiment),
        "by_content_type": dict(by_content_type),
        "top_tags": top_tags,
        "posts_per_week": posts_per_week,
    }
