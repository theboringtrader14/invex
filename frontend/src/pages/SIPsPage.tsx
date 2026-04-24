import { useState, useEffect } from "react"
import { sipsAPI } from "../services/api"

// ─── Types ────────────────────────────────────────────────────────────────────

type SIP = {
  id: string
  account_id: string
  symbol: string
  exchange: string
  amount: number
  frequency: string
  frequency_day: number | null
  frequency_date: number | null
  status: string
  start_date: string
  end_date: string | null
  total_invested: number
  total_units: number
  last_executed_at: string | null
}

type Execution = {
  id: string
  sip_id: string
  symbol: string
  executed_at: string | null
  shares: number
  price: number
  amount: number
  broker_order_id: string | null
  status: string
}

type Account = { id: string; nickname: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"]

function freqLabel(sip: SIP): string {
  if (sip.frequency === "daily") return "Daily"
  if (sip.frequency === "weekly")
    return `Weekly · ${DAY_NAMES[sip.frequency_day ?? 0]}`
  if (sip.frequency === "monthly")
    return `Monthly · ${sip.frequency_date ?? 1}${ordinal(sip.frequency_date ?? 1)}`
  return sip.frequency
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

function nextDue(sip: SIP): string {
  if (sip.status !== "active") return "—"
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (sip.frequency === "daily") {
    return today.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
  }
  if (sip.frequency === "weekly") {
    const target = (sip.frequency_day ?? 0) + 1
    const diff = (target - today.getDay() + 7) % 7 || 7
    const d = new Date(today)
    d.setDate(today.getDate() + diff)
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
  }
  if (sip.frequency === "monthly") {
    const date = sip.frequency_date ?? 1
    let d = new Date(today.getFullYear(), today.getMonth(), date)
    if (d <= today) d = new Date(today.getFullYear(), today.getMonth() + 1, date)
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
  }
  return "—"
}

function fmtLastRun(last_executed_at: string | null): string {
  if (!last_executed_at) return "Never"
  return new Date(last_executed_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
}

function monthlyEquiv(sip: SIP): number {
  if (sip.status !== "active") return 0
  if (sip.frequency === "daily") return sip.amount * 22
  if (sip.frequency === "weekly") return sip.amount * 4.33
  return sip.amount
}

function earliestNextDue(sips: SIP[]): string {
  const active = sips.filter(s => s.status === "active")
  if (active.length === 0) return "—"
  return active
    .map(s => nextDue(s))
    .filter(d => d !== "—")
    .sort()[0] ?? "—"
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const SZ = 16

const IconPlus = () => (
  <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IconPause = () => (
  <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
  </svg>
)
const IconPlay = () => (
  <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)
const IconTrash = () => (
  <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
)
const IconClose = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconBolt = () => (
  <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, valueColor }: {
  label: string; value: string; sub?: string; valueColor?: string
}) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      boxShadow: 'var(--neu-raised)',
      borderRadius: 'var(--r-lg)',
      border: '1px solid var(--border)',
      padding: "18px 18px 16px",
    }}>
      <div style={{
        fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "var(--text-mute)",
        fontFamily: "var(--font-mono)", marginBottom: "10px",
      }}>{label}</div>
      <div style={{
        fontFamily: "var(--font-body)",
        fontSize: "22px", fontWeight: 700,
        color: valueColor || "var(--text)",
        lineHeight: 1,
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: "11px", color: "var(--text-mute)", marginTop: "5px", fontFamily: "var(--font-mono)" }}>{sub}</div>
      )}
    </div>
  )
}

// ─── SIPCard ──────────────────────────────────────────────────────────────────

