import { NavLink, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { SignOut } from '@phosphor-icons/react'

const NAV_LINKS = [
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/sips',      label: 'SIPs'      },
  { to: '/ipo-bots',  label: 'IPO'       },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/analysis',  label: 'Analysis'  },
]

const iconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: '50%',
  background: 'var(--bg)',
  boxShadow: 'var(--neu-raised-sm)',
  border: 'none',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'color 0.18s ease',
}

export default function Layout() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const logout = () => { localStorage.removeItem('invex_token'); window.location.href = '/login' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Sticky pill topnav — matches STAAX exactly ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 320, padding: '20px 20px 0' }}>
        <header style={{
          maxWidth: 1200,
          margin: '0 auto',
          borderRadius: 100,
          background: 'var(--bg)',
          boxShadow: 'var(--neu-raised)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
        }}>

          {/* LEFT — Wordmark */}
          <div style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif", fontSize: 20, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '-0.03em' }}>
              <span style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                LIFEX OS
              </span>
              <span style={{ color: 'var(--text-dim)', WebkitTextFillColor: 'var(--text-dim)' }}>{' · '}</span>
              <span style={{ color: 'var(--accent)', WebkitTextFillColor: 'var(--accent)' }}>INVEX</span>
            </span>
          </div>

          {/* CENTER — Nav tabs */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 32, height: '100%' }}>
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  height: '100%',
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: "'DM Sans', 'Space Grotesk', sans-serif",
                  color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.18s ease',
                })}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* RIGHT — IST clock + Exit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)', letterSpacing: '0.04em' }}>
              {time}
            </span>
            <button
              onClick={logout}
              title="Exit"
              style={iconBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.color = '#FF4444' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)' }}
            >
              <SignOut size={16} weight="regular" />
            </button>
          </div>

        </header>
      </div>

      {/* Page content — matches STAAX Layout padding */}
      <main style={{ flex: 1, padding: '16px 24px 20px 24px', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>

    </div>
  )
}
