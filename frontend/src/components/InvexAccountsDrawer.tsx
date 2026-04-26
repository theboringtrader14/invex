/**
 * InvexAccountsDrawer
 * Design mirrors STAAX AccountsDrawer exactly — same position, sizing, backdrop,
 * neumorphic tokens, and component patterns — with INVEX teal accent.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { PencilSimple, FloppyDisk, CheckCircle, Warning, SignOut, ArrowsClockwise } from '@phosphor-icons/react'
import { apiFetch } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Account {
  id: string
  nickname: string
  broker: string
  client_id: string
  is_active: boolean
  has_jwt: boolean
  last_synced_at: string | null
  holdings_count: number
  sync_error: string | null
}

interface EditCreds {
  id: string; nickname: string; api_key: string; totp_secret: string; password: string
}

type Tab = 'accounts' | 'sync'
const TABS: { id: Tab; label: string }[] = [
  { id: 'accounts', label: 'Accounts' },
  { id: 'sync',     label: 'Sync'     },
]

// ── Shared input / label styles — identical to STAAX ─────────────────────────
const inp: React.CSSProperties = {
  background: 'var(--bg)', boxShadow: 'var(--neu-inset)', border: 'none',
  borderRadius: 8, color: 'var(--text)', fontSize: 12, padding: '0 10px',
  height: 32, width: '100%', fontFamily: 'var(--font-mono)', outline: 'none',
  boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--text-mute)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const brokerLabel = (b: string) =>
  b === 'angelone' ? 'Angel One' : b === 'zerodha' ? 'Zerodha' : b

const relativeTime = (iso: string | null): string => {
  if (!iso) return 'never'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

// ── Main component ────────────────────────────────────────────────────────────
export default function InvexAccountsDrawer({ onClose }: { onClose: () => void }) {
  const [tab,         setTab]         = useState<Tab>('accounts')
  const [accounts,    setAccounts]    = useState<Account[]>([])
  const [loading,     setLoading]     = useState(true)
  const [nickEditing, setNickEditing] = useState<Record<string, boolean>>({})
  const [editNick,    setEditNick]    = useState<Record<string, string>>({})
  const [editingCreds, setEditingCreds] = useState<EditCreds | null>(null)
  const [saved,       setSaved]       = useState<Record<string, string>>({})
  const [refreshing,  setRefreshing]  = useState<Record<string, boolean>>({})
  const [refreshMsg,  setRefreshMsg]  = useState<Record<string, { text: string; ok: boolean }>>({})
  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/accounts/')
      if (res.ok) setAccounts(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Click outside → close (skip when sub-modal open)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (editingCreds) return
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose, editingCreds])

  // Escape → close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const showSaved = (id: string, msg: string) => {
    setSaved(s => ({ ...s, [id]: msg }))
    setTimeout(() => setSaved(s => { const n = { ...s }; delete n[id]; return n }), 3000)
  }

  const saveNickname = async (acc: Account) => {
    const newName = (editNick[acc.id] ?? acc.nickname).trim()
    setNickEditing(n => ({ ...n, [acc.id]: false }))
    if (!newName || newName === acc.nickname) return
    try {
      await apiFetch(`/api/v1/accounts/${acc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ nickname: newName }),
      })
      setAccounts(a => a.map(x => x.id === acc.id ? { ...x, nickname: newName } : x))
      showSaved(acc.id, 'ok:Saved')
    } catch { showSaved(acc.id, 'err:Failed') }
  }

  const refreshToken = async (acc: Account) => {
    setRefreshing(r => ({ ...r, [acc.id]: true }))
    setRefreshMsg(m => ({ ...m, [acc.id]: { text: '', ok: true } }))
    try {
      const res  = await apiFetch(`/api/v1/accounts/${acc.id}/refresh-token`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        const text = data.status === 'oauth_required' ? 'OAuth URL opened' : 'Token refreshed'
        setRefreshMsg(m => ({ ...m, [acc.id]: { text, ok: true } }))
        if (data.login_url) window.open(data.login_url, '_blank')
        load()
      } else {
        setRefreshMsg(m => ({ ...m, [acc.id]: { text: data.detail ?? 'Error', ok: false } }))
      }
    } catch {
      setRefreshMsg(m => ({ ...m, [acc.id]: { text: 'Network error', ok: false } }))
    } finally {
      setRefreshing(r => ({ ...r, [acc.id]: false }))
    }
  }

  const logout = () => {
    localStorage.removeItem('invex_token')
    window.location.href = '/login'
  }

  // ── Account card (Accounts tab) ───────────────────────────────────────────
  const AccountCard = ({ acc }: { acc: Account }) => {
    const connected   = acc.has_jwt
    const statusColor = connected ? '#0ea66e' : !acc.is_active ? 'var(--text-mute)' : '#FF4444'
    const statusLabel = connected ? 'Live' : !acc.is_active ? 'Inactive' : 'Offline'
    const msg         = refreshMsg[acc.id]

    return (
      <div style={{ background: 'var(--bg)', boxShadow: 'var(--neu-raised)', borderRadius: 20, padding: 20, marginBottom: 12 }}>
        {/* Row 1: name + status badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            {nickEditing[acc.id] ? (
              <input
                autoFocus
                defaultValue={acc.nickname}
                style={{ ...inp, width: 130, height: 26, fontSize: 14 }}
                onChange={e => setEditNick(n => ({ ...n, [acc.id]: e.target.value }))}
                onBlur={() => saveNickname(acc)}
                onKeyDown={e => {
                  if (e.key === 'Enter')  saveNickname(acc)
                  if (e.key === 'Escape') setNickEditing(n => ({ ...n, [acc.id]: false }))
                }}
              />
            ) : (
              <div
                onClick={() => setNickEditing(n => ({ ...n, [acc.id]: true }))}
                title="Click to rename"
                style={{
                  fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15,
                  color: 'var(--text)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                {acc.nickname}
                <PencilSimple size={11} color="var(--text-mute)" />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)' }}>
                {brokerLabel(acc.broker)}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-mute)' }}>{acc.client_id}</span>
            </div>
          </div>
          <span style={{
            background: 'var(--bg)', boxShadow: 'var(--neu-inset)',
            borderRadius: 100, padding: '3px 10px',
            fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-display)',
            letterSpacing: '0.5px', color: statusColor, flexShrink: 0,
          }}>
            {statusLabel}
          </span>
        </div>

        {/* Row 2: action buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => refreshToken(acc)}
            disabled={refreshing[acc.id]}
            style={{
              height: 28, padding: '0 12px', borderRadius: 100,
              fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)',
              color: connected ? 'var(--accent)' : 'var(--accent)',
              opacity: refreshing[acc.id] ? 0.6 : 1,
            }}
            onMouseDown={e => { e.currentTarget.style.boxShadow = 'var(--neu-inset)' }}
            onMouseUp={e   => { e.currentTarget.style.boxShadow = 'var(--neu-raised-sm)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--neu-raised-sm)' }}
          >
            {refreshing[acc.id] ? '…' : connected ? 'Refresh Token' : 'Login'}
          </button>
          <button
            onClick={() => setEditingCreds({ id: acc.id, nickname: acc.nickname, api_key: '', totp_secret: '', password: '' })}
            style={{
              height: 28, padding: '0 12px', borderRadius: 100,
              fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)',
              color: 'var(--text-dim)',
            }}
            onMouseDown={e => { e.currentTarget.style.boxShadow = 'var(--neu-inset)' }}
            onMouseUp={e   => { e.currentTarget.style.boxShadow = 'var(--neu-raised-sm)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--neu-raised-sm)' }}
          >
            API Keys
          </button>
        </div>

        {/* Feedback rows */}
        {msg?.text && (
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, color: msg.ok ? 'var(--accent)' : '#F59E0B' }}>
            {msg.ok ? <CheckCircle size={13} weight="fill" /> : <Warning size={13} weight="fill" />}
            {msg.text}
          </div>
        )}
        {saved[acc.id] && (() => {
          const ok    = saved[acc.id].startsWith('ok:')
          const label = saved[acc.id].replace(/^(ok|err):/, '')
          return (
            <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, color: ok ? '#0ea66e' : '#F59E0B' }}>
              {ok ? <CheckCircle size={13} weight="fill" /> : <Warning size={13} weight="fill" />}
              {label}
            </div>
          )
        })()}
        {acc.sync_error && (
          <div style={{ marginTop: 6, fontSize: 10, color: '#F59E0B', fontFamily: 'var(--font-mono)' }}>
            {acc.sync_error}
          </div>
        )}
      </div>
    )
  }

  // ── Sync card (Sync tab) ──────────────────────────────────────────────────
  const SyncCard = ({ acc }: { acc: Account }) => {
    const connected = acc.has_jwt
    const msg       = refreshMsg[acc.id]
    return (
      <div style={{ background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)', borderRadius: 16, padding: 16, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {acc.nickname}
              <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-mute)', background: 'var(--bg)', boxShadow: 'var(--neu-inset)', borderRadius: 100, padding: '2px 7px' }}>
                {acc.holdings_count} stocks
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 3 }}>
              {brokerLabel(acc.broker)} · Synced {relativeTime(acc.last_synced_at)}
            </div>
            {acc.sync_error && (
              <div style={{ fontSize: 10, color: '#F59E0B', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{acc.sync_error}</div>
            )}
            {msg?.text && (
              <div style={{ fontSize: 10, color: msg.ok ? 'var(--accent)' : '#F59E0B', marginTop: 2, fontWeight: 600 }}>{msg.text}</div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: '0.5px',
              color: connected ? '#0ea66e' : '#FF4444',
              background: 'var(--bg)', boxShadow: 'var(--neu-inset)',
              borderRadius: 100, padding: '2px 8px',
            }}>
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
            <button
              onClick={() => refreshToken(acc)}
              disabled={refreshing[acc.id]}
              title="Refresh token"
              style={{
                width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)',
                color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: refreshing[acc.id] ? 0.5 : 1,
                transition: 'box-shadow 0.15s',
              }}
              onMouseDown={e => { e.currentTarget.style.boxShadow = 'var(--neu-inset)' }}
              onMouseUp={e   => { e.currentTarget.style.boxShadow = 'var(--neu-raised-sm)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--neu-raised-sm)' }}
            >
              <ArrowsClockwise size={14} style={refreshing[acc.id] ? { animation: 'spin 1s linear infinite' } : undefined} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop — blur(8px) + rgba(0,0,0,0.15), same as STAAX */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 299,
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        background: 'rgba(0,0,0,0.15)',
      }} />

      {/* Floating panel — top:88, right:20, width:420 — same as STAAX */}
      <div ref={panelRef} style={{
        position: 'fixed', top: 88, right: 20, width: 420, zIndex: 322,
        background: 'var(--bg)', boxShadow: 'var(--neu-raised-lg)', borderRadius: 20,
        display: 'flex', flexDirection: 'column',
        maxHeight: 'calc(100vh - 108px)',
        animation: 'ixDrawerIn 0.22s cubic-bezier(0.22,1,0.36,1) both',
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
              color: 'var(--accent)', flexShrink: 0,
            }}>BK</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                Karthikeyan
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 2 }}>LIFEX OS · INVEX</div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)', border: 'none',
                borderRadius: '50%', width: 28, height: 28, cursor: 'pointer',
                color: 'var(--text-dim)', fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>✕</button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 6, padding: '12px 20px 0', flexShrink: 0 }}>
          {TABS.map(t => (
            <button type="button" key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, height: 32, borderRadius: 100, border: 'none', cursor: 'pointer',
              background: 'var(--bg)',
              boxShadow: tab === t.id ? 'var(--neu-inset)' : 'var(--neu-raised-sm)',
              color: tab === t.id ? 'var(--accent)' : 'var(--text-dim)',
              fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)',
              letterSpacing: '0.5px', textTransform: 'uppercase' as const,
              transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 8px' }}>
          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--text-mute)', textAlign: 'center', padding: '32px 0' }}>
              Loading…
            </div>
          ) : accounts.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-mute)', textAlign: 'center', padding: '32px 0' }}>
              No accounts configured
            </div>
          ) : tab === 'accounts' ? (
            accounts.map(a => <AccountCard key={a.id} acc={a} />)
          ) : (
            accounts.map(a => <SyncCard key={a.id} acc={a} />)
          )}
        </div>

        {/* ── Footer: Logout ── */}
        <div style={{ padding: '12px 20px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            onClick={logout}
            style={{
              width: '100%', height: 36, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)',
              color: '#FF4444', fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'box-shadow 0.15s',
            }}
            onMouseDown={e => { e.currentTarget.style.boxShadow = 'var(--neu-inset)' }}
            onMouseUp={e   => { e.currentTarget.style.boxShadow = 'var(--neu-raised-sm)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--neu-raised-sm)' }}
          >
            <SignOut size={14} weight="bold" />
            Logout
          </button>
        </div>
      </div>

      {/* ── Edit API Keys modal ── */}
      {editingCreds && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setEditingCreds(null)}>
          <div
            style={{ background: 'var(--bg)', boxShadow: 'var(--neu-raised)', borderRadius: 20, padding: 28, width: 420, maxWidth: '90%' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                  {editingCreds.nickname}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 2 }}>API Credentials</div>
              </div>
              <button type="button" onClick={() => setEditingCreds(null)}
                style={{ background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: 'var(--text-dim)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {([
                { key: 'api_key',     label: 'API Key',      type: 'text',     ph: 'API key' },
                { key: 'totp_secret', label: 'TOTP Secret',  type: 'password', ph: 'Base32 secret — leave blank to keep' },
                { key: 'password',    label: 'Password',     type: 'password', ph: 'Broker password — leave blank to keep' },
              ] as const).map(({ key, label, type, ph }) => (
                <div key={key}>
                  <label style={lbl}>{label}</label>
                  <input
                    style={inp} type={type} placeholder={ph}
                    value={(editingCreds as any)[key]}
                    onChange={e => setEditingCreds({ ...editingCreds, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditingCreds(null)}
                style={{ height: 36, padding: '0 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)', color: 'var(--text-dim)', fontSize: 12 }}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  const body: Record<string, string> = {}
                  if (editingCreds.api_key)     body.api_key     = editingCreds.api_key
                  if (editingCreds.totp_secret) body.totp_secret = editingCreds.totp_secret
                  if (editingCreds.password)    body.password    = editingCreds.password
                  if (Object.keys(body).length) {
                    await apiFetch(`/api/v1/accounts/${editingCreds.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify(body),
                    })
                  }
                  const id = editingCreds.id
                  setEditingCreds(null)
                  showSaved(id, 'ok:Credentials saved')
                }}
                style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Save">
                <FloppyDisk size={16} weight="bold" />
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ixDrawerIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
