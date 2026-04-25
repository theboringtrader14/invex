/**
 * InvexAccountsDrawer — broker account management side drawer.
 *
 * Tabs:
 *   ACCOUNTS — list all accounts with status; add / edit credentials
 *   SYNC     — per-account sync trigger; shows last_synced_at + holdings_count
 */
import { useState, useEffect, useCallback } from "react"

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8001"

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

interface EditState {
  nickname: string
  api_key: string
  totp_secret: string
  password: string
}

// ── icons ────────────────────────────────────────────────────────────────────

const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const IconSync = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
  </svg>
)

const IconChevron = ({ open }: { open: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
    style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// ── helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return "never"
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function brokerLabel(b: string) {
  if (b === "angelone") return "Angel One"
  if (b === "zerodha")  return "Zerodha"
  return b
}

// ── sub-components ───────────────────────────────────────────────────────────

function AccountRow({ acc, onRefresh }: { acc: Account; onRefresh: () => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<EditState>({
    nickname: acc.nickname, api_key: "", totp_secret: "", password: "",
  })

  const save = async () => {
    setSaving(true)
    try {
      const body: Record<string, string> = {}
      if (form.nickname !== acc.nickname) body.nickname   = form.nickname
      if (form.api_key)                  body.api_key     = form.api_key
      if (form.totp_secret)              body.totp_secret = form.totp_secret
      if (form.password)                 body.password    = form.password
      if (!Object.keys(body).length) { setOpen(false); return }
      await fetch(`${API}/api/v1/accounts/${acc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      onRefresh()
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const statusColor = acc.has_jwt
    ? "var(--ix-vivid)"
    : acc.sync_error
    ? "#FF4444"
    : "rgba(240,237,232,0.30)"

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "0.5px solid rgba(255,255,255,0.08)",
      borderRadius: "10px", marginBottom: "8px", overflow: "hidden",
    }}>
      {/* Row header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: "10px",
          padding: "10px 14px", background: "none", border: "none",
          cursor: "pointer", textAlign: "left",
        }}
      >
        {/* Status dot */}
        <span style={{
          width: "7px", height: "7px", borderRadius: "50%",
          background: statusColor, flexShrink: 0,
          boxShadow: acc.has_jwt ? `0 0 6px ${statusColor}` : "none",
        }} />
        <span style={{ flex: 1, fontSize: "13px", color: "#F0EDE8", fontWeight: 600 }}>
          {acc.nickname}
        </span>
        <span style={{ fontSize: "10px", color: "rgba(240,237,232,0.40)", marginRight: "6px" }}>
          {brokerLabel(acc.broker)} · {acc.client_id}
        </span>
        <IconChevron open={open} />
      </button>

      {/* Expanded edit form */}
      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize: "11px", color: "rgba(240,237,232,0.35)", margin: "10px 0 8px" }}>
            Leave credential fields blank to keep existing values.
          </p>
          {[
            { key: "nickname",    label: "Nickname",    type: "text",     ph: acc.nickname },
            { key: "api_key",     label: "API Key",     type: "password", ph: "••••••••" },
            { key: "totp_secret", label: "TOTP Secret", type: "password", ph: "••••••••" },
            { key: "password",    label: "Password",    type: "password", ph: "••••••••" },
          ].map(({ key, label, type, ph }) => (
            <div key={key} style={{ marginBottom: "8px" }}>
              <label style={{ fontSize: "10px", color: "rgba(240,237,232,0.40)", display: "block", marginBottom: "3px" }}>
                {label}
              </label>
              <input
                type={type}
                value={(form as any)[key]}
                placeholder={ph}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "6px 10px", borderRadius: "7px",
                  background: "rgba(255,255,255,0.05)",
                  border: "0.5px solid rgba(255,255,255,0.12)",
                  color: "#F0EDE8", fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  outline: "none",
                }}
              />
            </div>
          ))}
          <button
            onClick={save}
            disabled={saving}
            style={{
              marginTop: "4px",
              padding: "6px 14px", borderRadius: "7px",
              background: "rgba(0,201,167,0.15)",
              border: "0.5px solid rgba(0,201,167,0.40)",
              color: "var(--ix-vivid)", fontSize: "12px", fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  )
}

function SyncRow({ acc, onRefreshed }: { acc: Account; onRefreshed: () => void }) {
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "err">("idle")
  const [msg, setMsg]       = useState("")

  const trigger = async () => {
    setStatus("busy"); setMsg("")
    try {
      const res = await fetch(`${API}/api/v1/accounts/${acc.id}/refresh-token`, { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setMsg(data.status === "oauth_required" ? `OAuth URL: ${data.login_url}` : "Token refreshed")
        setStatus("done")
      } else {
        setMsg(data.detail ?? "Error")
        setStatus("err")
      }
      onRefreshed()
    } catch (e: any) {
      setMsg(e.message); setStatus("err")
    }
  }

  const dotColor = acc.has_jwt ? "var(--ix-vivid)" : acc.sync_error ? "#FF4444" : "rgba(240,237,232,0.30)"

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "10px 14px",
      background: "rgba(255,255,255,0.03)",
      border: "0.5px solid rgba(255,255,255,0.08)",
      borderRadius: "10px", marginBottom: "8px",
    }}>
      <span style={{
        width: "7px", height: "7px", borderRadius: "50%",
        background: dotColor, flexShrink: 0,
        boxShadow: acc.has_jwt ? `0 0 6px ${dotColor}` : "none",
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "12px", color: "#F0EDE8", fontWeight: 600 }}>
          {acc.nickname}
          <span style={{ fontWeight: 400, color: "rgba(240,237,232,0.35)", marginLeft: "6px" }}>
            {acc.holdings_count} holdings
          </span>
        </div>
        <div style={{ fontSize: "10px", color: "rgba(240,237,232,0.35)", marginTop: "2px" }}>
          Synced {relativeTime(acc.last_synced_at)}
          {acc.sync_error && (
            <span style={{ color: "#FF4444", marginLeft: "6px" }}>{acc.sync_error}</span>
          )}
          {msg && (
            <span style={{ color: status === "err" ? "#FF4444" : "var(--ix-vivid)", marginLeft: "6px" }}>{msg}</span>
          )}
        </div>
      </div>
      <button
        onClick={trigger}
        disabled={status === "busy"}
        title="Refresh token"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "30px", height: "30px", borderRadius: "8px",
          background: "rgba(0,201,167,0.10)",
          border: "0.5px solid rgba(0,201,167,0.25)",
          color: "var(--ix-vivid)", cursor: "pointer",
          opacity: status === "busy" ? 0.5 : 1,
          animation: status === "busy" ? "spin 1s linear infinite" : "none",
        }}
      >
        <IconSync />
      </button>
    </div>
  )
}

// ── main drawer ──────────────────────────────────────────────────────────────

export default function InvexAccountsDrawer({ onClose }: { onClose: () => void }) {
  const [tab, setTab]           = useState<"accounts" | "sync">("accounts")
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/v1/accounts/`)
      if (res.ok) setAccounts(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 16px", borderRadius: "7px",
    background: active ? "rgba(0,201,167,0.15)" : "transparent",
    border: active ? "0.5px solid rgba(0,201,167,0.40)" : "0.5px solid transparent",
    color: active ? "var(--ix-vivid)" : "rgba(240,237,232,0.40)",
    fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em",
    cursor: "pointer", textTransform: "uppercase" as const,
  })

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 199,
          background: "rgba(0,0,0,0.40)",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 200,
        width: "360px",
        background: "rgba(10,10,11,0.97)",
        borderLeft: "0.5px solid rgba(0,201,167,0.18)",
        backdropFilter: "blur(24px)",
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.60)",
      }}>
        {/* header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 18px 12px",
          borderBottom: "0.5px solid rgba(0,201,167,0.12)",
        }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#F0EDE8", letterSpacing: "0.04em" }}>
            BROKER ACCOUNTS
          </span>
          <button
            onClick={onClose}
            style={{
              width: "28px", height: "28px", borderRadius: "7px",
              background: "rgba(255,255,255,0.04)",
              border: "0.5px solid rgba(255,255,255,0.08)",
              color: "rgba(240,237,232,0.40)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <IconClose />
          </button>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", gap: "6px", padding: "12px 18px 10px" }}>
          <button style={tabStyle(tab === "accounts")} onClick={() => setTab("accounts")}>Accounts</button>
          <button style={tabStyle(tab === "sync")}     onClick={() => setTab("sync")}>Sync</button>
        </div>

        {/* body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 18px 18px" }}>
          {loading ? (
            <p style={{ fontSize: "12px", color: "rgba(240,237,232,0.30)", textAlign: "center", paddingTop: "40px" }}>
              Loading…
            </p>
          ) : accounts.length === 0 ? (
            <p style={{ fontSize: "12px", color: "rgba(240,237,232,0.30)", textAlign: "center", paddingTop: "40px" }}>
              No accounts configured.
            </p>
          ) : tab === "accounts" ? (
            accounts.map(a => <AccountRow key={a.id} acc={a} onRefresh={load} />)
          ) : (
            accounts.map(a => <SyncRow key={a.id} acc={a} onRefreshed={load} />)
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </>
  )
}
