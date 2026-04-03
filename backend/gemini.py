"""
Gemini 2.0 Flash integration for content classification and feed Q&A.
"""

import json
import os

from google import genai
from dotenv import load_dotenv

load_dotenv()


# ── Exceptions ────────────────────────────────────────────────────────

class GeminiRateLimitError(Exception):
    """Raised when Gemini returns a 429 rate-limit error."""
    pass


class GeminiParseError(Exception):
    """Raised when Gemini returns unparseable output."""
    pass


# ── Configuration ─────────────────────────────────────────────────────

_configured = False


def _ensure_configured():
    """Configure the Gemini SDK once."""
    global _configured
    if not _configured:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY must be set in environment")
        client = genai.Client(api_key=api_key)
        _configured = client
    return _configured


# ── Prompts ───────────────────────────────────────────────────────────

CATEGORIZE_PROMPT = """\
You are a content classifier. Given the following social media post \
metadata, return a JSON object with these exact fields:
- category        (string — top-level topic, e.g. Finance, Fitness, Tech, Cooking)
- subcategory     (string — more specific topic, e.g. Investing, Strength Training)
- tags            (array of strings, max 5 keywords)
- summary         (one sentence, max 20 words)
- sentiment       (one of: positive, neutral, negative)
- content_type    (one of: educational, entertainment, opinion, news)

Respond only with the JSON object. No preamble, no markdown, no explanation.

Title: {title}
Description: {description}"""

ASK_PROMPT = """\
You are an assistant that helps users explore their saved social media content.
Answer the user's question based only on the saved content provided below.
If the answer is not in the saved content, say so clearly.

Saved content:
{posts_json}

User question: {question}"""


# ── Public API ────────────────────────────────────────────────────────

async def categorize_post(title: str, description: str) -> dict:
    """
    Send content to Gemini for classification.

    Returns dict with keys: category, subcategory, tags, summary,
    sentiment, content_type.
    """
    client = _ensure_configured()

    prompt = CATEGORIZE_PROMPT.format(
        title=title or "(no title)",
        description=(description or "(no description)")[:2000],  # cap length
    )

    # Attempt 1
    try:
        result = await _call_gemini(client, "gemini-2.5-flash", prompt, temperature=0.3, max_tokens=2048)
        return _parse_categorization(result)
    except GeminiParseError:
        pass

    # Attempt 2 — retry with stricter instruction
    try:
        retry_prompt = prompt + "\n\nIMPORTANT: Return ONLY valid JSON. No markdown fences."
        result = await _call_gemini(client, "gemini-2.5-flash", retry_prompt, temperature=0.1, max_tokens=2048)
        return _parse_categorization(result)
    except GeminiParseError as e:
        raise GeminiParseError(f"Failed to parse Gemini response after retry: {e}")


async def ask_feed(posts_json: str, question: str) -> str:
    """
    Send user's saved posts + question to Gemini.
    Returns a natural language answer.
    """
    client = _ensure_configured()

    prompt = ASK_PROMPT.format(
        posts_json=posts_json[:50_000],  # cap at ~50k chars to stay within limits
        question=question,
    )

    try:
        return await _call_gemini(client, "gemini-2.5-flash", prompt, temperature=0.7, max_tokens=4096)
    except Exception as e:
        raise RuntimeError(f"Gemini ask_feed failed: {e}")


# ── Internal helpers ──────────────────────────────────────────────────

async def _call_gemini(
    client: genai.Client,
    model_name: str,
    prompt: str,
    temperature: float,
    max_tokens: int,
) -> str:
    """
    Call Gemini and return the response text.
    Handles rate-limit errors.
    """
    try:
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )
        if not response.text:
            raise GeminiParseError("Empty response from Gemini")
        return response.text.strip()
    except Exception as e:
        error_str = str(e).lower()
        if "429" in error_str or "resource exhausted" in error_str:
            raise GeminiRateLimitError("Gemini rate limit exceeded (15 RPM)")
        raise


def _parse_categorization(text: str) -> dict:
    """
    Parse the JSON response from Gemini's categorization.
    Strips markdown code fences if present.
    """
    # Strip markdown fences
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove first and last fence lines
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise GeminiParseError(f"Invalid JSON from Gemini: {e}\nRaw: {text[:200]}")

    # Validate required fields
    required = ["category", "subcategory", "tags", "summary", "sentiment", "content_type"]
    for field in required:
        if field not in data:
            raise GeminiParseError(f"Missing field '{field}' in Gemini response")

    # Normalize
    data["tags"] = data["tags"][:5]  # cap at 5
    data["sentiment"] = data["sentiment"].lower()
    data["content_type"] = data["content_type"].lower()

    # Validate enums
    if data["sentiment"] not in ("positive", "neutral", "negative"):
        data["sentiment"] = "neutral"
    if data["content_type"] not in ("educational", "entertainment", "opinion", "news"):
        data["content_type"] = "educational"

    return data
