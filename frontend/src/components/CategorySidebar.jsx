/**
 * CategorySidebar — Vertical nav listing all categories with counts.
 */
export default function CategorySidebar({ categories, selected, onSelect }) {
  return (
    <div className="sidebar">
      <div className="sidebar-title">Categories</div>

      {/* "All" option */}
      <div
        className={`sidebar-item ${selected === null ? "active" : ""}`}
        onClick={() => onSelect(null)}
      >
        <span>All Posts</span>
        <span className="sidebar-count">
          {categories.reduce((sum, c) => sum + c.count, 0)}
        </span>
      </div>

      {categories.map((cat) => (
        <div
          key={cat.category}
          className={`sidebar-item ${selected === cat.category ? "active" : ""}`}
          onClick={() => onSelect(cat.category)}
        >
          <span>{cat.category}</span>
          <span className="sidebar-count">{cat.count}</span>
        </div>
      ))}

      {categories.length === 0 && (
        <div className="sidebar-empty">
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "12px" }}>
            No categories yet. Save some links to get started!
          </p>
        </div>
      )}
    </div>
  );
}
