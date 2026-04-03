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

const NAV = [
  { path: "/portfolio", label: "Portfolio",  Icon: IconPortfolio },
  { path: "/sips",      label: "SIP Engine", Icon: IconSIP },
  { path: "/ipo-bots",  label: "IPO Bot",    Icon: IconIPO },
  { path: "/watchlist", label: "Watchlist",  Icon: IconWatchlist },
  { path: "/analysis",  label: "Analysis",   Icon: IconAnalysis },
]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [istTime, setIstTime] = useState("")

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
          {/* Left — Welcome · name · separator · IST */}
          <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
            <span style={{ fontSize: 12, color: "rgba(232,232,248,0.6)" }}>Welcome,&nbsp;</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#F0F0FF", fontFamily: "Syne" }}>Karthikeyan</span>
            <span style={{
              display: "inline-block",
              width: "1px", height: "16px",
              background: "rgba(255,255,255,0.15)",
              margin: "0 12px",
            }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--ix-ultra)", opacity: 0.75 }}>
              IST {istTime}
            </span>
          </div>

          {/* Right — logout button */}
          <button
            onClick={logout}
            title="Logout"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "32px", height: "32px", borderRadius: "9px",
              background: "rgba(255,255,255,0.03)",
              border: "0.5px solid rgba(255,255,255,0.08)",
              cursor: "pointer", color: "rgba(255,255,255,0.4)",
              transition: "all 0.18s ease", flexShrink: 0,
            }}
            onMouseEnter={e => {
              const b = e.currentTarget
              b.style.color = "rgba(255,255,255,0.9)"
              b.style.background = "rgba(255,255,255,0.08)"
              b.style.borderColor = "rgba(255,255,255,0.20)"
            }}
            onMouseLeave={e => {
              const b = e.currentTarget
              b.style.color = "rgba(255,255,255,0.4)"
              b.style.background = "rgba(255,255,255,0.03)"
              b.style.borderColor = "rgba(255,255,255,0.08)"
            }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M6 2H3a1 1 0 00-1 1v9a1 1 0 001 1h3M10 10l3-2.5L10 5M13 7.5H6"
                stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: "hidden", height: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
