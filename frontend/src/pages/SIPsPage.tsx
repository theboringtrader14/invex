import { useState, useEffect } from "react"
import { sipsAPI } from "../services/api"

// ─── Types ────────────────────────────────────────────────────────────────────

type SIP = {
  id: string
  account_id: string
  symbol: string
  exchange: string
  amount: number
  frequency: string        // "daily" | "weekly" | "monthly"
  frequency_day: number | null   // 0=Mon … 4=Fri
  frequency_date: number | null  // 1–28
  status: string           // "active" | "paused" | "archived"
  start_date: string
  end_date: string | null
  total_invested: number
  total_units: number
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
    // JS day: 0=Sun, 1=Mon … 5=Fri
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

const sz = 16

const IconPlus = () => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

const IconPause = () => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
  </svg>
)

const IconPlay = () => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)

const IconTrash = () => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor"
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

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card" style={{ padding: "20px 24px", flex: 1, minWidth: "160px" }}>
      <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)",
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
        {label}
      </div>
      <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--text)",
        fontFamily: "'DM Mono', monospace", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{sub}</div>
      )}
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    active:   { color: "var(--green)", bg: "rgba(34,197,94,0.1)" },
    paused:   { color: "var(--amber, #F59E0B)", bg: "rgba(245,158,11,0.1)" },
    archived: { color: "var(--text-muted)", bg: "rgba(100,100,100,0.1)" },
  }
  const s = map[status] ?? map.archived
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px",
      fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em",
      textTransform: "uppercase", color: s.color, background: s.bg }}>
      {status}
    </span>
  )
}

// ─── Add SIP Modal ────────────────────────────────────────────────────────────

type FormData = {
  symbol: string
  amount: string
  frequency: string
  frequency_day: string
  frequency_date: string
  account_id: string
  start_date: string
  exchange: string
}

const BLANK_FORM: FormData = {
  symbol: "", amount: "", frequency: "monthly",
  frequency_day: "0", frequency_date: "1",
  account_id: "", start_date: new Date().toISOString().slice(0, 10),
  exchange: "NSE",
}

