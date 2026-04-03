import { useState, useEffect } from "react"
import { watchlistAPI } from "../services/api"

// ─── Types ────────────────────────────────────────────────────────────────────

type WatchItem = {
  id: string
  account_id: string
  symbol: string
  exchange: string
  added_at: string | null
  notes: string | null
  price_alert_above: number | null
  price_alert_below: number | null
  rsi_alert_threshold: number | null
  earnings_alert: boolean
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const SZ = 16

const IconPlus = () => (
  <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
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
const IconBell = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)
const IconClose = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

// ─── MetricCard — matching PortfolioPage ───────────────────────────────────────

function MetricCard({ label, value, sub, valueColor }: {
  label: string; value: string; sub?: string; valueColor?: string
}) {
  return (
    <div className="glass cloud-fill" style={{ padding: "18px 18px 16px", position: "relative", overflow: "hidden" }}>
      <div style={{
        fontSize: "10px", fontWeight: 600, letterSpacing: "2px",
        textTransform: "uppercase", color: "var(--gs-light)", marginBottom: "10px",
      }}>{label}</div>
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: "clamp(18px, 2.2vw, 26px)", fontWeight: 800,
        color: valueColor || "var(--ix-vivid)",
        letterSpacing: "-1px", lineHeight: 1,
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: "11px", color: "var(--gs-muted)", marginTop: "5px" }}>{sub}</div>
      )}
    </div>
  )
}

// ─── Alert summary for a watchitem ───────────────────────────────────────────

function alertSummary(item: WatchItem): string {
  const parts: string[] = []
  if (item.price_alert_above != null)
    parts.push(`Above ₹${item.price_alert_above.toLocaleString("en-IN")}`)
  if (item.price_alert_below != null)
    parts.push(`Below ₹${item.price_alert_below.toLocaleString("en-IN")}`)
  if (item.rsi_alert_threshold != null)
    parts.push(`RSI < ${item.rsi_alert_threshold}`)
  if (item.earnings_alert)
    parts.push("Earnings")
  return parts.join(" · ") || "—"
}

function hasAlerts(item: WatchItem): boolean {
  return (
    item.price_alert_above != null ||
    item.price_alert_below != null ||
    item.rsi_alert_threshold != null ||
    item.earnings_alert
  )
}

// ─── Add to Watchlist Modal ───────────────────────────────────────────────────

type AddForm = {
  symbol: string
  exchange: string
  price_alert_above: string
  price_alert_below: string
}

