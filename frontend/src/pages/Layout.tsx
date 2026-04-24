import { NavLink, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'

const NAV_LINKS = [
  { to: '/',          label: 'Portfolio' },
  { to: '/sips',      label: 'SIPs' },
  { to: '/ipo-bots',  label: 'IPO Bot' },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/analysis',  label: 'Analysis' },
]

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
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Top Nav */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        padding: '10px 20px',
        background: 'var(--bg)',
      }}>
        <div style={{
          background: 'var(--bg-surface)',
          boxShadow: 'var(--neu-raised)',
          borderRadius: 16,
          padding: '0 20px',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}>
          {/* Logo */}
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--text-dim)', whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '0.02em' }}>
            LIFEX · <strong style={{ color: 'var(--accent)' }}>INVEX</strong>
          </span>

          <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />

          {/* Nav links */}
          <nav style={{ display: 'flex', gap: 3, flex: 1 }}>
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                style={({ isActive }) => ({
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  textDecoration: 'none',
                  letterSpacing: '0.02em',
                  color: isActive ? 'var(--accent)' : 'var(--text-mute)',
                  background: 'var(--bg)',
                  boxShadow: isActive ? 'var(--neu-inset)' : 'var(--neu-raised-sm)',
                  transition: 'all 0.15s',
                })}
              >{label}</NavLink>
            ))}
          </nav>

          {/* Right: IST clock + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.04em' }}>
              IST {time}
            </span>
            <button onClick={logout} style={{
              height: 28, padding: '0 12px', borderRadius: 8,
              border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)',
              color: 'var(--text-mute)',
            }}>Exit</button>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div style={{ padding: '0 20px 32px' }}>
        <Outlet />
      </div>
    </div>
  )
}
