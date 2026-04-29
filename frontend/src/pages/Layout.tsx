import { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { SignOut, Sun, Moon, User } from '@phosphor-icons/react'
import InvexAccountsDrawer from '../components/InvexAccountsDrawer'
import { useAuth } from '../contexts/AuthContext'

const NAV_LINKS = [
  { to: '/portfolio', label: 'Portfolio', lime: false },
  { to: '/analysis',  label: 'Analysis',  lime: false },
  { to: '/invex-v2',  label: 'Matrix',    lime: true  },
  { to: '/watchlist', label: 'Watchlist', lime: false },
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
  transition: 'color 0.18s ease'
}

export default function Layout() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('invex_theme') as 'light' | 'dark') || 'light'
  )
  const [showAccounts, setShowAccounts] = useState(false)
  const { logout: authLogout } = useAuth()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    localStorage.setItem('invex_theme', next)
    setTheme(next)
  }

  const logout = () => { authLogout(); window.location.href = '/login' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Sticky pill topnav — matches STAAX exactly ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 320, padding: '20px 20px 12px', background: 'var(--bg)' }}>
        <header style={{
          maxWidth: 1200,
          margin: '0 auto',
          borderRadius: 100,
          background: 'var(--bg)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px'
        }}>

          {/* LEFT — Wordmark */}
          <div style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 20, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '-0.03em' }}>
              <span style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                LIFEX OS
              </span>
              <span style={{ color: 'var(--text-dim)', WebkitTextFillColor: 'var(--text-dim)' }}>{' · '}</span>
              <span style={{ color: 'var(--accent)', WebkitTextFillColor: 'var(--accent)' }}>INVEX</span>
            </span>
          </div>

          {/* CENTER — Nav tabs */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {NAV_LINKS.map(({ to, label, lime }) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  textDecoration: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase' as const,
                  whiteSpace: 'nowrap',
                  padding: '5px 14px',
                  borderRadius: 20,
                  transition: 'all 0.18s ease',
                  color: lime ? '#C9F53B' : isActive ? 'var(--text)' : 'var(--text-dim)',
                  background: isActive ? 'var(--bg)' : 'transparent',
                  boxShadow: isActive
                    ? lime
                      ? '2px 2px 6px rgba(0,0,0,0.7), -1px -1px 3px rgba(255,255,255,0.04), 0 0 8px rgba(201,245,59,0.12)'
                      : '2px 2px 6px rgba(0,0,0,0.7), -1px -1px 3px rgba(255,255,255,0.04)'
                    : 'none',
                  border: isActive
                    ? lime ? '1px solid rgba(201,245,59,0.20)' : '1px solid rgba(255,255,255,0.06)'
                    : '1px solid transparent',
                })}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* RIGHT — Theme + Accounts + Exit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              style={iconBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)' }}
            >
              {theme === 'dark' ? <Sun size={16} weight="regular" /> : <Moon size={16} weight="regular" />}
            </button>
            <button
              onClick={() => setShowAccounts(v => !v)}
              onMouseDown={e => e.stopPropagation()}
              title="Broker Accounts"
              style={{
                ...iconBtnStyle,
                color: showAccounts ? 'var(--accent)' : 'var(--text-dim)',
                boxShadow: showAccounts ? 'var(--neu-inset)' : 'var(--neu-raised-sm)',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.color = showAccounts ? 'var(--accent)' : 'var(--text-dim)' }}
            >
              <User size={16} weight="regular" />
            </button>
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

      {/* Page content — scrollable, header inside each page is sticky */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '0 54px 24px 54px', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>

      {showAccounts && <InvexAccountsDrawer onClose={() => setShowAccounts(false)} />}
    </div>
  )
}