function AddSIPModal({
  accounts, onClose, onSave,
}: {
  accounts: Account[]
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [form, setForm] = useState<FormData>({
    ...BLANK_FORM,
    account_id: accounts[0]?.id ?? "",
  })
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
    background: "var(--bg-primary)", border: "1px solid var(--bg-border)",
    borderRadius: "6px", color: "var(--text)", fontSize: "13px",
    padding: "8px 12px", outline: "none", fontFamily: "inherit",
  }
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "10px", fontWeight: 600,
    color: "var(--text-muted)", textTransform: "uppercase",
    letterSpacing: "0.08em", marginBottom: "6px",
  }
  const rowStyle: React.CSSProperties = { marginBottom: "16px" }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--bg-border)",
        borderRadius: "12px", width: "420px", maxHeight: "90vh", overflow: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--bg-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>New SIP</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              Recurring investment order
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", display: "flex", alignItems: "center",
              padding: "4px" }}>
            <IconClose />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>

          {/* Symbol + Exchange row */}
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
          <div style={rowStyle}>
            <label style={labelStyle}>Amount (₹)</label>
            <input style={inputStyle} type="number" placeholder="10000"
              value={form.amount}
              onChange={e => set("amount", e.target.value)} />
          </div>

          {/* Frequency */}
          <div style={rowStyle}>
            <label style={labelStyle}>Frequency</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["daily", "weekly", "monthly"] as const).map(f => (
                <button key={f} onClick={() => set("frequency", f)}
                  style={{ flex: 1, padding: "8px 0", borderRadius: "6px",
                    border: `1px solid ${form.frequency === f ? "var(--accent-blue)" : "var(--bg-border)"}`,
                    background: form.frequency === f ? "rgba(0,176,240,0.1)" : "transparent",
                    color: form.frequency === f ? "var(--accent-blue)" : "var(--text-muted)",
                    fontSize: "12px", fontWeight: 600, cursor: "pointer",
                    textTransform: "capitalize", fontFamily: "inherit" }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Weekly day picker */}
          {form.frequency === "weekly" && (
            <div style={rowStyle}>
              <label style={labelStyle}>Day of week</label>
              <div style={{ display: "flex", gap: "6px" }}>
                {DAY_NAMES.map((d, i) => (
                  <button key={i} onClick={() => set("frequency_day", String(i))}
                    style={{ flex: 1, padding: "7px 0", borderRadius: "6px",
                      border: `1px solid ${form.frequency_day === String(i) ? "var(--accent-blue)" : "var(--bg-border)"}`,
                      background: form.frequency_day === String(i) ? "rgba(0,176,240,0.1)" : "transparent",
                      color: form.frequency_day === String(i) ? "var(--accent-blue)" : "var(--text-muted)",
                      fontSize: "11px", fontWeight: 600, cursor: "pointer",
                      fontFamily: "inherit" }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Monthly date picker */}
          {form.frequency === "monthly" && (
            <div style={rowStyle}>
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
          <div style={rowStyle}>
            <label style={labelStyle}>Account</label>
            <select style={inputStyle} value={form.account_id}
              onChange={e => set("account_id", e.target.value)}>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.nickname}</option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div style={rowStyle}>
            <label style={labelStyle}>Start Date</label>
            <input style={inputStyle} type="date" value={form.start_date}
              onChange={e => set("start_date", e.target.value)} />
          </div>

          {err && (
            <div style={{ fontSize: "12px", color: "var(--red)", marginBottom: "12px",
              background: "rgba(239,68,68,0.08)", padding: "8px 12px",
              borderRadius: "6px", border: "1px solid rgba(239,68,68,0.2)" }}>
              {err}
            </div>
          )}

          <button onClick={handleSubmit} disabled={saving}
            style={{ width: "100%", padding: "10px", borderRadius: "7px",
              border: "none", background: "var(--accent-blue)", color: "#fff",
              fontSize: "13px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1, fontFamily: "inherit", letterSpacing: "0.02em" }}>
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

  const load = async () => {
    const token = localStorage.getItem("staax_token")
    try {
      const [acctRes, sipRes, execRes] = await Promise.all([
        fetch("http://localhost:8000/api/v1/accounts/", {
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

  // ── Stats ─────────────────────────────────────────────────────────────────

  const activeSIPs   = sips.filter(s => s.status === "active")
  const monthlyTotal = sips.reduce((acc, s) => acc + monthlyEquiv(s), 0)
  const nextExec     = earliestNextDue(sips)

  // ── Table header style ────────────────────────────────────────────────────

  const th: React.CSSProperties = {
    padding: "10px 14px", textAlign: "left", fontSize: "10px",
    fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase",
    letterSpacing: "0.08em", borderBottom: "1px solid var(--bg-border)",
    whiteSpace: "nowrap",
  }
  const td: React.CSSProperties = {
    padding: "12px 14px", fontSize: "13px", color: "var(--text)",
    borderBottom: "1px solid rgba(42,44,46,0.5)",
    verticalAlign: "middle",
  }

  if (loading) {
    return (
      <div style={{ padding: "24px", display: "flex", alignItems: "center",
        justifyContent: "center", height: "200px", color: "var(--text-muted)",
        fontSize: "13px" }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ padding: "20px 24px", animation: "fadeIn 0.3s ease" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start",
        justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontFamily: "'ADLaM Display', serif", fontSize: "22px", fontWeight: 400, marginBottom: "2px" }}>
            SIP Engine
          </h1>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Recurring investment scheduler
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: "flex", alignItems: "center", gap: "6px",
            padding: "9px 16px", borderRadius: "7px",
            border: "1px solid var(--accent-blue)",
            background: "rgba(0,176,240,0.1)", color: "var(--accent-blue)",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit", letterSpacing: "0.02em" }}>
          <IconPlus /> Add SIP
        </button>
      </div>

      {/* ── Stats row ── */}
      <div style={{ background: "linear-gradient(135deg, rgba(0,176,240,0.08) 0%, rgba(34,197,94,0.05) 100%)",
        borderRadius: "16px", padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <StatCard
            label="Active SIPs"
            value={String(activeSIPs.length)}
            sub={`${sips.length} total`}
          />
          <StatCard
            label="Monthly Commitment"
            value={fmt(monthlyTotal)}
            sub="across active SIPs"
          />
          <StatCard
            label="Next Execution"
            value={nextExec}
            sub="earliest active SIP"
          />
        </div>
      </div>

      {/* ── SIP Table ── */}
      <div style={{ background: "var(--bg-secondary)",
        border: "1px solid var(--bg-border)", borderRadius: "12px",
        overflow: "hidden", marginBottom: "28px" }}>

        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--bg-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
            SIP Schedule
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {sips.length} SIP{sips.length !== 1 ? "s" : ""}
          </span>
        </div>

        {sips.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center",
            color: "var(--text-muted)", fontSize: "13px" }}>
            No SIPs configured yet. Click "Add SIP" to create your first one.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Symbol</th>
                  <th style={{ ...th, textAlign: "right" }}>Amount</th>
                  <th style={th}>Frequency</th>
                  <th style={th}>Account</th>
                  <th style={th}>Next Due</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sips.map(sip => (
                  <tr key={sip.id}
                    style={{ transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={td}>
                      <div style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace",
                        color: "var(--accent-blue)", fontSize: "13px" }}>
                        {sip.symbol}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)",
                        marginTop: "2px" }}>
                        {sip.exchange}
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "'DM Mono', monospace",
                      fontWeight: 600 }}>
                      {fmt(sip.amount)}
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: "12px" }}>{freqLabel(sip)}</span>
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: "12px" }}>
                        {accountMap[sip.account_id] ?? sip.account_id.slice(0, 8) + "…"}
                      </span>
                    </td>
                    <td style={{ ...td, fontFamily: "'DM Mono', monospace",
                      fontSize: "12px", color: "var(--text-muted)" }}>
                      {nextDue(sip)}
                    </td>
                    <td style={td}>
                      <StatusBadge status={sip.status} />
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "6px",
                        justifyContent: "center" }}>
                        <button
                          onClick={() => handleToggle(sip)}
                          title={sip.status === "active" ? "Pause SIP" : "Resume SIP"}
                          style={{ padding: "6px", borderRadius: "5px",
                            border: "1px solid var(--bg-border)",
                            background: "transparent", cursor: "pointer",
                            color: sip.status === "active"
                              ? "var(--amber, #F59E0B)"
                              : "var(--green)",
                            display: "flex", alignItems: "center" }}>
                          {sip.status === "active" ? <IconPause /> : <IconPlay />}
                        </button>
                        <button
                          onClick={() => handleDelete(sip.id)}
                          disabled={deletingId === sip.id}
                          title="Delete SIP"
                          style={{ padding: "6px", borderRadius: "5px",
                            border: "1px solid var(--bg-border)",
                            background: "transparent", cursor: "pointer",
                            color: "var(--red, #EF4444)",
                            display: "flex", alignItems: "center",
                            opacity: deletingId === sip.id ? 0.5 : 1 }}>
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recent Executions ── */}
      <div style={{ background: "var(--bg-secondary)",
        border: "1px solid var(--bg-border)", borderRadius: "12px",
        overflow: "hidden" }}>

        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--bg-border)" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
            Recent Executions
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)",
            marginLeft: "10px" }}>
            last 10
          </span>
        </div>

        {executions.length === 0 ? (
          <div style={{ padding: "36px 24px", textAlign: "center",
            color: "var(--text-muted)", fontSize: "13px" }}>
            No executions recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Symbol</th>
                  <th style={{ ...th, textAlign: "right" }}>Amount</th>
                  <th style={th}>Status</th>
                  <th style={th}>Broker Order ID</th>
                </tr>
              </thead>
              <tbody>
                {executions.map(ex => (
                  <tr key={ex.id}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ ...td, fontFamily: "'DM Mono', monospace",
                      fontSize: "12px", color: "var(--text-muted)" }}>
                      {ex.executed_at
                        ? new Date(ex.executed_at).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td style={td}>
                      <span style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace",
                        color: "var(--accent-blue)", fontSize: "13px" }}>
                        {ex.symbol}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "right",
                      fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                      {fmt(ex.amount)}
                    </td>
                    <td style={td}>
                      <StatusBadge status={ex.status} />
                    </td>
                    <td style={{ ...td, fontFamily: "'DM Mono', monospace",
                      fontSize: "11px", color: "var(--text-muted)" }}>
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
