import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom"
import { useState, useEffect } from "react"

const iconSize = 18

const IconPortfolio = () => (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
  </svg>
)
const IconSIP = () => (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
  </svg>
)
const IconIPO = () => (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="3" x2="5" y2="6"/><rect x="3" y="6" width="4" height="7" rx="0.5"/>
    <line x1="5" y1="13" x2="5" y2="17"/><line x1="12" y1="5" x2="12" y2="9"/>
    <rect x="10" y="9" width="4" height="6" rx="0.5" fill="currentColor" fillOpacity="0.3"/>
    <line x1="12" y1="15" x2="12" y2="20"/><line x1="19" y1="4" x2="19" y2="7"/>
    <rect x="17" y="7" width="4" height="8" rx="0.5"/><line x1="19" y1="15" x2="19" y2="19"/>
  </svg>
)
const IconWatchlist = () => (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)

const nav = [
  { path: "/portfolio", label: "Portfolio",   Icon: IconPortfolio },
  { path: "/sips",      label: "SIP Engine",  Icon: IconSIP },
  { path: "/ipo-bots",  label: "IPO Bots",    Icon: IconIPO },
  { path: "/watchlist", label: "Watchlist",   Icon: IconWatchlist },
]

const ACCOUNTS = ["All", "Karthik", "Mom", "Wife"]

function InvexLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="rgba(0,176,240,0.12)"/>
      <path d="M7 22 L11 16 L16 20 L20 12 L25 9" stroke="#00B0F0" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="25" cy="9" r="2.5" fill="#22C55E"/>
    </svg>
  )
}

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("invex_sidebar") === "true")
  const [theme, setTheme] = useState(localStorage.getItem("invex_theme") || "dark")
  const [activeAccount, setActiveAccount] = useState("All")

  const portfolioPages = ["/portfolio"]
  const showAccountChips = portfolioPages.some(p => location.pathname.startsWith(p))

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next); localStorage.setItem("invex_theme", next)
    document.documentElement.setAttribute("data-theme", next)
  }
  const toggleSidebar = () => {
    const next = !collapsed
    setCollapsed(next); localStorage.setItem("invex_sidebar", String(next))
  }
  const logout = () => { localStorage.removeItem("invex_token"); navigate("/login") }

  const W = collapsed ? "56px" : "200px"

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar */}
      <nav style={{ width: W, minWidth: W, background: "var(--bg-secondary)",
        borderRight: "1px solid var(--bg-border)", display: "flex", flexDirection: "column",
        transition: "width 0.18s ease, min-width 0.18s ease", overflow: "hidden" }}>
        {/* Logo row — click to collapse */}
        <div onClick={toggleSidebar} style={{ height: "52px", display: "flex", alignItems: "center",
          padding: collapsed ? "0" : "0 14px", justifyContent: collapsed ? "center" : "space-between",
          borderBottom: "1px solid var(--bg-border)", cursor: "pointer", userSelect: "none", flexShrink: 0 }}>
          {collapsed
            ? <InvexLogo size={26} />
            : <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <InvexLogo size={26} />
                <div>
                  <div style={{ fontFamily: "'ADLaM Display', serif", fontSize: "18px",
                    color: "var(--accent-blue)", lineHeight: 1 }}>INVEX</div>
                  <div style={{ fontSize: "9px", color: "var(--text-muted)", letterSpacing: "0.12em" }}>PORTFOLIO</div>
                </div>
              </div>
          }
        </div>

        {/* Nav */}
        <div style={{ flex: 1, paddingTop: "6px" }}>
          {nav.map(({ path, label, Icon }) => (
            <NavLink key={path} to={path} title={collapsed ? label : undefined}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                padding: "10px 0", textDecoration: "none",
                color: isActive ? "var(--accent-blue)" : "var(--text)",
                background: isActive ? "rgba(0,176,240,0.08)" : "transparent",
                borderLeft: isActive && !collapsed ? "2px solid var(--accent-blue)" : "2px solid transparent",
                fontSize: "13px", fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap",
              })}>
              <span style={{ width: "44px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon />
              </span>
              <span style={{ maxWidth: collapsed ? 0 : "160px", opacity: collapsed ? 0 : 1,
                overflow: "hidden", whiteSpace: "nowrap",
                transition: "opacity 0.15s ease, max-width 0.18s ease" }}>
                {label}
              </span>
            </NavLink>
          ))}
        </div>

        {/* Version */}
        <div style={{ padding: collapsed ? "10px 0" : "10px 16px", borderTop: "1px solid var(--bg-border)",
          display: "flex", justifyContent: collapsed ? "center" : "flex-start" }}>
          <div style={{ fontSize: "10px", color: "var(--text-dim)", opacity: collapsed ? 0 : 1,
            transition: "opacity 0.12s", whiteSpace: "nowrap" }}>v1.0 · Phase 1</div>
        </div>
      </nav>

      {/* Right side */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* TopBar */}
        <header style={{ height: "52px", background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--bg-border)", display: "flex", alignItems: "center",
          padding: "0 20px", gap: "12px", flexShrink: 0 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Welcome, <strong style={{ color: "var(--text)" }}>Karthikeyan</strong>
            </span>
          </div>

          {/* Account chips — only on portfolio page */}
          {showAccountChips && (
            <div style={{ display: "flex", gap: "5px" }}>
              {ACCOUNTS.map(a => (
                <button key={a} onClick={() => setActiveAccount(a)}
                  style={{ padding: "3px 12px", borderRadius: "20px", border: "none", cursor: "pointer",
                    fontSize: "11px", fontWeight: 600,
                    background: activeAccount === a ? "var(--accent-blue)" : "var(--bg-surface)",
                    color: activeAccount === a ? "#000" : "var(--text-muted)",
                    transition: "all 0.12s" }}>
                  {a}
                </button>
              ))}
            </div>
          )}

          {/* Theme toggle */}
          <button onClick={toggleTheme}
            style={{ height: "32px", width: "32px", borderRadius: "5px",
              border: "1px solid var(--bg-border)", background: "var(--bg-surface)",
              cursor: "pointer", fontSize: "15px", display: "flex",
              alignItems: "center", justifyContent: "center" }}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {/* Logout */}
          <button onClick={logout}
            style={{ height: "32px", padding: "0 14px", borderRadius: "5px",
              border: "1px solid var(--bg-border)", background: "transparent",
              cursor: "pointer", color: "var(--text-muted)", fontSize: "11px",
              fontWeight: 600, letterSpacing: "0.04em" }}>
            Logout
          </button>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: "auto", background: "var(--bg-primary)" }}>
          <Outlet context={{ activeAccount }} />
        </main>
      </div>
    </div>
  )
}
