import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { supabase, onAuthChange } from "./lib/supabase";
import Home from "./pages/Home";
import Category from "./pages/Category";
import Ask from "./pages/Ask";
import "./index.css";

/**
 * App — Root component with nav, auth, and routing.
 */
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [authMode, setAuthMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  // ── Dev bypass mode ────────────────────────────────────────────
  const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS === "true";

  // ── Listen for auth state changes ─────────────────────────────
  useEffect(() => {
    if (DEV_BYPASS) {
      // Skip auth — create a fake session for development
      setSession({
        access_token: "dev-bypass-token",
        user: { id: "dev-user-id", email: "dev@links.local" },
      });
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const subscription = onAuthChange((session) => {
      setSession(session);
    });

    return () => subscription?.unsubscribe();
  }, []);

  // ── Auth handlers ─────────────────────────────────────────────
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // If Supabase returned a session, we're good (email confirm disabled)
        if (data?.session) {
          setSession(data.session);
          return;
        }

        // If no session (email confirm enabled), try immediate sign-in
        // This works when Supabase has "Confirm email" toggled but
        // autoconfirm is effectively on for the project
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          // If sign-in also fails, show a helpful message
          if (signInError.message.toLowerCase().includes("email not confirmed")) {
            setAuthError(
              "Account created! Please confirm your email in the Supabase dashboard " +
              "(Authentication → Users → select user → Confirm), or disable email " +
              "confirmation (Authentication → Providers → Email → toggle off Confirm email)."
            );
          } else {
            throw signInError;
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // ── Loading state ─────────────────────────────────────────────
  if (session === undefined) {
    return (
      <div className="loading-overlay" style={{ minHeight: "100vh" }}>
        <span className="spinner" /> Loading...
      </div>
    );
  }

  // ── Auth screen ───────────────────────────────────────────────
  if (!session) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>Links</h1>
          <p>
            {authMode === "login"
              ? "Sign in to your account"
              : "Create a new account"}
          </p>

          {authError && <div className="auth-error">{authError}</div>}

          <form className="auth-form" onSubmit={handleAuth}>
            <label>
              Email
              <input
                id="auth-email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                id="auth-password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>
            <button
              id="auth-submit"
              type="submit"
              className="btn btn-primary"
              disabled={authLoading}
              style={{ width: "100%", marginTop: 8 }}
            >
              {authLoading ? (
                <>
                  <span className="spinner" /> Please wait...
                </>
              ) : authMode === "login" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <div className="auth-toggle">
            {authMode === "login" ? (
              <>
                Don't have an account?{" "}
                <button onClick={() => { setAuthMode("signup"); setAuthError(null); }}>
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button onClick={() => { setAuthMode("login"); setAuthError(null); }}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Authenticated app ─────────────────────────────────────────
  return (
    <BrowserRouter>
      <div className="app-layout">
        <div className="app-main">
          {/* Top Navigation */}
          <nav className="top-nav">
            <div className="nav-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="url(#grad)" strokeWidth="2.5" strokeLinecap="round">
                <defs>
                  <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6c5ce7" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
                <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                <path d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
              </svg>
              Links
            </div>

            <div className="nav-links">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                Feed
              </NavLink>
              <NavLink
                to="/categories"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                Categories
              </NavLink>
              <NavLink
                to="/ask"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                Ask
              </NavLink>
            </div>

            <div className="nav-actions">
              <div className="nav-user">
                {session.user.email}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          </nav>

          {/* Pages */}
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/categories" element={<Category />} />
            <Route path="/ask" element={<Ask />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
