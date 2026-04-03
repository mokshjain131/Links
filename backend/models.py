"""
Pydantic request/response schemas for the Links API.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ── Requests ──────────────────────────────────────────────────────────

class SaveRequest(BaseModel):
    """Request body for POST /save."""
    url: str = Field(..., min_length=1, description="The URL to ingest")
    manual_text: Optional[str] = Field(
        None, description="Fallback text if scraping fails"
    )


class AskRequest(BaseModel):
    """Request body for POST /ask."""
    question: str = Field(
        ..., min_length=1, description="Natural language question about saved content"
    )


# ── Responses ─────────────────────────────────────────────────────────

class PostOut(BaseModel):
    """A single saved post returned by the API."""
    id: str
    url: str
    platform: str
    title: Optional[str] = None
    summary: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    tags: list[str] = []
    sentiment: Optional[str] = None
    content_type: Optional[str] = None
    thumbnail_url: Optional[str] = None
    author: Optional[str] = None
    saved_at: str  # ISO 8601


class SaveResponse(BaseModel):
    """Response for POST /save."""
    post: PostOut
    is_duplicate: bool = False


class AskResponse(BaseModel):
    """Response for POST /ask."""
    answer: str


class CategoryCount(BaseModel):
    """A single category with its post count."""
    category: str
    count: int


class AnalyticsOverview(BaseModel):
    """Aggregated analytics data for the dashboard."""
    total_posts: int
    by_platform: dict[str, int] = {}
    by_sentiment: dict[str, int] = {}
    by_content_type: dict[str, int] = {}
    top_tags: list[dict] = []           # [{ "tag": "...", "count": N }]
    posts_per_week: list[dict] = []     # [{ "week": "2026-W13", "count": N }]