function SIPCard({ sip, accountName, onToggle, onDelete, onExecuteOne, deleting, executingOne }: {
  sip: SIP
  accountName: string
  onToggle: () => void
  onDelete: () => void
  onExecuteOne: () => void
  deleting: boolean
  executingOne: boolean
}) {
  const isActive = sip.status === "active"

  const iconBtnStyle = (color: string, disabled: boolean): React.CSSProperties => ({
    width: "32px", height: "32px", borderRadius: "var(--r-sm)",
    border: "none",
    background: "var(--bg-surface)",
    boxShadow: disabled ? "none" : "var(--neu-raised-sm)",
    cursor: disabled ? "not-allowed" : "pointer",
    color,
    opacity: disabled ? 0.4 : 1,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s",
  })

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
      padding: "14px 18px",
      borderBottom: "1px solid var(--border)",
    }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(45,212,191,0.03)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>

      {/* Symbol + Exchange */}
      <div style={{ minWidth: "110px" }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 700,
          color: "var(--accent)",
        }}>{sip.symbol}</div>
        <div style={{ marginTop: "3px" }}>
          <span style={{
            padding: "1px 6px", borderRadius: "var(--r-pill)",
            fontSize: "9px", fontWeight: 700, letterSpacing: "1px",
            background: "var(--bg)", boxShadow: "var(--neu-inset)",
            color: "var(--accent)",
            fontFamily: "var(--font-mono)",
          }}>{sip.exchange}</span>
        </div>
      </div>

      {/* Amount */}
      <div style={{ minWidth: "100px" }}>
        <div style={{ fontSize: "10px", color: "var(--text-mute)", marginBottom: "2px", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>Amount</div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 600,
          color: "var(--text-dim)",
        }}>{fmt(sip.amount)}</div>
      </div>

      {/* Frequency */}
      <div style={{ minWidth: "130px" }}>
        <div style={{ fontSize: "10px", color: "var(--text-mute)", marginBottom: "4px", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>Frequency</div>
        <span style={{
          padding: "3px 10px", borderRadius: "var(--r-pill)",
          fontSize: "11px", fontWeight: 600, fontFamily: "var(--font-mono)",
          background: "var(--bg-surface)", boxShadow: "var(--neu-raised-sm)",
          color: "var(--text-dim)",
        }}>{freqLabel(sip)}</span>
      </div>

      {/* Next Execution */}
      <div style={{ minWidth: "100px" }}>
        <div style={{ fontSize: "10px", color: "var(--text-mute)", marginBottom: "2px", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>Next Run</div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: "12px",
          color: isActive ? "var(--accent)" : "var(--text-mute)",
        }}>{nextDue(sip)}</div>
      </div>

      {/* Last Execution */}
      <div style={{ minWidth: "100px" }}>
        <div style={{ fontSize: "10px", color: "var(--text-mute)", marginBottom: "2px", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>Last Run</div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: "12px",
          color: sip.last_executed_at ? "var(--text-dim)" : "var(--text-mute)",
        }}>{fmtLastRun(sip.last_executed_at)}</div>
      </div>

      {/* Account */}
      <div style={{ minWidth: "90px" }}>
        <div style={{ fontSize: "10px", color: "var(--text-mute)", marginBottom: "4px", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>Account</div>
        <span style={{
          padding: "3px 10px", borderRadius: "var(--r-pill)",
          fontSize: "11px", fontWeight: 600, fontFamily: "var(--font-mono)",
          background: "var(--bg-surface)", boxShadow: "var(--neu-raised-sm)",
          color: "var(--text-dim)",
        }}>{accountName}</span>
      </div>

      {/* Status pill */}
      <div style={{ marginLeft: "auto" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "4px",
          padding: "2px 8px", borderRadius: "var(--r-pill)",
          fontSize: "10px", fontWeight: 700, fontFamily: "var(--font-mono)",
          background: "var(--bg)", boxShadow: "var(--neu-inset)",
          color: isActive ? "var(--green)" : "var(--amber)",
        }}>
          {isActive && <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "currentColor", animation: "pulseLive 2s ease-out infinite", display: "inline-block" }} />}
          {sip.status.toUpperCase()}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <button
          onClick={onExecuteOne}
          disabled={executingOne || !isActive}
          title="Execute Now"
          style={iconBtnStyle("var(--accent)", executingOne || !isActive)}>
          <IconBolt />
        </button>
        <button
          onClick={onToggle}
          title={isActive ? "Pause SIP" : "Resume SIP"}
          style={iconBtnStyle(isActive ? "var(--amber)" : "var(--green)", false)}>
          {isActive ? <IconPause /> : <IconPlay />}
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          title="Delete SIP"
          style={iconBtnStyle("var(--red)", deleting)}>
          <IconTrash />
        </button>
      </div>
    </div>
  )
}

// ─── Add SIP Modal ────────────────────────────────────────────────────────────

type FormData = {
  symbol: string; amount: string; frequency: string
  frequency_day: string; frequency_date: string
  account_id: string; start_date: string; exchange: string
}

const BLANK_FORM: FormData = {
  symbol: "", amount: "", frequency: "monthly",
  frequency_day: "0", frequency_date: "1",
  account_id: "", start_date: new Date().toISOString().slice(0, 10),
  exchange: "NSE",
}

