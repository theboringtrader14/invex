import { useState, useEffect, useCallback } from "react"
import { ArrowsClockwise } from "@phosphor-icons/react"
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

type PriceInfo = { ltp: number; change: number; pct_change: number } | null
type PricesMap = Record<string, PriceInfo>

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
const IconRefresh = ({ spinning }: { spinning?: boolean }) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    style={spinning ? { animation: "spin 1s linear infinite", display: "inline-block" } : undefined}>
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
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
      padding: "18px 18px 16px"
    }}>
      <div style={{
        fontSize: "10px", fontWeight: 400, letterSpacing: "1px",
        textTransform: "uppercase", color: "var(--text-mute)",
        fontFamily: "var(--font-mono)", marginBottom: "10px"
      }}>{label}</div>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: "22px", fontWeight: 700,
        color: valueColor || "var(--text)",
        lineHeight: 1
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: "11px", color: "var(--text-mute)", marginTop: "5px", fontFamily: "var(--font-mono)" }}>{sub}</div>
      )}
    </div>
  )
}

// ─── Alert summary ────────────────────────────────────────────────────────────

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
    price_alert_above: "", price_alert_below: ""
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
        price_alert_below: form.price_alert_below ? Number(form.price_alert_below) : null
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
    background: "var(--bg)", boxShadow: "var(--neu-inset)",
    borderRadius: "var(--r-sm)", color: "var(--text)", fontSize: "13px",
    padding: "9px 12px", outline: "none", fontFamily: "var(--font-body)"
  }
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "10px", fontWeight: 400,
    color: "var(--text-mute)", textTransform: "uppercase",
    letterSpacing: "1px", marginBottom: "6px", fontFamily: "var(--font-mono)"
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.25)", display: "flex",
      alignItems: "center", justifyContent: "center"
    }}>
      <div style={{
        background: "var(--bg-surface)",
        boxShadow: "var(--neu-raised-lg)",
        borderRadius: "var(--r-xl)", width: "400px", maxHeight: "90vh", overflow: "auto"
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: "16px",
              fontWeight: 700, color: "var(--text)"
            }}>Add to Watchlist</div>
            <div style={{ fontSize: "11px", color: "var(--text-mute)", marginTop: "2px", fontFamily: "var(--font-body)" }}>
              Track a stock with optional price alerts
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "var(--bg-surface)", border: "none", cursor: "pointer",
            color: "var(--text-dim)", display: "flex", alignItems: "center", padding: "6px",
            borderRadius: "var(--r-sm)", boxShadow: "var(--neu-raised-sm)"
          }}>
            <IconClose />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          {/* Symbol + Exchange */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Symbol</label>
              <input style={inputStyle} placeholder="e.g. INFY"
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

          {/* Price alerts */}
          <div style={{
            padding: "14px 16px", borderRadius: "var(--r-md)",
            background: "var(--bg)", boxShadow: "var(--neu-inset)",
            marginBottom: "16px"
          }}>
            <div style={{
              fontSize: "10px", fontWeight: 400, letterSpacing: "1px",
              textTransform: "uppercase", color: "var(--text-mute)", marginBottom: "16px",
              display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)"
            }}>
              <IconBell /> Price Alerts (optional)
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Alert above (₹)</label>
                <input style={inputStyle} type="number" placeholder="—"
                  value={form.price_alert_above}
                  onChange={e => set("price_alert_above", e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Alert below (₹)</label>
                <input style={inputStyle} type="number" placeholder="—"
                  value={form.price_alert_below}
                  onChange={e => set("price_alert_below", e.target.value)} />
              </div>
            </div>
          </div>

          {err && (
            <div style={{
              fontSize: "12px", color: "var(--red)", marginBottom: "14px",
              background: "rgba(255,68,68,0.06)", padding: "9px 12px",
              borderRadius: "var(--r-sm)", border: "1px solid rgba(255,68,68,0.20)"
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
              transition: "all 0.2s"
            }}>
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

  const [prices, setPrices] = useState<PricesMap>({})
  const [pricesLoading, setPricesLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchPrices = useCallback(async () => {
    setPricesLoading(true)
    try {
      const res = await watchlistAPI.getPrices()
      setPrices(res.data?.prices ?? {})
      setLastUpdated(new Date())
    } catch (e) {
      console.error("WatchlistPage fetchPrices error", e)
    } finally {
      setPricesLoading(false)
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await watchlistAPI.list()
      setItems(res.data || [])
    } catch (e) {
      console.error("WatchlistPage load error", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    fetchPrices()
  }, [load, fetchPrices])

  useEffect(() => {
    const id = setInterval(() => {
      load()
      fetchPrices()
    }, 30000)
    return () => clearInterval(id)
  }, [load, fetchPrices])

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

  const btnBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: "6px",
    padding: "8px 16px", borderRadius: "var(--r-md)",
    fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600,
    background: "var(--bg-surface)", border: "none", cursor: "pointer",
    boxShadow: "var(--neu-raised-sm)", color: "var(--text-dim)",
    transition: "all 0.15s"
  }

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "60vh", color: "var(--text-mute)", fontFamily: "var(--font-mono)",
        fontSize: "13px", gap: "10px"
      }}>
        <ArrowsClockwise size={16} style={{ animation: "spin 1s linear infinite" }} />
        Loading watchlist…
      </div>
    )
  }

  return (
    <div style={{ animation: "fadeUp 400ms cubic-bezier(0,0,0.2,1) both" }}>

      {/* ── Page header ── */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: "20px"
      }}>
        <div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 800,
            color: "var(--accent)", marginBottom: "4px"
          }}>Watchlist</div>
          <div style={{ fontSize: "12px", color: "var(--text-dim)", display: "flex", alignItems: "center", gap: "10px", fontFamily: "var(--font-body)" }}>
            Price &amp; technical alerts
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              padding: "2px 8px", borderRadius: "var(--r-pill)",
              fontSize: "9px", fontWeight: 600, fontFamily: "var(--font-mono)",
              letterSpacing: "0.5px", textTransform: "uppercase",
              background: "var(--bg)", boxShadow: "var(--neu-inset)",
              color: "var(--green)"
            }}>
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "currentColor", animation: "pulseLive 2s ease-out infinite", display: "inline-block" }} />
              {lastUpdated
                ? `Live · ${lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`
                : "Live · 30s"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={fetchPrices}
            disabled={pricesLoading}
            title="Refresh live prices"
            style={{ ...btnBase, color: "var(--accent)", opacity: pricesLoading ? 0.6 : 1, cursor: pricesLoading ? "not-allowed" : "pointer" }}>
            <IconRefresh spinning={pricesLoading} /> Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{ ...btnBase, color: "var(--accent)" }}>
            <IconPlus /> Add Stock
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        <MetricCard
          label="Watching"
          value={String(items.length)}
          sub="stocks in watchlist"
        />
        <MetricCard
          label="Alerts Set"
          value={String(withAlerts)}
          sub="stocks with active alerts"
          valueColor={withAlerts > 0 ? "var(--amber)" : "var(--text)"}
        />
        <MetricCard
          label="Exchanges"
          value={[...new Set(items.map(i => i.exchange))].join(" · ") || "—"}
          sub="NSE / BSE coverage"
          valueColor="var(--accent)"
        />
      </div>

      {/* ── Watchlist Table ── */}
      <div style={{
        background: "var(--bg-surface)",
        boxShadow: "var(--neu-raised)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden"
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px 12px"
        }}>
          <div style={{ fontSize: "10px", fontWeight: 400, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-mute)", fontFamily: "var(--font-mono)" }}>
            Watchlist · {items.length} stock{items.length !== 1 ? "s" : ""}
          </div>
          {withAlerts > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              padding: "2px 9px", borderRadius: "var(--r-pill)",
              fontSize: "9px", fontWeight: 600, fontFamily: "var(--font-mono)",
              letterSpacing: "0.5px", textTransform: "uppercase",
              background: "var(--bg)", boxShadow: "var(--neu-inset)",
              color: "var(--amber)"
            }}>
              <IconBell /> {withAlerts} alert{withAlerts !== 1 ? "s" : ""} active
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div style={{
            padding: "56px", textAlign: "center",
            color: "var(--text-mute)", fontSize: "13px"
          }}>
            No stocks in watchlist.{" "}
            <button
              onClick={() => setShowModal(true)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--accent)", fontFamily: "inherit", fontSize: "13px",
                textDecoration: "underline"
              }}>
              Add your first stock →
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="ix-table">
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
                            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--accent)", fontSize: "13px" }}>{item.symbol}</div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-mute)" }}>{item.exchange}</div>
                          </div>
                          {alerts && (
                            <span style={{
                              padding: "1px 6px", borderRadius: "var(--r-pill)",
                              fontSize: "9px", fontWeight: 600, fontFamily: "var(--font-mono)",
                              letterSpacing: "0.5px", textTransform: "uppercase",
                              background: "rgba(245,158,11,0.10)", color: "var(--amber)",
                              border: "1px solid rgba(245,158,11,0.20)"
                            }}>
                              ALERT
                            </span>
                          )}
                        </div>
                      </td>
                      {(() => {
                        const p = prices[item.symbol]
                        const isPos = p && p.change >= 0
                        return (
                          <>
                            <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--accent)", fontWeight: 700 }}>
                              {pricesLoading && !p
                                ? <span style={{ color: "var(--text-mute)", fontWeight: 400 }}>…</span>
                                : p
                                  ? `₹${p.ltp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : <span style={{ color: "var(--text-mute)", fontWeight: 400 }}>—</span>
                              }
                            </td>
                            <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: p ? (isPos ? "var(--green)" : "var(--red)") : "var(--text-mute)" }}>
                              {pricesLoading && !p
                                ? <span style={{ color: "var(--text-mute)" }}>…</span>
                                : p
                                  ? <>
                                      <span style={{ display: "block" }}>
                                        {isPos ? "+" : ""}{p.change.toFixed(2)}
                                      </span>
                                      <span style={{ fontSize: "10px", opacity: 0.85 }}>
                                        {isPos ? "+" : ""}{p.pct_change.toFixed(2)}%
                                      </span>
                                    </>
                                  : "—"
                              }
                            </td>
                          </>
                        )
                      })()}
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-mute)" }}>—</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-mute)" }}>—</td>
                      <td style={{ textAlign: "left" }}>
                        {alerts ? (
                          <span style={{
                            fontFamily: "var(--font-mono)", fontSize: "11px",
                            color: "var(--amber)"
                          }}>
                            {alertSummary(item)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-mute)", fontSize: "12px" }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => handleRemove(item.id)}
                          disabled={removingId === item.id}
                          title="Remove from watchlist"
                          style={{
                            width: "32px", height: "32px", borderRadius: "var(--r-sm)",
                            border: "none",
                            background: "var(--bg-surface)",
                            boxShadow: removingId === item.id ? "none" : "var(--neu-raised-sm)",
                            cursor: removingId === item.id ? "not-allowed" : "pointer",
                            color: "var(--red)",
                            opacity: removingId === item.id ? 0.4 : 1,
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s"
                          }}>
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

      {showModal && (
        <AddWatchlistModal
          onClose={() => setShowModal(false)}
          onSave={handleAdd}
        />
      )}
    </div>
  )
}
