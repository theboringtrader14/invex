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

const NOTIF_TYPES: Record<string, string> = {
  success: "var(--green)", error: "var(--red)", warn: "var(--amber)", info: "var(--accent-blue)"
}

function InvexLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="rgba(0,176,240,0.12)"/>
      <path d="M7 22 L11 16 L16 20 L20 12 L25 9" stroke="#00B0F0" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="25" cy="9" r="2.5" fill="#22C55E"/>
    </svg>
  )
}

const nav = [
  { path: "/portfolio", label: "Portfolio",   Icon: IconPortfolio },
  { path: "/sips",      label: "SIP Engine",  Icon: IconSIP },
  { path: "/ipo-bots",  label: "IPO Bots",    Icon: IconIPO },
  { path: "/watchlist", label: "Watchlist",   Icon: IconWatchlist },
]

const ACCOUNTS = ["All", "Karthik", "Mom", "Wife"]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("invex_sidebar") === "true")
  const [theme, setTheme]         = useState(localStorage.getItem("invex_theme") || "dark")
  const [activeAccount, setActiveAccount] = useState("All")
  const [istTime, setIstTime]     = useState("")
  const [portfolioValue, setPortfolioValue] = useState<number | null>(null)
  const [notifications, setNotifications]   = useState<any[]>([])
  const [showNotif, setShowNotif] = useState(false)
  const [unread, setUnread]       = useState(0)

  // IST clock
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setIstTime(now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }))
    }
    tick(); const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Portfolio value polling
  useEffect(() => {
    const token = localStorage.getItem("invex_token")
    if (!token) return
    const fetchValue = () => {
      fetch("http://localhost:8001/api/v1/portfolio/summary", {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json()).then(d => {
        if (d.total_portfolio_value != null) setPortfolioValue(d.total_portfolio_value)
      }).catch(() => {})
    }
    fetchValue(); const id = setInterval(fetchValue, 30000)
    return () => clearInterval(id)
  }, [])

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

  const W = collapsed ? "56px" : "216px"

  const addNotification = (n: any) => {
    setNotifications(prev => [{ ...n, id: Date.now(), time: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) }, ...prev.slice(0, 49)])
    setUnread(u => u + 1)
  }

  // Expose addNotification globally for INVEX engines
  ;(window as any).__invex_notify = addNotification

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar */}
      <nav style={{ width: W, minWidth: W, background: "var(--bg-secondary)",
        borderRight: "1px solid var(--bg-border)", display: "flex", flexDirection: "column",
        transition: "width 0.18s ease, min-width 0.18s ease", overflow: "hidden",
        fontSize: "13px" }}>

        {/* Logo — click to collapse */}
        <div onClick={toggleSidebar} style={{ height: "52px", display: "flex", alignItems: "center",
          padding: collapsed ? "0" : "0 14px", justifyContent: collapsed ? "center" : "space-between",
          borderBottom: "1px solid var(--bg-border)", cursor: "pointer", userSelect: "none", flexShrink: 0 }}>
          {collapsed
            ? <InvexLogo size={28} />
            : <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <InvexLogo size={28} />
                <div>
                  <div style={{ fontFamily: "'ADLaM Display', serif", fontSize: "20px",
                    color: "var(--accent-blue)", lineHeight: 1 }}>INVEX</div>
                  <div style={{ fontSize: "9px", color: "var(--text-muted)", letterSpacing: "0.14em", marginTop: "1px" }}>PORTFOLIO</div>
                </div>
              </div>
          }
        </div>

        {/* Nav links */}
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
                transition: "all 0.12s",
              })}>
              <span style={{ width: "44px", display: "flex", alignItems: "center",
                justifyContent: "center", flexShrink: 0 }}>
                <Icon />
              </span>
              <span style={{ maxWidth: collapsed ? 0 : "160px", opacity: collapsed ? 0 : 1,
                overflow: "hidden", whiteSpace: "nowrap", paddingRight: collapsed ? 0 : "16px",
                transition: "opacity 0.15s ease, max-width 0.18s ease" }}>
                {label}
              </span>
            </NavLink>
          ))}
        </div>

        {/* Version footer */}
        <div style={{ padding: collapsed ? "10px 0" : "10px 20px",
          borderTop: "1px solid var(--bg-border)",
          display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start" }}>
          <div style={{ fontSize: "10px", color: "var(--text-dim)", opacity: collapsed ? 0 : 1,
            transition: "opacity 0.12s", whiteSpace: "nowrap" }}>v1.0 · Phase 1</div>
        </div>
      </nav>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* TopBar — matches STAAX */}
        <header style={{ height: "52px", background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--bg-border)",
          display: "flex", alignItems: "center", padding: "0 20px",
          gap: "8px", flexShrink: 0 }}>

          {/* Left — welcome + IST */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, paddingLeft: "4px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Welcome, <strong style={{ color: "var(--text)", fontWeight: 600 }}>Karthikeyan</strong>
            </span>
            <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>|</span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}>
              IST {istTime}
            </span>
            {portfolioValue != null && (
              <>
                <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>|</span>
                <span style={{ fontSize: "12px", fontWeight: 700,
                  color: portfolioValue >= 0 ? "var(--green)" : "var(--red)",
                  fontFamily: "'DM Mono', monospace" }}>
                  ₹{portfolioValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              </>
            )}
          </div>

          {/* Account dropdown — only on portfolio pages, matches STAAX style */}
          {["/portfolio"].some(p => location.pathname.startsWith(p)) && (
            <div style={{ position: "relative", display: "flex", alignItems: "center",
              background: "var(--bg-surface)", border: "1px solid var(--bg-border)",
              borderRadius: "5px", height: "32px", padding: "0 10px", gap: "6px" }}>
              <select value={activeAccount}
                onChange={e => setActiveAccount(e.target.value)}
                style={{ background: "transparent", border: "none", color: "var(--text)",
                  fontSize: "12px", fontWeight: 500, cursor: "pointer",
                  outline: "none", appearance: "none", paddingRight: "16px",
                  fontFamily: "inherit" }}>
                {ACCOUNTS.map(a => <option key={a} value={a}>{a === "All" ? "All Accounts" : a}</option>)}
              </select>
              <span style={{ color: "var(--text-dim)", fontSize: "10px", pointerEvents: "none" }}>▾</span>
            </div>
          )}

          {/* Bell */}
          <button onClick={() => { setShowNotif(!showNotif); if (!showNotif) setUnread(0) }}
            style={{ height: "32px", width: "32px", borderRadius: "5px",
              border: `1px solid ${showNotif ? "var(--accent-blue)" : "var(--bg-border)"}`,
              background: showNotif ? "var(--accent-blue-dim)" : "var(--bg-surface)",
              cursor: "pointer", color: "var(--text-muted)", fontSize: "15px",
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative" }}>
            🔔
            {unread > 0 && (
              <span style={{ position: "absolute", top: "5px", right: "5px",
                width: "7px", height: "7px", borderRadius: "50%",
                background: "var(--red)" }} />
            )}
          </button>

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
              fontWeight: 600, letterSpacing: "0.04em",
              transition: "all 0.12s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--text-dim)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--bg-border)" }}>
            Logout
          </button>
        </header>

        {/* Notification panel */}
        {showNotif && (
          <div style={{ position: "fixed", top: "52px", right: 0, width: "340px",
            height: "calc(100vh - 52px)", background: "var(--bg-elevated)",
            borderLeft: "1px solid var(--bg-border)", zIndex: 900,
            overflow: "auto", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--bg-border)",
              display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: "13px" }}>Notifications</span>
              <button onClick={() => setShowNotif(false)}
                style={{ background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-muted)", fontSize: "16px" }}>×</button>
            </div>
            <div style={{ padding: "8px 0" }}>
              {notifications.length === 0
                ? <div style={{ padding: "24px 16px", color: "var(--text-dim)",
                    fontSize: "12px", textAlign: "center" }}>No notifications yet</div>
                : notifications.map(n => (
                  <div key={n.id} style={{ padding: "10px 16px",
                    borderBottom: "1px solid rgba(63,65,67,0.4)",
                    borderLeft: `3px solid ${NOTIF_TYPES[n.type] || "var(--accent-blue)"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between",
                      marginBottom: "3px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700,
                        color: NOTIF_TYPES[n.type], textTransform: "uppercase" }}>
                        {n.type}
                      </span>
                      <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>{n.time}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text)" }}>{n.message}</div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* Page content */}
        <main style={{ flex: 1, overflow: "auto", background: "var(--bg-primary)" }}>
          <Outlet context={{ activeAccount, addNotification }} />
        </main>
      </div>
    </div>
  )
}