function AddWatchlistModal({ onClose, onSave }: {
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [form, setForm] = useState<AddForm>({
    symbol: "", exchange: "NSE",
    price_alert_above: "", price_alert_below: "",
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const set = (k: keyof AddForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.symbol.trim()) { setErr("Symbol is required"); return }
    setSaving(true); setErr("")
    try {
      await onSave({
        symbol: form.symbol.toUpperCase().trim(),
        exchange: form.exchange,
        price_alert_above: form.price_alert_above ? Number(form.price_alert_above) : null,
        price_alert_below: form.price_alert_below ? Number(form.price_alert_below) : null,
      })
      onClose()
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Failed to add to watchlist")
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(22,22,25,0.80)", border: "0.5px solid var(--gs-border)",
    borderRadius: "var(--r-sm)", color: "var(--gs-muted)", fontSize: "13px",
    padding: "9px 12px", outline: "none", fontFamily: "var(--font-display)",
    transition: "border-color 0.15s",
  }
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "10px", fontWeight: 600,
    color: "var(--gs-light)", textTransform: "uppercase",
    letterSpacing: "1.5px", marginBottom: "6px",
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.70)", display: "flex",
      alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: "var(--bg-deep)", border: "0.5px solid var(--ix-border)",
        borderRadius: "var(--r-xl)", width: "400px", maxHeight: "90vh", overflow: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,201,167,0.06)",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "0.5px solid rgba(0,201,167,0.10)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: "16px",
              fontWeight: 700, color: "var(--ix-vivid)",
            }}>Add to Watchlist</div>
            <div style={{ fontSize: "11px", color: "var(--gs-light)", marginTop: "2px" }}>
              Track a stock with optional price alerts
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--gs-muted)", display: "flex", alignItems: "center", padding: "4px",
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
              <input style={inputStyle} placeholder="e.g. INFY"
                value={form.symbol}
                onChange={e => set("symbol", e.target.value.toUpperCase())}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--ix-border)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--gs-border)")} />
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

          {/* Price alerts */}
          <div style={{
            padding: "14px 16px", borderRadius: "var(--r-md)",
            background: "rgba(0,201,167,0.04)",
            border: "0.5px solid rgba(0,201,167,0.12)",
            marginBottom: "16px",
          }}>
            <div style={{
              fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px",
              textTransform: "uppercase", color: "var(--ix-glow)", marginBottom: "12px",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              <IconBell /> Price Alerts (optional)
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Alert above (₹)</label>
                <input style={inputStyle} type="number" placeholder="—"
                  value={form.price_alert_above}
                  onChange={e => set("price_alert_above", e.target.value)}
                  onFocus={e => (e.currentTarget.style.borderColor = "var(--ix-border)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--gs-border)")} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Alert below (₹)</label>
                <input style={inputStyle} type="number" placeholder="—"
                  value={form.price_alert_below}
                  onChange={e => set("price_alert_below", e.target.value)}
                  onFocus={e => (e.currentTarget.style.borderColor = "var(--ix-border)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--gs-border)")} />
              </div>
            </div>
          </div>

          {err && (
            <div style={{
              fontSize: "12px", color: "var(--sem-short)", marginBottom: "14px",
              background: "rgba(255,68,68,0.08)", padding: "9px 12px",
              borderRadius: "var(--r-sm)", border: "0.5px solid rgba(255,68,68,0.25)",
            }}>
              {err}
            </div>
          )}

          <button onClick={handleSubmit} disabled={saving}
            style={{
              width: "100%", padding: "11px", borderRadius: "var(--r-md)",
              border: "none",
              background: "linear-gradient(135deg, #00C9A7, #007A67)",
              color: "#fff", fontSize: "13px", fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1, fontFamily: "var(--font-display)",
              letterSpacing: "0.5px", transition: "box-shadow 0.2s",
            }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.boxShadow = "0 0 22px rgba(0,201,167,0.40)" }}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
            {saving ? "Adding…" : "Add to Watchlist"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const load = async () => {
    try {
      const res = await watchlistAPI.list()
      setItems(res.data || [])
    } catch (e) {
      console.error("WatchlistPage load error", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (data: any) => {
    const res = await watchlistAPI.add(data)
    setItems(prev => [res.data, ...prev])
  }

  const handleRemove = async (id: string) => {
    if (!window.confirm("Remove from watchlist?")) return
    setRemovingId(id)
    try {
      await watchlistAPI.remove(id)
      setItems(prev => prev.filter(i => i.id !== id))
    } finally {
      setRemovingId(null)
    }
  }

  const withAlerts = items.filter(hasAlerts).length

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100%", color: "var(--gs-light)", fontFamily: "var(--font-mono)",
        fontSize: "13px", gap: "10px",
      }}>
        <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
        Loading watchlist…
      </div>
    )
  }

  return (
    <div style={{ padding: "24px 28px", animation: "fadeUp 400ms cubic-bezier(0,0,0.2,1) both" }}>

      {/* ── Page header ── */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: "20px",
      }}>
        <div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: "32px", fontWeight: 800,
            color: "var(--ix-vivid)", letterSpacing: "-1px", marginBottom: "4px",
          }}>Watchlist</div>
          <div style={{ fontSize: "12px", color: "var(--gs-light)" }}>
            Price &amp; technical alerts
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "8px 18px", borderRadius: "var(--r-md)",
            fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 600,
            background: "linear-gradient(135deg, #00C9A7, #007A67)", color: "#fff",
            border: "none", cursor: "pointer", transition: "box-shadow 0.2s",
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 22px rgba(0,201,167,0.40)")}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
          <IconPlus /> Add Stock
        </button>
      </div>

      {/* ── Stats row — 3 MetricCards ── */}
      <div className="grid-3" style={{ marginBottom: "20px" }}>
        <MetricCard
          label="Watching"
          value={String(items.length)}
          sub="stocks in watchlist"
        />
        <MetricCard
          label="Alerts Set"
          value={String(withAlerts)}
          sub="stocks with active alerts"
          valueColor={withAlerts > 0 ? "var(--sem-warn)" : "var(--ix-vivid)"}
        />
        <MetricCard
          label="Exchanges"
          value={[...new Set(items.map(i => i.exchange))].join(" · ") || "—"}
          sub="NSE / BSE coverage"
          valueColor="var(--ix-ultra)"
        />
      </div>

      {/* ── Watchlist Table ── */}
      <div className="glass" style={{ overflow: "hidden" }}>
        <div className="panel-hdr">
          <div className="panel-title">
            Watchlist · {items.length} stock{items.length !== 1 ? "s" : ""}
          </div>
          {withAlerts > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              padding: "2px 9px", borderRadius: "var(--r-pill)",
              fontSize: "10px", fontWeight: 700,
              background: "rgba(255,215,0,0.12)", color: "var(--sem-warn)",
              border: "0.5px solid rgba(255,215,0,0.30)",
            }}>
              <IconBell /> {withAlerts} alert{withAlerts !== 1 ? "s" : ""} active
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div style={{
            padding: "56px", textAlign: "center",
            color: "var(--gs-light)", fontSize: "13px",
          }}>
            No stocks in watchlist.{" "}
            <button
              onClick={() => setShowModal(true)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--ix-vivid)", fontFamily: "inherit", fontSize: "13px",
                textDecoration: "underline",
              }}>
              Add your first stock →
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="holdings-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Stock</th>
                  <th>LTP</th>
                  <th>Change %</th>
                  <th>52W High</th>
                  <th>52W Low</th>
                  <th style={{ textAlign: "left" }}>Alert</th>
                  <th style={{ textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const alerts = hasAlerts(item)
                  return (
                    <tr key={item.id}>
                      <td style={{ textAlign: "left" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div>
                            <div className="td-sym">{item.symbol}</div>
                            <div className="td-sub">{item.exchange}</div>
                          </div>
                          {alerts && (
                            <span style={{
                              padding: "1px 6px", borderRadius: "var(--r-pill)",
                              fontSize: "9px", fontWeight: 700,
                              background: "rgba(255,215,0,0.12)", color: "var(--sem-warn)",
                              border: "0.5px solid rgba(255,215,0,0.25)",
                            }}>
                              ALERT
                            </span>
                          )}
                        </div>
                      </td>
                      {/* LTP — live data not yet available */}
                      <td className="td-num">—</td>
                      {/* Change % */}
                      <td className="td-num">—</td>
                      {/* 52W High */}
                      <td className="td-num">—</td>
                      {/* 52W Low */}
                      <td className="td-num">—</td>
                      {/* Alert column */}
                      <td style={{ textAlign: "left" }}>
                        {alerts ? (
                          <span style={{
                            fontFamily: "var(--font-mono)", fontSize: "11px",
                            color: "var(--sem-warn)",
                          }}>
                            {alertSummary(item)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--gs-light)", fontSize: "12px" }}>—</span>
                        )}
                      </td>
                      {/* Action */}
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => handleRemove(item.id)}
                          disabled={removingId === item.id}
                          title="Remove from watchlist"
                          style={{
                            width: "32px", height: "32px", borderRadius: "var(--r-sm)",
                            border: "0.5px solid var(--gs-border)",
                            background: "transparent",
                            cursor: removingId === item.id ? "not-allowed" : "pointer",
                            color: "var(--sem-short)",
                            opacity: removingId === item.id ? 0.4 : 1,
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,68,68,0.4)")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--gs-border)")}>
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Modal ── */}
      {showModal && (
        <AddWatchlistModal
          onClose={() => setShowModal(false)}
          onSave={handleAdd}
        />
      )}
    </div>
  )
}
