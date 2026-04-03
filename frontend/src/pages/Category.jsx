import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar,
  PieChart, Pie, Cell,
  ResponsiveContainer,
  XAxis, YAxis, Tooltip, Legend,
  LineChart, Line,
} from "recharts";
import { api } from "../lib/api";
import PostCard from "../components/PostCard";
import CategorySidebar from "../components/CategorySidebar";

const COLORS = [
  "#6c5ce7", "#a78bfa", "#00cec9", "#fdcb6e", "#e17055",
  "#0984e3", "#00b894", "#d63031", "#e84393", "#636e72",
];

/**
 * Category — Category explorer with analytics and filtered feed.
 */
export default function Category() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [posts, setPosts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);

  // ── Fetch categories ──────────────────────────────────────────
  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
    api.getAnalytics().then(setAnalytics).catch(console.error);
  }, []);

  // ── Fetch posts for selected category ─────────────────────────
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getPosts({
        category: selectedCategory || undefined,
        limit: 100,
      });
      setPosts(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchPosts();
  }, [selectedCategory]);

  // ── Delete ────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await api.deletePost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  // ── Export ────────────────────────────────────────────────────
  const handleExport = async (format) => {
    try {
      const res = await api.exportPosts(selectedCategory, format);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `links_export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Prepare chart data ────────────────────────────────────────
  const platformData = analytics
    ? Object.entries(analytics.by_platform).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  const sentimentData = analytics
    ? Object.entries(analytics.by_sentiment).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  const categoryData = categories.map((c) => ({
    name: c.category,
    count: c.count,
  }));

  const weeklyData = analytics?.posts_per_week || [];

  return (
    <div className="page-container" style={{ maxWidth: 1200 }}>
      <div className="category-layout">
        {/* Sidebar */}
        <CategorySidebar
          categories={categories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />

        {/* Main content */}
        <div>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h1 className="page-title" style={{ marginBottom: 0 }}>
              {selectedCategory || "All Categories"}
            </h1>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowAnalytics((s) => !s)}
              >
                {showAnalytics ? "Hide Charts" : "Show Charts"}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleExport("csv")}
              >
                📥 CSV
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleExport("json")}
              >
                📥 JSON
              </button>
            </div>
          </div>

          {/* Analytics Charts */}
          {showAnalytics && analytics && (
            <div className="charts-grid">
              {/* Posts per Category */}
              {categoryData.length > 0 && (
                <div className="chart-card">
                  <div className="chart-title">Posts by Category</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={categoryData}>
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#9898b0", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#9898b0", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#1a1a2e",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {categoryData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Platform Breakdown */}
              {platformData.length > 0 && (
                <div className="chart-card">
                  <div className="chart-title">Platform Breakdown</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={platformData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {platformData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#1a1a2e",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11, color: "#9898b0" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Sentiment Distribution */}
              {sentimentData.length > 0 && (
                <div className="chart-card">
                  <div className="chart-title">Sentiment Distribution</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={sentimentData} layout="vertical">
                      <XAxis
                        type="number"
                        tick={{ fill: "#9898b0", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: "#9898b0", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={70}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#1a1a2e",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {sentimentData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={
                              entry.name === "positive"
                                ? "#22c55e"
                                : entry.name === "negative"
                                ? "#ef4444"
                                : "#eab308"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Posts Over Time */}
              {weeklyData.length > 0 && (
                <div className="chart-card">
                  <div className="chart-title">Posts Over Time</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={weeklyData}>
                      <XAxis
                        dataKey="week"
                        tick={{ fill: "#9898b0", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#9898b0", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#1a1a2e",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#6c5ce7"
                        strokeWidth={2}
                        dot={{ fill: "#a78bfa", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Top Tags */}
              {analytics?.top_tags?.length > 0 && (
                <div className="chart-card">
                  <div className="chart-title">Top Tags</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {analytics.top_tags.slice(0, 15).map((t) => (
                      <span
                        key={t.tag}
                        className="tag-pill"
                        style={{
                          fontSize: `${Math.min(0.9, 0.6 + t.count * 0.03)}rem`,
                          padding: "4px 10px",
                        }}
                      >
                        {t.tag}{" "}
                        <span style={{ opacity: 0.5, marginLeft: 4 }}>
                          {t.count}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Total Stats */}
              <div className="chart-card">
                <div className="chart-title">Overview</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>Total Posts</span>
                    <span style={{ fontWeight: 700, fontSize: "1.2rem" }}>
                      {analytics.total_posts}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>Categories</span>
                    <span style={{ fontWeight: 700, fontSize: "1.2rem" }}>
                      {categories.length}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>Platforms</span>
                    <span style={{ fontWeight: 700, fontSize: "1.2rem" }}>
                      {Object.keys(analytics.by_platform).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filtered Feed */}
          <div className="feed">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onDelete={handleDelete} />
            ))}

            {loading && (
              <div className="loading-overlay">
                <span className="spinner" /> Loading...
              </div>
            )}

            {!loading && posts.length === 0 && (
              <div className="empty-state">
                <h3>No posts in this category</h3>
                <p>Save some links to see them here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
