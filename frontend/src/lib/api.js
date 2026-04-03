const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";

/**
 * Wrapper around fetch that injects the auth token and handles errors.
 */
async function apiFetch(path, options = {}) {
  let token = null;

  if (import.meta.env.VITE_DEV_BYPASS === "true") {
    token = "dev-bypass-token";
  } else {
    const { getAccessToken } = await import("./supabase.js");
    token = await getAccessToken();
  }

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.detail || `Request failed: ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  // For file downloads, return the response directly
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/csv") || ct.includes("application/json") && options.download) {
    return res;
  }

  return res.json();
}

// ── API methods ────────────────────────────────────────────────────

export const api = {
  savePost(url, manualText = null) {
    return apiFetch("/save", {
      method: "POST",
      body: JSON.stringify({ url, manual_text: manualText }),
    });
  },

  getPosts(filters = {}) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== null && v !== undefined && v !== "") params.set(k, v);
    }
    const qs = params.toString();
    return apiFetch(`/posts${qs ? `?${qs}` : ""}`);
  },

  getPost(id) {
    return apiFetch(`/posts/${id}`);
  },

  deletePost(id) {
    return apiFetch(`/posts/${id}`, { method: "DELETE" });
  },

  ask(question) {
    return apiFetch("/ask", {
      method: "POST",
      body: JSON.stringify({ question }),
    });
  },

  getCategories() {
    return apiFetch("/categories");
  },

  getAnalytics() {
    return apiFetch("/analytics/overview");
  },

  exportPosts(category = null, format = "json") {
    const params = new URLSearchParams({ format });
    if (category) params.set("category", category);
    return apiFetch(`/export?${params}`, { download: true });
  },
};
