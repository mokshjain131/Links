import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import PostCard from "../components/PostCard";

/**
 * Home — Main page: paste URL, see feed, search & filter.
 */
export default function Home() {
  const [url, setUrl] = useState("");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    platform: "",
    sentiment: "",
    content_type: "",
  });
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // ── Fetch posts ────────────────────────────────────────────────
  const fetchPosts = useCallback(
    async (reset = false) => {
      setLoading(true);
      try {
        const newOffset = reset ? 0 : offset;
        const result = await api.getPosts({
          ...filters,
          search: search || undefined,
          limit: 50,
          offset: newOffset,
        });
        if (reset) {
          setPosts(result);
          setOffset(result.length);
        } else {
          setPosts((prev) => [...prev, ...result]);
          setOffset(newOffset + result.length);
        }
        setHasMore(result.length === 50);
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        setLoading(false);
      }
    },
    [filters, search, offset]
  );

  // Initial load
  useEffect(() => {
    fetchPosts(true);
  }, [filters, search]);

  // ── Save a URL ─────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    setSaving(true);
    try {
      const result = await api.savePost(trimmedUrl);
      if (result.is_duplicate) {
        showToast("This URL is already saved!", "error");
      } else {
        setPosts((prev) => [result.post, ...prev]);
        showToast(`Saved: ${result.post.title || "Link saved!"}`, "success");
        setUrl("");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete a post ──────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await api.deletePost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      showToast("Post deleted", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // ── Toast helper ───────────────────────────────────────────────
  const showToast = (message, type) => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Debounced search ───────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  return (
    <div className="page-container">
      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`} key={toast.id}>
            {toast.message}
          </div>
        </div>
      )}

      {/* URL Input */}
      <form className="url-input-section" onSubmit={handleSave}>
        <div className="input-group">
          <input
            id="url-input"
            type="url"
            className="input"
            placeholder="Paste a YouTube, Instagram, TikTok, or any URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={saving}
          />
          <button
            id="save-button"
            type="submit"
            className="btn btn-primary"
            disabled={saving || !url.trim()}
          >
            {saving ? (
              <>
                <span className="spinner" /> Saving...
              </>
            ) : (
              "Save Link"
            )}
          </button>
        </div>
      </form>

      {/* Search & Filters */}
      <div className="filters-bar" style={{ marginTop: 20 }}>
        <input
          id="search-input"
          type="text"
          className="input"
          placeholder="Search posts..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
        <select
          className="select"
          value={filters.platform}
          onChange={(e) =>
            setFilters((f) => ({ ...f, platform: e.target.value }))
          }
        >
          <option value="">All Platforms</option>
          <option value="youtube">YouTube</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
          <option value="other">Other</option>
        </select>
        <select
          className="select"
          value={filters.sentiment}
          onChange={(e) =>
            setFilters((f) => ({ ...f, sentiment: e.target.value }))
          }
        >
          <option value="">All Sentiments</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
        </select>
        <select
          className="select"
          value={filters.content_type}
          onChange={(e) =>
            setFilters((f) => ({ ...f, content_type: e.target.value }))
          }
        >
          <option value="">All Types</option>
          <option value="educational">Educational</option>
          <option value="entertainment">Entertainment</option>
          <option value="opinion">Opinion</option>
          <option value="news">News</option>
        </select>
      </div>

      {/* Feed */}
      <div className="feed">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onDelete={handleDelete} />
        ))}

        {loading && (
          <div className="loading-overlay">
            <span className="spinner" /> Loading posts...
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
              <path d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
            </svg>
            <h3>No saved links yet</h3>
            <p>Paste a URL above to start building your feed</p>
          </div>
        )}

        {!loading && hasMore && posts.length > 0 && (
          <button
            className="btn btn-ghost"
            onClick={() => fetchPosts(false)}
            style={{ alignSelf: "center", marginTop: 12 }}
          >
            Load More
          </button>
        )}
      </div>

      <style>{`
        .url-input-section {
          margin-bottom: 4px;
        }
        .url-input-section .input-group {
          display: flex;
          gap: 12px;
        }
        .url-input-section .input {
          flex: 1;
        }
      `}</style>
    </div>
  );
}