function AddSIPModal({ accounts, onClose, onSave }: {
  accounts: Account[]
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [form, setForm] = useState<FormData>({ ...BLANK_FORM, account_id: accounts[0]?.id ?? "" })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.symbol.trim()) { setErr("Symbol is required"); return }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      setErr("Enter a valid amount"); return
    }
    if (!form.account_id) { setErr("Select an account"); return }
    setSaving(true); setErr("")
    try {
      await onSave({
        symbol: form.symbol.toUpperCase().trim(),
        amount: Number(form.amount),
        frequency: form.frequency,
        frequency_day: form.frequency === "weekly" ? Number(form.frequency_day) : null,
        frequency_date: form.frequency === "monthly" ? Number(form.frequency_date) : null,
        account_id: form.account_id,
        start_date: form.start_date,
        exchange: form.exchange,
      })
      onClose()
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Failed to create SIP")
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "var(--bg)", boxShadow: "var(--neu-inset)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)", color: "var(--text)", fontSize: "13px",
    padding: "9px 12px", outline: "none", fontFamily: "var(--font-body)",
    transition: "box-shadow 0.15s",
  }
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "10px", fontWeight: 700,
    color: "var(--text-mute)", textTransform: "uppercase",
    letterSpacing: "0.08em", marginBottom: "6px", fontFamily: "var(--font-mono)",
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.25)", display: "flex",
      alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--bg-surface)",
        boxShadow: "var(--neu-raised-lg)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)", width: "440px", maxHeight: "90vh", overflow: "auto",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: "16px",
              fontWeight: 700, color: "var(--text)",
            }}>New SIP</div>
            <div style={{ fontSize: "11px", color: "var(--text-mute)", marginTop: "2px", fontFamily: "var(--font-body)" }}>
              Recurring investment order
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "var(--bg-surface)", border: "none", cursor: "pointer",
            color: "var(--text-dim)", display: "flex", alignItems: "center",
            padding: "6px", borderRadius: "var(--r-sm)",
            boxShadow: "var(--neu-raised-sm)",
          }}>
            <IconClose />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          {/* Symbol + Exchange */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Symbol</label>
              <input style={inputStyle} placeholder="e.g. RELIANCE"
                value={form.symbol}
                onChange={e => set("symbol", e.target.value.toUpperCase())} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Exchange</label>
              <select style={inputStyle} value={form.exchange}
                onChange={e => set("exchange", e.target.value)}>
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
              </select>
            </div>
          </div>

          {/* Amount */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Amount (₹)</label>
            <input style={inputStyle} type="number" placeholder="10000"
              value={form.amount}
              onChange={e => set("amount", e.target.value)} />
          </div>

          {/* Frequency */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Frequency</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["daily", "weekly", "monthly"] as const).map(f => (
                <button key={f} onClick={() => set("frequency", f)}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: "var(--r-sm)",
                    border: "none",
                    background: form.frequency === f ? "var(--bg)" : "var(--bg-surface)",
                    boxShadow: form.frequency === f ? "var(--neu-inset)" : "var(--neu-raised-sm)",
                    color: form.frequency === f ? "var(--accent)" : "var(--text-dim)",
                    fontSize: "12px", fontWeight: 600, cursor: "pointer",
                    textTransform: "capitalize", fontFamily: "var(--font-body)",
                    transition: "all 0.15s",
                  }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Weekly day picker */}
          {form.frequency === "weekly" && (
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Day of week</label>
              <div style={{ display: "flex", gap: "6px" }}>
                {DAY_NAMES.map((d, i) => (
                  <button key={i} onClick={() => set("frequency_day", String(i))}
                    style={{
                      flex: 1, padding: "7px 0", borderRadius: "var(--r-sm)",
                      border: "none",
                      background: form.frequency_day === String(i) ? "var(--bg)" : "var(--bg-surface)",
                      boxShadow: form.frequency_day === String(i) ? "var(--neu-inset)" : "var(--neu-raised-sm)",
                      color: form.frequency_day === String(i) ? "var(--accent)" : "var(--text-dim)",
                      fontSize: "11px", fontWeight: 600, cursor: "pointer",
                      fontFamily: "var(--font-body)", transition: "all 0.15s",
                    }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Monthly date picker */}
          {form.frequency === "monthly" && (
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Date of month</label>
              <select style={inputStyle} value={form.frequency_date}
                onChange={e => set("frequency_date", e.target.value)}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>
                    {d}{ordinal(d)} of every month
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Account */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Account</label>
            <select style={inputStyle} value={form.account_id}
              onChange={e => set("account_id", e.target.value)}>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.nickname}</option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div style={{ marginBottom: "20px" }}>
            <label style={labelStyle}>Start Date</label>
            <input style={inputStyle} type="date" value={form.start_date}
              onChange={e => set("start_date", e.target.value)} />
          </div>

          {err && (
            <div style={{
              fontSize: "12px", color: "var(--red)", marginBottom: "14px",
              background: "rgba(255,68,68,0.06)", padding: "9px 12px",
              borderRadius: "var(--r-sm)", border: "1px solid rgba(255,68,68,0.20)",
            }}>
              {err}
            </div>
          )}

          <button onClick={handleSubmit} disabled={saving}
            style={{
              width: "100%", padding: "11px", borderRadius: "var(--r-md)",
              border: "none",
              background: "var(--bg-surface)",
              boxShadow: saving ? "none" : "var(--neu-raised)",
              color: "var(--accent)", fontSize: "13px", fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1, fontFamily: "var(--font-body)",
              transition: "all 0.2s",
            }}>
            {saving ? "Creating…" : "Create SIP"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SIPsPage() {
  const [sips, setSips] = useState<SIP[]>([])
  const [executions, setExecutions] = useState<Execution[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountMap, setAccountMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [executingOneId, setExecutingOneId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [runningNow, setRunningNow] = useState(false)

  const load = async () => {
    const token = localStorage.getItem("staax_token")
    try {
      const [acctRes, sipRes, execRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_STAAX_API_URL || 'https://api.lifexos.co.in'}/api/v1/accounts/`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()),
        sipsAPI.list(),
        sipsAPI.allExecutions(),
      ])
      const accts: Account[] = Array.isArray(acctRes) ? acctRes : []
      setAccounts(accts)
      const map: Record<string, string> = {}
      accts.forEach(a => { map[a.id] = a.nickname })
      setAccountMap(map)
      setSips(sipRes.data || [])
      setExecutions(execRes.data || [])
    } catch (e) {
      console.error("SIPsPage load error", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (data: any) => {
    const res = await sipsAPI.create(data)
    setSips(prev => [res.data, ...prev])
  }

  const handleToggle = async (sip: SIP) => {
    const next = sip.status === "active" ? "paused" : "active"
    const res = await sipsAPI.update(sip.id, { status: next })
    setSips(prev => prev.map(s => s.id === sip.id ? res.data : s))
  }

  const handleRunNow = async () => {
    setRunningNow(true)
    try {
      await sipsAPI.executeNow()
      await load()
    } catch (e) {
      console.error("SIP execute-now error", e)
    } finally {
      setRunningNow(false)
    }
  }

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const handleExecuteOne = async (sip: SIP) => {
    setExecutingOneId(sip.id)
    try {
      const res = await sipsAPI.executeNowForSip(sip.id)
      const detail = res.data?.detail ?? {}
      if (detail.status === "executed") {
        showToast(`${sip.symbol} executed — qty ${detail.qty} @ ₹${detail.ltp?.toFixed(2)}`, true)
      } else {
        showToast(`${sip.symbol}: ${detail.reason ?? "skipped"}`, false)
      }
      await load()
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? `Failed to execute ${sip.symbol}`, false)
    } finally {
      setExecutingOneId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this SIP?")) return
    setDeletingId(id)
    try {
      await sipsAPI.delete(id)
      setSips(prev => prev.filter(s => s.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const activeSIPs   = sips.filter(s => s.status === "active")
  const monthlyTotal = sips.reduce((acc, s) => acc + monthlyEquiv(s), 0)
  const nextExec     = earliestNextDue(sips)

  const btnBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: "6px",
    padding: "8px 16px", borderRadius: "var(--r-md)",
    fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600,
    background: "var(--bg-surface)", border: "none", cursor: "pointer",
    boxShadow: "var(--neu-raised-sm)", color: "var(--text-dim)",
    transition: "all 0.15s",
  }

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "60vh", color: "var(--text-mute)", fontFamily: "var(--font-mono)",
        fontSize: "13px", gap: "10px",
      }}>
        <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
        Loading SIPs…
      </div>
    )
  }

  return (
    <div style={{ animation: "fadeUp 400ms cubic-bezier(0,0,0.2,1) both" }}>

      {/* ── Toast notification ── */}
      {toast && (
        <div style={{
          position: "fixed", top: "20px", right: "24px", zIndex: 2000,
          padding: "12px 20px", borderRadius: "var(--r-md)",
          fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600,
          background: "var(--bg-surface)",
          boxShadow: "var(--neu-raised-lg)",
          border: "1px solid var(--border)",
          color: toast.ok ? "var(--green)" : "var(--red)",
          maxWidth: "360px",
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Page header ── */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: "20px", paddingTop: "8px",
      }}>
        <div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 800,
            color: "var(--text)", marginBottom: "4px",
          }}>SIP Engine</div>
          <div style={{ fontSize: "12px", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>
            Recurring investment scheduler
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            onClick={handleRunNow}
            disabled={runningNow}
            style={{ ...btnBase, color: "var(--accent)", opacity: runningNow ? 0.6 : 1, cursor: runningNow ? "not-allowed" : "pointer" }}>
            <IconPlay /> {runningNow ? "Running…" : "Run Now"}
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{ ...btnBase, color: "var(--accent)" }}>
            <IconPlus /> New SIP
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
        <MetricCard
          label="Active SIPs"
          value={String(activeSIPs.length)}
          sub={`${sips.length} total configured`}
        />
        <MetricCard
          label="Monthly Investment"
          value={fmt(monthlyTotal)}
          sub="across active SIPs"
          valueColor="var(--green)"
        />
        <MetricCard
          label="Next Execution"
          value={nextExec}
          sub="earliest active SIP"
          valueColor="var(--accent)"
        />
      </div>

      {/* ── SIP List ── */}
      <div style={{
        background: "var(--bg-surface)",
        boxShadow: "var(--neu-raised)",
        borderRadius: "var(--r-lg)",
        border: "1px solid var(--border)",
        overflow: "hidden", marginBottom: "20px",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px 12px",
        }}>
          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-mute)", fontFamily: "var(--font-mono)" }}>
            SIP Schedule · {sips.length} SIP{sips.length !== 1 ? "s" : ""}
          </div>
          <span style={{ fontSize: "10px", color: "var(--text-mute)", fontFamily: "var(--font-mono)" }}>
            Executes at 09:20 IST
          </span>
        </div>

        {sips.length === 0 ? (
          <div style={{
            padding: "48px", textAlign: "center",
            color: "var(--text-mute)", fontSize: "13px",
          }}>
            No SIPs configured yet.{" "}
            <button
              onClick={() => setShowModal(true)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--accent)", fontFamily: "inherit", fontSize: "13px",
                textDecoration: "underline",
              }}>
              Create your first SIP →
            </button>
          </div>
        ) : (
          sips.map(sip => (
            <SIPCard
              key={sip.id}
              sip={sip}
              accountName={accountMap[sip.account_id] ?? sip.account_id.slice(0, 8) + "…"}
              onToggle={() => handleToggle(sip)}
              onDelete={() => handleDelete(sip.id)}
              onExecuteOne={() => handleExecuteOne(sip)}
              deleting={deletingId === sip.id}
              executingOne={executingOneId === sip.id}
            />
          ))
        )}
      </div>

      {/* ── Recent Executions ── */}
      <div style={{
        background: "var(--bg-surface)",
        boxShadow: "var(--neu-raised)",
        borderRadius: "var(--r-lg)",
        border: "1px solid var(--border)",
        overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px 12px",
        }}>
          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-mute)", fontFamily: "var(--font-mono)" }}>
            Recent Executions
          </div>
          <span style={{ fontSize: "10px", color: "var(--text-mute)", fontFamily: "var(--font-mono)" }}>last 10</span>
        </div>

        {executions.length === 0 ? (
          <div style={{
            padding: "36px", textAlign: "center",
            color: "var(--text-mute)", fontSize: "13px",
          }}>
            No executions recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="ix-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Date</th>
                  <th style={{ textAlign: "left" }}>Symbol</th>
                  <th>Amount</th>
                  <th style={{ textAlign: "left" }}>Status</th>
                  <th style={{ textAlign: "left" }}>Broker Order</th>
                </tr>
              </thead>
              <tbody>
                {executions.map(ex => (
                  <tr key={ex.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", textAlign: "left" }}>
                      {ex.executed_at
                        ? new Date(ex.executed_at).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--accent)" }}>{ex.symbol}</span>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{fmt(ex.amount)}</td>
                    <td style={{ textAlign: "left" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "4px",
                        padding: "2px 8px", borderRadius: "var(--r-pill)",
                        fontSize: "10px", fontWeight: 700, fontFamily: "var(--font-mono)",
                        background: "var(--bg)", boxShadow: "var(--neu-inset)",
                        color: ex.status === "placed" ? "var(--green)" : "var(--amber)",
                      }}>
                        {ex.status}
                      </span>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-mute)" }}>
                      {ex.broker_order_id ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add SIP Modal ── */}
      {showModal && (
        <AddSIPModal
          accounts={accounts}
          onClose={() => setShowModal(false)}
          onSave={handleCreate}
        />
      )}
    </div>
  )
}
