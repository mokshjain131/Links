"""
Content scraper for social media URLs.

Extracts metadata (title, description, author, hashtags, thumbnail)
without downloading any media files. Falls back to og: meta tags
on failure.
"""

import json
import subprocess
import re
from dataclasses import dataclass, field
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


SCRAPE_TIMEOUT = 15  # seconds


@dataclass
class ScrapedContent:
    """Normalized output from any scraper."""
    title: str = ""
    description: str = ""
    platform: str = "other"
    thumbnail_url: str | None = None
    author: str | None = None
    hashtags: list[str] = field(default_factory=list)


class ScrapingError(Exception):
    """Raised when all scraping strategies fail."""
    pass


# ── Platform detection ────────────────────────────────────────────────

def detect_platform(url: str) -> str:
    """Identify the platform from the URL domain."""
    domain = urlparse(url).netloc.lower()
    if "youtube.com" in domain or "youtu.be" in domain:
        return "youtube"
    elif "instagram.com" in domain:
        return "instagram"
    elif "tiktok.com" in domain:
        return "tiktok"
    return "other"


# ── Main entry point ─────────────────────────────────────────────────

async def scrape(url: str, manual_text: str | None = None) -> ScrapedContent:
    """
    Scrape metadata from a URL. If manual_text is provided and the URL
    scraping fails, use that as the description.
    """
    platform = detect_platform(url)

    # Dispatch to platform-specific scraper
    scrapers = {
        "youtube": _scrape_youtube,
        "instagram": _scrape_instagram,
        "tiktok": _scrape_tiktok,
        "other": _scrape_generic,
    }

    try:
        content = scrapers[platform](url)
        content.platform = platform
        return content
    except Exception:
        pass

    # Fallback 1: generic og: scraper
    if platform != "other":
        try:
            content = _scrape_generic(url)
            content.platform = platform
            return content
        except Exception:
            pass

    # Fallback 2: manual text
    if manual_text:
        return ScrapedContent(
            title="Manual entry",
            description=manual_text,
            platform=platform,
        )

    raise ScrapingError(f"Failed to scrape URL: {url}")


# ── YouTube ───────────────────────────────────────────────────────────

def _scrape_youtube(url: str) -> ScrapedContent:
    """Use yt-dlp --dump-json to extract metadata without downloading."""
    result = subprocess.run(
        ["yt-dlp", "--dump-json", "--no-download", url],
        capture_output=True,
        text=True,
        timeout=SCRAPE_TIMEOUT,
    )
    if result.returncode != 0:
        raise ScrapingError(f"yt-dlp failed: {result.stderr[:200]}")

    data = json.loads(result.stdout)
    return ScrapedContent(
        title=data.get("title", ""),
        description=data.get("description", ""),
        thumbnail_url=data.get("thumbnail"),
        author=data.get("uploader") or data.get("channel"),
    )


# ── Instagram ─────────────────────────────────────────────────────────

def _scrape_instagram(url: str) -> ScrapedContent:
    """
    Use instaloader to fetch post metadata.
    Falls back to og: tags if instaloader fails.
    """
    try:
        import instaloader

        loader = instaloader.Instaloader(
            download_pictures=False,
            download_videos=False,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
        )

        # Extract shortcode from URL
        shortcode = _extract_instagram_shortcode(url)
        if not shortcode:
            raise ScrapingError("Could not extract Instagram shortcode from URL")

        post = instaloader.Post.from_shortcode(loader.context, shortcode)
        caption = post.caption or ""

        # Extract hashtags from caption
        hashtags = re.findall(r"#(\w+)", caption)

        return ScrapedContent(
            title=caption[:100] if caption else "",
            description=caption,
            thumbnail_url=post.url,
            author=post.owner_username,
            hashtags=hashtags[:10],
        )
    except ImportError:
        raise ScrapingError("instaloader not installed")


def _extract_instagram_shortcode(url: str) -> str | None:
    """Extract the shortcode from an Instagram URL."""
    patterns = [
        r"instagram\.com/p/([A-Za-z0-9_-]+)",
        r"instagram\.com/reel/([A-Za-z0-9_-]+)",
        r"instagram\.com/reels/([A-Za-z0-9_-]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


# ── TikTok ────────────────────────────────────────────────────────────

def _scrape_tiktok(url: str) -> ScrapedContent:
    """Use yt-dlp for TikTok metadata."""
    result = subprocess.run(
        ["yt-dlp", "--dump-json", "--no-download", url],
        capture_output=True,
        text=True,
        timeout=SCRAPE_TIMEOUT,
    )
    if result.returncode != 0:
        raise ScrapingError(f"yt-dlp failed for TikTok: {result.stderr[:200]}")

    data = json.loads(result.stdout)
    return ScrapedContent(
        title=data.get("title", ""),
        description=data.get("description", ""),
        thumbnail_url=data.get("thumbnail"),
        author=data.get("uploader") or data.get("creator"),
    )


# ── Generic (og: meta tags) ──────────────────────────────────────────

def _scrape_generic(url: str) -> ScrapedContent:
    """Fetch HTML and parse og: meta tags."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    resp = requests.get(url, headers=headers, timeout=SCRAPE_TIMEOUT)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    def og(prop: str) -> str:
        tag = soup.find("meta", property=f"og:{prop}")
        if tag:
            return tag.get("content", "")
        # Fallback to name attribute
        tag = soup.find("meta", attrs={"name": f"og:{prop}"})
        return tag.get("content", "") if tag else ""

    title = og("title") or (soup.title.string if soup.title else "")
    description = og("description")
    image = og("image")

    if not title and not description:
        raise ScrapingError(f"No metadata found at {url}")

    return ScrapedContent(
        title=title,
        description=description,
        thumbnail_url=image or None,
    )
