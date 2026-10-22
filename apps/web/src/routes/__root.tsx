import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { Pause, Play } from "lucide-react";
import { useState } from "react";

import { CloudShader } from "../components/ui/cloud-shader";
import { NotFoundPage } from "../features/not-found/not-found";

function AppLayout() {
  const [paused, setPaused] = useState(false);
  return (
    <div className="site-shell">
      <CloudShader className="cloud-background" speed={paused ? 0 : 0.35} count={6} />
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <nav aria-label="Main navigation">
          <Link to="/" className="site-title">
            Ardiente feedback
          </Link>
          <div className="header-actions">
            <button
              type="button"
              className="background-toggle"
              onClick={() => setPaused(!paused)}
              aria-label={paused ? "Play cloud animation" : "Pause cloud animation"}
              title={paused ? "Play clouds" : "Pause clouds"}
            >
              {paused ? <Play size={17} /> : <Pause size={17} />}
            </button>
            <Link to="/admin" className="admin-link">
              EXCO access
            </Link>
          </div>
        </nav>
      </header>
      <main id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
export const Route = createRootRoute({
  component: AppLayout,
  errorComponent: () => (
    <div className="status-card">
      <h1>Something went wrong.</h1>
      <p>Please reload and try again.</p>
      <button className="primary-button" onClick={() => window.location.reload()}>
        Try again
      </button>
    </div>
  ),
  notFoundComponent: NotFoundPage,
});
