import { useState } from "react";

/**
 * PostCard — Displays a single saved post with all enriched metadata.
 */
export default function PostCard({ post, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  const timeAgo = getRelativeTime(post.saved_at);

  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirmDelete) {
      console.log("Triggering onDelete for post:", post.id);
      onDelete?.(post.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const handleCopy = async () => {
    if (post.summary) {
      await navigator.clipboard.writeText(post.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="card post-card">
      {/* Header row: platform badge + meta */}
      <div className="post-header">
        <div className="post-header-left">
          <span className={`platform-icon ${post.platform}`}>
            {platformLabel(post.platform)}
          </span>
          {post.author && (
            <span className="post-author">@{post.author}</span>
          )}
        </div>
        <div className="post-header-right">
          <span className="post-time">{timeAgo}</span>
        </div>
      </div>

      {/* Title */}
      <a
        href={post.url}
        target="_blank"
        rel="noopener noreferrer"
        className="post-title-link"
      >
        {post.title || post.url}
      </a>

      {/* Summary */}
      {post.summary && <p className="post-summary">{post.summary}</p>}

      {/* Badges row */}
      <div className="post-meta-row">
        {post.category && (
          <span className="badge badge-category">{post.category}</span>
        )}
        {post.subcategory && (
          <span className="badge badge-subcategory">{post.subcategory}</span>
        )}
        {post.sentiment && (
          <span className="post-sentiment">
            <span className={`sentiment-dot ${post.sentiment}`}></span>
            <span className="sentiment-label">{post.sentiment}</span>
          </span>
        )}
        {post.content_type && (
          <span className="content-type-label">{post.content_type}</span>
        )}
      </div>

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div className="post-tags">
          {post.tags.map((tag, i) => (
            <span key={i} className="tag-pill">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="post-actions">
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleCopy}
          title="Copy summary"
        >
          {copied ? "✓ Copied" : "📋 Copy"}
        </button>
        {onDelete && (
          <button
            className={`btn btn-sm ${confirmDelete ? "btn-danger" : "btn-ghost"}`}
            onClick={handleDelete}
          >
            {confirmDelete ? "Confirm delete?" : "🗑 Delete"}
          </button>
        )}
      </div>

      <style>{`
        .post-card {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .post-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .post-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .post-header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .post-author {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        .post-time {
          font-size: 0.7rem;
          color: var(--text-muted);
        }
        .post-title-link {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.4;
          transition: color var(--transition-fast);
        }
        .post-title-link:hover {
          color: var(--accent-secondary);
        }
        .post-summary {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .post-meta-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .post-sentiment {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .sentiment-label {
          font-size: 0.65rem;
          color: var(--text-muted);
          text-transform: capitalize;
        }
        .post-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .post-actions {
          display: flex;
          gap: 8px;
          padding-top: 4px;
          border-top: 1px solid var(--border-color);
        }
      `}</style>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function platformLabel(platform) {
  const labels = {
    youtube: "YT",
    instagram: "IG",
    tiktok: "TK",
    other: "🔗",
  };
  return labels[platform] || "🔗";
}

function getRelativeTime(isoStr) {
  if (!isoStr) return "";
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(isoStr).toLocaleDateString();
}
