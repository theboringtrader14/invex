import { Outlet, NavLink, useNavigate } from "react-router-dom"
import { useState } from "react"

const nav = [
  { path: "/portfolio",  label: "Portfolio",     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> },
  { path: "/sips",       label: "SIP Engine",    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
  { path: "/ipo-bots",   label: "IPO Bots",      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="3" x2="5" y2="6"/><rect x="3" y="6" width="4" height="7" rx="0.5"/><line x1="5" y1="13" x2="5" y2="17"/><line x1="12" y1="5" x2="12" y2="9"/><rect x="10" y="9" width="4" height="6" rx="0.5" fill="currentColor" fillOpacity="0.3"/><line x1="12" y1="15" x2="12" y2="20"/><line x1="19" y1="4" x2="19" y2="7"/><rect x="17" y="7" width="4" height="8" rx="0.5"/><line x1="19" y1="15" x2="19" y2="19"/></svg> },
  { path: "/watchlist",  label: "Watchlist",     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> },
]

export default function Layout() {
  const navigate = useNavigate()
  const [theme, setTheme] = useState(localStorage.getItem("invex_theme") || "dark")
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next); localStorage.setItem("invex_theme", next)
    document.documentElement.setAttribute("data-theme", next)
  }
  const logout = () => { localStorage.removeItem("invex_token"); navigate("/login") }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar */}
      <nav style={{ width: "200px", minWidth: "200px", background: "var(--bg-secondary)",
        borderRight: "1px solid var(--bg-border)", display: "flex", flexDirection: "column" }}>
        {/* Logo */}
        <div style={{ height: "52px", display: "flex", alignItems: "center", padding: "0 16px",
          borderBottom: "1px solid var(--bg-border)", gap: "10px" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "8px",
            background: "linear-gradient(135deg, #00B0F0, #0070A0)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", fontWeight: 700, color: "#000" }}>I</div>
          <div>
            <div style={{ fontFamily: "'ADLaM Display', serif", fontSize: "18px", color: "var(--accent-blue)", lineHeight: 1 }}>INVEX</div>
            <div style={{ fontSize: "9px", color: "var(--text-dim)", letterSpacing: "0.12em" }}>PORTFOLIO</div>
          </div>
        </div>
        {/* Nav */}
        <div style={{ flex: 1, paddingTop: "6px" }}>
          {nav.map(({ path, label, icon }) => (
            <NavLink key={path} to={path} style={({ isActive }) => ({
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 0", textDecoration: "none",
              color: isActive ? "var(--accent-blue)" : "var(--text-muted)",
              background: isActive ? "rgba(0,176,240,0.08)" : "transparent",
              borderLeft: isActive ? "2px solid var(--accent-blue)" : "2px solid transparent",
              fontSize: "13px", fontWeight: isActive ? 600 : 400,
            })}>
              <span style={{ width: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--bg-border)",
          display: "flex", gap: "6px" }}>
          <button className="btn btn-ghost" style={{ flex: 1, fontSize: "11px" }} onClick={toggleTheme}>
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <button className="btn btn-ghost" style={{ flex: 1, fontSize: "11px" }} onClick={logout}>⏏</button>
        </div>
      </nav>
      {/* Main */}
      <main style={{ flex: 1, overflow: "auto", background: "var(--bg-primary)" }}>
        <Outlet />
      </main>
    </div>
  )
}
