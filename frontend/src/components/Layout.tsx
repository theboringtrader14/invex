import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom"
import { useState, useEffect } from "react"

const SZ = 18

const IconPortfolio = () => (
  <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>
  </svg>
)
const IconSIP = () => (
  <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>
  </svg>
)
const IconIPO = () => (
  <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
)
const IconWatchlist = () => (
  <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)
const IconAnalysis = () => (
  <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)
const IconLogout = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

const NAV = [
  { path: "/portfolio", label: "Portfolio",  Icon: IconPortfolio },
  { path: "/sips",      label: "SIP Engine", Icon: IconSIP },
  { path: "/ipo-bots",  label: "IPO Bot",    Icon: IconIPO },
  { path: "/watchlist", label: "Watchlist",  Icon: IconWatchlist },
  { path: "/analysis",  label: "Analysis",   Icon: IconAnalysis },
]

type Notification = { id: number; type: string; message: string; time: string }

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [istTime, setIstTime] = useState("")
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotif, setShowNotif] = useState(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const tick = () =>
      setIstTime(new Date().toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
      }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const logout = () => { localStorage.removeItem("staax_token"); navigate("/login") }

  const addNotification = (n: Omit<Notification, "id" | "time">) => {
    const entry: Notification = {
      ...n, id: Date.now(),
      time: new Date().toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit",
      }),
    }
    setNotifications(prev => [entry, ...prev.slice(0, 49)])
    setUnread(u => u + 1)
  }
  ;(window as any).__invex_notify = addNotification

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-void)", overflow: "hidden", position: "relative" }}>
      {/* Ambient background orbs */}
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      {/* ── SIDEBAR ── */}
      <nav style={{
        width: "56px", minWidth: "56px", flexShrink: 0,
        background: "rgba(10,10,11,0.92)",
        borderRight: "0.5px solid rgba(0,201,167,0.10)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "10px 0 14px", gap: "4px",
        position: "relative", zIndex: 100,
      }}>
        {/* IX Logo mark */}
        <div style={{
          width: "34px", height: "34px",
          background: "linear-gradient(135deg, #00C9A7, #007A67)",
          borderRadius: "10px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 800, color: "#fff",
          boxShadow: "0 0 16px rgba(0,201,167,0.30)",
          marginBottom: "14px", letterSpacing: "-0.5px",
        }}>IX</div>

        {/* Nav items */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1 }}>
          {NAV.map(({ path, label, Icon }) => {
            const isActive = location.pathname.startsWith(path)
            return (
              <NavLink key={path} to={path} title={label} style={{
                position: "relative",
                width: "40px", height: "40px",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "10px", textDecoration: "none",
                color: isActive ? "var(--ix-vivid)" : "var(--gs-light)",
                background: isActive ? "rgba(0,201,167,0.15)" : "transparent",
                boxShadow: isActive
                  ? "0 0 12px rgba(0,201,167,0.18), inset 0 0 0 0.5px rgba(0,201,167,0.4)"
                  : "none",
                transition: "all 0.2s",
              }}>
                {isActive && (
                  <span style={{
                    position: "absolute", left: "-8px", top: "25%", bottom: "25%",
                    width: "2px",
                    background: "var(--ix-vivid)",
                    borderRadius: "0 2px 2px 0",
                    boxShadow: "0 0 8px rgba(0,201,167,0.7)",
                  }} />
                )}
                <Icon />
              </NavLink>
            )
          })}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Logout"
          onMouseEnter={e => {
            const b = e.currentTarget
            b.style.color = "#FF4444"
            b.style.background = "rgba(255,68,68,0.08)"
          }}
          onMouseLeave={e => {
            const b = e.currentTarget
            b.style.color = "var(--gs-light)"
            b.style.background = "transparent"
          }}
          style={{
            width: "40px", height: "40px", borderRadius: "10px",
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--gs-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}>
          <IconLogout />
        </button>
      </nav>

      {/* ── RIGHT PANEL ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 1 }}>

        {/* ── TOPBAR ── */}
        <header style={{
          height: "46px", flexShrink: 0,
          background: "rgba(10,10,11,0.88)",
          borderBottom: "0.5px solid rgba(0,201,167,0.10)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
        }}>
          {/* Left — avatar · welcome · IST */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "26px", height: "26px", borderRadius: "7px",
              background: "linear-gradient(135deg, #00C9A7, #007A67)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "9px", fontWeight: 800, color: "#fff", letterSpacing: "0.3px",
            }}>KJ</div>
            <span style={{ fontSize: "13px", color: "var(--gs-muted)" }}>
              Welcome, <strong style={{ color: "var(--ix-glow)", fontWeight: 600 }}>Karthikeyan</strong>
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--ix-ultra)", opacity: 0.75 }}>
              IST {istTime}
            </span>
          </div>

          {/* Right — INVEX BETA pill · bell */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* INVEX BETA pill */}
            <div style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "4px 12px", borderRadius: "var(--r-pill)",
              background: "rgba(0,201,167,0.12)",
              border: "0.5px solid var(--ix-border)",
              fontSize: "11px", fontWeight: 700,
              color: "var(--ix-vivid)", letterSpacing: "0.5px",
              fontFamily: "var(--font-display)",
            }}>
              <span style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: "var(--ix-vivid)",
                animation: "pulseLive 2s ease-out infinite",
                flexShrink: 0,
              }} />
              INVEX BETA
            </div>

            {/* Notification bell */}
            <button
              onClick={() => { setShowNotif(s => !s); setUnread(0) }}
              style={{
                width: "30px", height: "30px", borderRadius: "var(--r-sm)",
                border: `0.5px solid ${showNotif ? "var(--ix-border)" : "var(--gs-border)"}`,
                background: showNotif ? "var(--ix-ghost)" : "rgba(42,42,46,0.7)",
                cursor: "pointer", color: "var(--gs-muted)", fontSize: "13px",
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", transition: "all 0.15s",
              }}>
              🔔
              {unread > 0 && (
                <span style={{
                  position: "absolute", top: "5px", right: "5px",
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: "var(--sem-short)",
                }} />
              )}
            </button>
          </div>
        </header>

        {/* Notification panel */}
        {showNotif && (
          <div style={{
            position: "absolute", top: "46px", right: 0, width: "300px",
            height: "calc(100% - 46px)",
            background: "rgba(14,14,18,0.97)",
            backdropFilter: "blur(20px)",
            borderLeft: "0.5px solid rgba(0,201,167,0.12)",
            zIndex: 200, overflow: "auto",
          }}>
            <div style={{
              padding: "12px 16px",
              borderBottom: "0.5px solid rgba(0,201,167,0.08)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontWeight: 700, fontSize: "12px", color: "var(--gs-muted)" }}>Notifications</span>
              <button onClick={() => setShowNotif(false)} style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--gs-light)", fontSize: "18px", lineHeight: 1,
              }}>×</button>
            </div>
            {notifications.length === 0
              ? <div style={{ padding: "32px 16px", color: "var(--gs-light)", fontSize: "12px", textAlign: "center" }}>
                  No notifications yet
                </div>
              : notifications.map(n => (
                <div key={n.id} style={{ padding: "10px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: "11px", color: "var(--gs-muted)" }}>{n.message}</div>
                  <div style={{ fontSize: "10px", color: "var(--gs-light)", marginTop: "3px" }}>{n.time}</div>
                </div>
              ))
            }
          </div>
        )}

        {/* Page content */}
        <main style={{ flex: 1, overflow: "hidden", height: 0 }}>
          <Outlet context={{ addNotification }} />
        </main>
      </div>
    </div>
  )
}
