import { useState, useEffect, useCallback } from "react"
import { ArrowsClockwise, X, ChartLine, ArrowRight } from "@phosphor-icons/react"
import { useNavigate } from "react-router-dom"
import { portfolioAPI } from "../services/api"
import { apiFetch } from "../lib/api"
import { useAuth } from "../contexts/AuthContext"
import { SortableHeader } from "../components/SortableHeader"
import { useSort } from "../hooks/useSort"

/* ─── Types ─────────────────────────────────────── */
type Holding = {
  id: string; account_id: string; symbol: string; exchange: string
  sector?: string
  qty: number; avg_price: number; ltp?: number
  pnl?: number; pnl_pct?: number; current_value?: number
  invested_value: number; day_change?: number
}
type MFHolding = {
  id: string; account_id?: string; fund_name: string
  units: number; nav?: number
  invested_amount?: number; current_value?: number; pnl?: number
}
type Summary = {
  total_portfolio_value: number; total_invested: number
  total_pnl: number; total_pnl_pct: number
  day_pnl: number; equity_value: number; mf_value: number
  xirr?: number; holdings_count: number; mf_count: number
}
type Snapshot = { date: string; total_value: number; invested?: number; pnl?: number }
type SortKey = "symbol" | "qty" | "avg_price" | "ltp" | "pnl" | "pnl_pct" | "day_change" | "account" | "current_value"
type TimeRange = "1M" | "3M" | "1Y" | "All"
type ActiveTab = "equity" | "mf"

const LS_SORT_KEY = "invex_holdings_sort"
const INVEX_API = import.meta.env.VITE_API_URL ?? "http://localhost:8001"
const PORTFOLIO_CACHE = "invex:portfolio:cache"

type PortfolioCache = {
  summary: Summary | null
  holdings: Holding[]
  mf: MFHolding[]
  snapshots: Snapshot[]
}
function readCache(): PortfolioCache | null {
  try { const r = sessionStorage.getItem(PORTFOLIO_CACHE); return r ? JSON.parse(r) : null } catch { return null }
}
function writeCache(d: PortfolioCache) {
  try { sessionStorage.setItem(PORTFOLIO_CACHE, JSON.stringify(d)) } catch { /* quota */ }
}

/* ─── Helpers ────────────────────────────────────── */
const displaySym = (s: string) =>
  s?.replace(/-EQ$/i, "").replace(/-BE$/i, "").replace(/\.NS$/i, "").replace(/\.BO$/i, "") || s

const fmt = (n?: number) =>
  n != null ? `₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"
const fmtPct = (n?: number) =>
  n != null ? `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` : "—"
const pnlColor = (n?: number) =>
  !n ? "var(--text-mute)" : n >= 0 ? "var(--green)" : "var(--red)"

/* ─── Sector computation helper ──────────────────── */
function computeSectors(holdings: Holding[]) {
  const grouped: Record<string, { value: number; count: number }> = {}
  let total = 0
  for (const h of holdings) {
    const key = h.sector || "Others"
    const val = h.current_value ?? h.invested_value
    if (!grouped[key]) grouped[key] = { value: 0, count: 0 }
    grouped[key].value += val
    grouped[key].count += 1
    total += val
  }
  return Object.entries(grouped)
    .map(([key, { value, count }]) => ({
      key, value, count, pct: total > 0 ? (value / total) * 100 : 0
    }))
    .sort((a, b) => b.pct - a.pct)
}

/* ─── SkeletonCard ───────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      boxShadow: 'var(--neu-raised)',
      borderRadius: 14,
      padding: "16px 20px",
      flex: 1
    }}>
      <div style={{ height: "10px", width: "55%", background: "rgba(0,0,0,0.06)", borderRadius: "3px", marginBottom: "12px", animation: "pulseLive 1.5s ease-in-out infinite" }} />
      <div style={{ height: "22px", width: "70%", background: "rgba(0,0,0,0.09)", borderRadius: "4px", animation: "pulseLive 1.5s ease-in-out infinite" }} />
    </div>
  )
}

/* ─── KPI Strip Card ─────────────────────────────── */
function KPICard({
  label, value, sub, valueColor, onClick, hint
}: {
  label: string; value: string; sub?: string; valueColor?: string
  onClick?: () => void; hint?: string
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-surface)',
        boxShadow: 'var(--neu-raised)',
        borderRadius: 14,
        border: 'none',
        padding: "16px 20px",
        flex: 1,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s'
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: "5px",
        fontSize: "10px", fontWeight: 400, letterSpacing: "1px",
        textTransform: "uppercase", color: "var(--text-mute)",
        fontFamily: "var(--font-mono)", marginBottom: "4px"
      }}>
        {label}
        {onClick && <ChartLine size={11} style={{ opacity: 0.6 }} />}
      </div>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: "22px", fontWeight: 700,
        color: valueColor || "var(--text)",
        lineHeight: 1
      }}>{value}</div>
      {hint && (
        <div style={{ fontSize: "10px", color: "var(--text-mute)", marginTop: "5px", fontFamily: "var(--font-mono)" }}>{hint}</div>
      )}
      {sub && (
        <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px", fontFamily: "var(--font-body)" }}>{sub}</div>
      )}
    </div>
  )
}

/* ─── Equity Curve Modal ─────────────────────────── */
function EquityCurveModal({ snapshots, onClose }: { snapshots: Snapshot[]; onClose: () => void }) {
  const [range, setRange] = useState<TimeRange>("3M")

  const filtered = (() => {
    if (!snapshots.length) return []
    const now = new Date()
    const cutoff = new Date(now)
    if (range === "1M") cutoff.setMonth(now.getMonth() - 1)
    else if (range === "3M") cutoff.setMonth(now.getMonth() - 3)
    else if (range === "1Y") cutoff.setFullYear(now.getFullYear() - 1)
    else return snapshots
    return snapshots.filter(s => new Date(s.date) >= cutoff)
  })()

  const data = filtered.map(s => s.total_value)
  const min = Math.min(...(data.length ? data : [0]))
  const max = Math.max(...(data.length ? data : [1]))
  const range_ = max - min || 1
  const W = 800; const H = 200
  const pts = data.map((v, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * W : W / 2
    const y = H - ((v - min) / range_) * (H - 12) - 6
    return `${x},${y}`
  })
  const ptsStr = pts.join(" ")
  const fillStr = pts.length ? `${ptsStr} ${W},${H} 0,${H}` : `0,${H} ${W},${H}`

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)',
          borderRadius: 20,
          boxShadow: 'var(--neu-raised-lg)',
          padding: 28,
          width: 'min(700px, 90vw)',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            Equity Curve
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(["1M", "3M", "1Y", "All"] as TimeRange[]).map(r => (
              <button type="button" key={r} onClick={() => setRange(r)}
                style={{
                  padding: "3px 12px", borderRadius: "var(--r-pill)",
                  fontSize: "11px", fontWeight: 600,
                  fontFamily: "var(--font-mono)",
                  border: "none",
                  background: range === r ? "var(--bg)" : "transparent",
                  boxShadow: range === r ? "var(--neu-inset)" : "none",
                  color: range === r ? "var(--accent)" : "var(--text-dim)",
                  cursor: "pointer", transition: "all 0.2s"
                }}>{r}</button>
            ))}
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--bg-surface)',
                boxShadow: 'var(--neu-raised-sm)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-dim)', marginLeft: 4
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Chart */}
        <div style={{ background: 'var(--bg)', boxShadow: 'var(--neu-inset)', borderRadius: 12, padding: '16px 8px 8px' }}>
          {data.length < 2 ? (
            <div style={{
              height: "300px", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "12px", color: "var(--text-mute)", fontFamily: "var(--font-mono)"
            }}>
              No snapshot data available
            </div>
          ) : (
            <svg width="100%" height="300" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id="modalCurveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(45,212,191,0.15)" />
                  <stop offset="100%" stopColor="rgba(45,212,191,0)" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map(f => (
                <line key={f} x1="0" y1={H * f} x2={W} y2={H * f}
                  stroke="var(--border)" strokeWidth="0.5" />
              ))}
              <polyline points={fillStr} fill="url(#modalCurveGrad)" stroke="none" />
              <polyline points={ptsStr} fill="none" stroke="#2dd4bf" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        {/* Footer */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-mute)',
          textAlign: 'center', marginTop: 12
        }}>
          Click anywhere outside to close
        </div>
      </div>
    </div>
  )
}

/* ─── Sector Allocation Modal ────────────────────── */
function SectorModal({ holdings, onClose }: { holdings: Holding[]; onClose: () => void }) {
  const sectors = computeSectors(holdings)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)',
          borderRadius: 20,
          boxShadow: 'var(--neu-raised-lg)',
          padding: 28,
          width: 'min(500px, 90vw)',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            Sector Allocation
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--bg-surface)',
              boxShadow: 'var(--neu-raised-sm)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-dim)'
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Sector rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sectors.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-mute)', fontSize: 13, padding: '24px 0' }}>
              No holdings data
            </div>
          ) : sectors.map(({ key, value, count, pct }) => (
            <div key={key}>
              {/* Row 1: name + count chip + value */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    {key}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    background: 'rgba(45,212,191,0.1)', color: 'var(--accent)',
                    borderRadius: 20, padding: '2px 8px'
                  }}>
                    {count} stock{count !== 1 ? 's' : ''}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>
                  {fmt(value)}
                </span>
              </div>
              {/* Bar */}
              <div style={{ height: 6, background: 'rgba(0,0,0,0.07)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{
                  width: `${pct}%`, height: '100%', borderRadius: 3,
                  background: 'rgba(45,212,191,0.8)',
                  transition: 'width 0.5s'
                }} />
              </div>
              {/* Sub-row */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                  {pct.toFixed(1)}%
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>
                  {fmt(value)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-mute)',
          textAlign: 'center', marginTop: 20
        }}>
          Click anywhere outside to close
        </div>
      </div>
    </div>
  )
}

/* ─── SectorAllocationCard (compact sidebar) ─────── */
function SectorAllocationCard({
  holdings, onOpenModal
}: { holdings: Holding[]; onOpenModal: () => void }) {
  const entries = computeSectors(holdings)

  return (
    <div style={{
      background: 'var(--bg-surface)',
      boxShadow: 'var(--neu-raised)',
      borderRadius: 16,
      overflow: "hidden"
    }}>
      <div style={{ padding: "14px 18px 12px", display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          fontSize: "10px", fontWeight: 400, letterSpacing: "1px",
          textTransform: "uppercase", color: "var(--text-mute)", fontFamily: "var(--font-mono)"
        }}>
          Sector Allocation
        </div>
        {entries.length > 0 && (
          <button
            onClick={onOpenModal}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              background: 'rgba(45,212,191,0.1)', color: 'var(--accent)',
              borderRadius: 20, padding: '2px 8px',
              border: 'none', cursor: 'pointer'
            }}
          >
            {entries.length} sectors
          </button>
        )}
      </div>
      <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {entries.length === 0 ? (
          <div style={{ fontSize: "12px", color: "var(--text-mute)", textAlign: "center", padding: "20px 0" }}>
            No holdings data
          </div>
        ) : entries.map(({ key, pct }) => (
          <div key={key}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>{key}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 600, color: "var(--accent)" }}>
                {pct.toFixed(1)}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', boxShadow: 'var(--neu-inset)', background: 'var(--bg)' }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 3,
                background: 'var(--accent)', opacity: 0.75, transition: "width 0.5s"
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Highlights Card ────────────────────────────── */
function HighlightsCard({ holdings }: { holdings: Holding[] }) {
  const rows: Array<{
    label: string
    pick: (hs: Holding[]) => Holding | null
    valFn: (h: Holding) => string
    color: string
  }> = [
    {
      label: "Top Holding",
      pick: hs => hs.length ? hs.reduce((b, h) => (h.current_value ?? 0) > (b.current_value ?? 0) ? h : b, hs[0]) : null,
      valFn: h => fmt(h.current_value),
      color: "var(--text)"
    },
    {
      label: "Best Return",
      pick: hs => hs.length ? hs.reduce((b, h) => (h.pnl_pct ?? -Infinity) > (b.pnl_pct ?? -Infinity) ? h : b, hs[0]) : null,
      valFn: h => fmtPct(h.pnl_pct),
      color: "var(--green)"
    },
    {
      label: "Worst Return",
      pick: hs => hs.length ? hs.reduce((b, h) => (h.pnl_pct ?? Infinity) < (b.pnl_pct ?? Infinity) ? h : b, hs[0]) : null,
      valFn: h => fmtPct(h.pnl_pct),
      color: "var(--red)"
    },
    {
      label: "Day Gainer",
      pick: hs => {
        const w = hs.filter(h => h.day_change != null)
        return w.length ? w.reduce((b, h) => (h.day_change ?? -Infinity) > (b.day_change ?? -Infinity) ? h : b, w[0]) : null
      },
      valFn: h => h.day_change != null ? `+${fmt(h.day_change)}` : "—",
      color: "var(--green)"
    },
    {
      label: "Day Loser",
      pick: hs => {
        const w = hs.filter(h => h.day_change != null)
        return w.length ? w.reduce((b, h) => (h.day_change ?? Infinity) < (b.day_change ?? Infinity) ? h : b, w[0]) : null
      },
      valFn: h => h.day_change != null ? fmt(h.day_change) : "—",
      color: "var(--red)"
    }
  ]

  return (
    <div style={{
      background: 'var(--bg-surface)',
      boxShadow: 'var(--neu-raised)',
      borderRadius: 16,
      overflow: "hidden",
      height: "100%",
      display: "flex",
      flexDirection: "column"
    }}>
      <div style={{ padding: "14px 18px 12px" }}>
        <div style={{
          fontSize: "10px", fontWeight: 400, letterSpacing: "1px",
          textTransform: "uppercase", color: "var(--text-mute)", fontFamily: "var(--font-mono)"
        }}>Highlights</div>
      </div>
      <div style={{ padding: "0 18px 4px" }}>
        {rows.map((row, i) => {
          const h = holdings.length ? row.pick(holdings) : null
          return (
            <div key={row.label} style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              alignItems: "center", padding: "9px 0",
              borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none"
            }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 400,
                textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-mute)"
              }}>{row.label}</span>
              <span style={{
                fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600,
                color: "var(--accent)", textAlign: "center"
              }}>{h ? displaySym(h.symbol) : "—"}</span>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 600,
                color: h ? row.color : "var(--text-mute)", textAlign: "right"
              }}>{h ? row.valFn(h) : "—"}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── HoldingsTable ──────────────────────────────── */
function HoldingsTable({
  holdings, accountMap
}: {
  holdings: Holding[]
  accountMap: Record<string, string>
}) {
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const saved = localStorage.getItem(LS_SORT_KEY)
    return (saved as SortKey) || "symbol"
  })
  const [sortAsc, setSortAsc] = useState<boolean>(() => {
    const saved = localStorage.getItem(LS_SORT_KEY + "_asc")
    return saved !== null ? saved === "true" : true
  })

  const TEXT_KEYS: SortKey[] = ["symbol", "account"]

  const toggleSort = (key: SortKey) => {
    const nextAsc = sortKey === key ? !sortAsc : TEXT_KEYS.includes(key)
    setSortKey(key)
    setSortAsc(nextAsc)
    localStorage.setItem(LS_SORT_KEY, key)
    localStorage.setItem(LS_SORT_KEY + "_asc", String(nextAsc))
  }

  const sorted = [...holdings].sort((a, b) => {
    let va: number | string = 0; let vb: number | string = 0
    if      (sortKey === "symbol")        { va = displaySym(a.symbol);    vb = displaySym(b.symbol) }
    else if (sortKey === "qty")           { va = a.qty;                   vb = b.qty }
    else if (sortKey === "avg_price")     { va = a.avg_price;             vb = b.avg_price }
    else if (sortKey === "ltp")           { va = a.ltp ?? 0;             vb = b.ltp ?? 0 }
    else if (sortKey === "pnl")           { va = a.pnl ?? 0;             vb = b.pnl ?? 0 }
    else if (sortKey === "pnl_pct")       { va = a.pnl_pct ?? 0;         vb = b.pnl_pct ?? 0 }
    else if (sortKey === "day_change")    { va = a.day_change ?? 0;       vb = b.day_change ?? 0 }
    else if (sortKey === "current_value") { va = a.current_value ?? 0;   vb = b.current_value ?? 0 }
    else if (sortKey === "account") {
      va = accountMap[a.account_id] ?? a.account_id
      vb = accountMap[b.account_id] ?? b.account_id
    }
    if (typeof va === "string") return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
    return sortAsc ? va - (vb as number) : (vb as number) - va
  })

  const sortDir = (k: SortKey): 'asc' | 'desc' | null => sortKey === k ? (sortAsc ? 'asc' : 'desc') : null

  if (holdings.length === 0) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "var(--text-mute)", fontSize: "13px" }}>
        No holdings found for this filter
      </div>
    )
  }

  const numStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: "12px", textAlign: "center"
  }

  return (
    <table className="ix-table">
        <thead>
          <tr>
            <SortableHeader label="Stock"     sortKey="symbol"        currentKey={sortKey} currentDir={sortDir("symbol")}        onSort={k => toggleSort(k as SortKey)} align="left" />
            <SortableHeader label="Qty"       sortKey="qty"           currentKey={sortKey} currentDir={sortDir("qty")}           onSort={k => toggleSort(k as SortKey)} />
            <SortableHeader label="Avg Price" sortKey="avg_price"     currentKey={sortKey} currentDir={sortDir("avg_price")}     onSort={k => toggleSort(k as SortKey)} />
            <SortableHeader label="LTP"       sortKey="ltp"           currentKey={sortKey} currentDir={sortDir("ltp")}           onSort={k => toggleSort(k as SortKey)} />
            <SortableHeader label="P&L"       sortKey="pnl"           currentKey={sortKey} currentDir={sortDir("pnl")}           onSort={k => toggleSort(k as SortKey)} />
            <SortableHeader label="P&L%"      sortKey="pnl_pct"       currentKey={sortKey} currentDir={sortDir("pnl_pct")}       onSort={k => toggleSort(k as SortKey)} />
            <SortableHeader label="Day Chg"   sortKey="day_change"    currentKey={sortKey} currentDir={sortDir("day_change")}    onSort={k => toggleSort(k as SortKey)} />
            <SortableHeader label="Account"   sortKey="account"       currentKey={sortKey} currentDir={sortDir("account")}       onSort={k => toggleSort(k as SortKey)} />
          </tr>
        </thead>
        <tbody>
          {sorted.map(h => {
            const sym = displaySym(h.symbol)
            const acct = accountMap[h.account_id] ?? h.account_id.slice(0, 8)
            return (
              <tr key={h.id}>
                <td style={{ textAlign: "left" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--accent)", fontSize: "13px" }}>{sym}</span>
                </td>
                <td style={numStyle}>{h.qty}</td>
                <td style={numStyle}>
                  ₹{h.avg_price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </td>
                <td style={{ ...numStyle, color: "var(--text)" }}>
                  {h.ltp ? `₹${h.ltp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—"}
                </td>
                <td style={{
                  ...numStyle,
                  color: h.pnl != null ? (h.pnl >= 0 ? "var(--green)" : "var(--red)") : "var(--text-mute)"
                }}>
                  {h.pnl != null ? `${h.pnl >= 0 ? "+" : ""}${fmt(h.pnl)}` : "—"}
                </td>
                <td style={{
                  ...numStyle,
                  color: h.pnl_pct != null ? (h.pnl_pct >= 0 ? "var(--green)" : "var(--red)") : "var(--text-mute)"
                }}>
                  {fmtPct(h.pnl_pct)}
                </td>
                <td style={{
                  ...numStyle,
                  color: h.day_change != null ? (h.day_change >= 0 ? "var(--green)" : "var(--red)") : "var(--text-mute)"
                }}>
                  {h.day_change != null ? `${h.day_change >= 0 ? "+" : ""}${fmt(h.day_change)}` : "—"}
                </td>
                <td style={{ ...numStyle, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--accent)" }}>
                  {acct}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot><tr><td colSpan={8} style={{ height: 14, padding: 0, border: 'none' }} /></tr></tfoot>
      </table>
  )
}

/* ─── MF Table ───────────────────────────────────── */
function MFTable({ mf }: { mf: MFHolding[] }) {
  const { sorted, sortKey: mfSortKey, sortDir: mfSortDir, handleSort: handleMFSort } = useSort<MFHolding>(mf, 'pnl')
  if (mf.length === 0) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "var(--text-mute)", fontSize: "13px" }}>
        No mutual fund holdings found
      </div>
    )
  }
  const numStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: "12px", textAlign: "center"
  }
  return (
    <table className="ix-table">
        <thead>
          <tr>
            <SortableHeader label="Fund"          sortKey="fund_name"       currentKey={mfSortKey as string | null} currentDir={mfSortDir} onSort={k => handleMFSort(k as keyof MFHolding)} align="left" />
            <SortableHeader label="Units"         sortKey="units"           currentKey={mfSortKey as string | null} currentDir={mfSortDir} onSort={k => handleMFSort(k as keyof MFHolding)} />
            <SortableHeader label="NAV"           sortKey="nav"             currentKey={mfSortKey as string | null} currentDir={mfSortDir} onSort={k => handleMFSort(k as keyof MFHolding)} />
            <SortableHeader label="Invested"      sortKey="invested_amount" currentKey={mfSortKey as string | null} currentDir={mfSortDir} onSort={k => handleMFSort(k as keyof MFHolding)} />
            <SortableHeader label="Current Value" sortKey="current_value"   currentKey={mfSortKey as string | null} currentDir={mfSortDir} onSort={k => handleMFSort(k as keyof MFHolding)} />
            <SortableHeader label="P&L"           sortKey="pnl"             currentKey={mfSortKey as string | null} currentDir={mfSortDir} onSort={k => handleMFSort(k as keyof MFHolding)} />
          </tr>
        </thead>
        <tbody>
          {sorted.map(f => (
            <tr key={f.id}>
              <td style={{ textAlign: "left" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--accent)", fontSize: "12px" }}>{f.fund_name}</span>
              </td>
              <td style={numStyle}>{f.units.toFixed(3)}</td>
              <td style={numStyle}>{f.nav ? `₹${f.nav.toFixed(2)}` : "—"}</td>
              <td style={numStyle}>{fmt(f.invested_amount)}</td>
              <td style={numStyle}>{fmt(f.current_value)}</td>
              <td style={{
                ...numStyle,
                color: f.pnl != null ? (f.pnl >= 0 ? "var(--green)" : "var(--red)") : "var(--text-mute)"
              }}>
                {f.pnl != null ? `${f.pnl >= 0 ? "+" : ""}${fmt(f.pnl)}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={6} style={{ height: 14, padding: 0, border: 'none' }} /></tr></tfoot>
      </table>
  )
}

/* ─── Main Page ──────────────────────────────────── */
export default function PortfolioPage() {
  const { token } = useAuth()
  const [summary, setSummary]     = useState<Summary | null>(() => readCache()?.summary ?? null)
  const [holdings, setHoldings]   = useState<Holding[]>(() => readCache()?.holdings ?? [])
  const [mf, setMF]               = useState<MFHolding[]>(() => readCache()?.mf ?? [])
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => readCache()?.snapshots ?? [])
  const [accountMap, setAccountMap] = useState<Record<string, string>>({})
  const [loading, setLoading]     = useState(() => readCache() === null)
  const [syncing, setSyncing]     = useState(false)
  const [activeTab, setActiveTab]   = useState<ActiveTab>("equity")
  const [activeAccount, setActiveAccount] = useState("All")
  const [showEquityModal, setShowEquityModal] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    if (!token) return
    const acctPromise = apiFetch(`/api/v1/accounts/`)
      .then(async r => {
        if (!r.ok) return
        const accts: Array<{ id: string; nickname: string }> = await r.json()
        const map: Record<string, string> = {}
        accts.forEach(a => { map[a.id] = a.nickname })
        setAccountMap(map)
      })
      .catch(() => { /* INVEX accounts endpoint may be unavailable */ })

    const portfolioPromise = Promise.all([
      portfolioAPI.summary(),
      portfolioAPI.holdings(),
      portfolioAPI.mf(),
      portfolioAPI.snapshots(),
    ]).then(([s, h, m, snap]) => {
      const data: PortfolioCache = {
        summary: s.data,
        holdings: h.data || [],
        mf: m.data || [],
        snapshots: snap.data || []
      }
      setSummary(data.summary)
      setHoldings(data.holdings)
      setMF(data.mf)
      setSnapshots(data.snapshots)
      writeCache(data)
    }).catch(() => { /* data might be empty */ })

    await Promise.all([acctPromise, portfolioPromise])
  }, [token])

  useEffect(() => {
    if (!token) return
    if (readCache() !== null) {
      setSyncing(true)
      load().finally(() => setSyncing(false))
    } else {
      load().finally(() => setLoading(false))
    }
    // auto-refresh every 60s
    const interval = setInterval(() => {
      setSyncing(true)
      load().finally(() => setSyncing(false))
    }, 60_000)
    return () => clearInterval(interval)
  }, [load, token])

  // Build sorted unique nickname list from the live accountMap
  const accountChips = ["All", ...Array.from(new Set(Object.values(accountMap))).sort()]

  const filteredHoldings = activeAccount === "All"
    ? holdings
    : holdings.filter(h =>
        (accountMap[h.account_id] || "").toLowerCase() === activeAccount.toLowerCase()
      )

  const filteredMF = activeAccount === "All"
    ? mf
    : mf.filter(f =>
        (accountMap[f.account_id ?? ""] || "").toLowerCase() === activeAccount.toLowerCase()
      )

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div style={{ padding: "20px 0" }}>
        <div style={{ marginBottom: "16px" }}>
          <div style={{ height: "32px", width: "180px", background: "rgba(0,0,0,0.07)", borderRadius: "6px", marginBottom: "8px", animation: "pulseLive 1.5s ease-in-out infinite" }} />
          <div style={{ height: "12px", width: "140px", background: "rgba(0,0,0,0.05)", borderRadius: "4px", animation: "pulseLive 1.5s ease-in-out infinite" }} />
        </div>
        <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-mute)", fontSize: "12px", fontFamily: "var(--font-mono)", gap: "8px",
          padding: "40px 0"
        }}>
          <ArrowsClockwise size={16} style={{ animation: "spin 1s linear infinite" }} />
          Fetching holdings...
        </div>
      </div>
    )
  }

  /* ── Main layout ── */
  return (
    <div style={{ animation: "fadeUp 400ms cubic-bezier(0,0,0.2,1) both" }}>

      {/* ══ HEADER ══ */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, margin: 0 }}>
            Portfolio
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 3, fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {filteredHoldings.length} stocks · {filteredMF.length} funds
            {syncing && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--accent)", animation: "pulseLive 2s ease-out infinite", display: "inline-block" }} />
                syncing
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/analysis")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "var(--bg-surface)",
            boxShadow: "var(--neu-raised-sm)",
            border: "none",
            borderRadius: "var(--r-pill)",
            padding: "8px 18px",
            fontSize: 12, fontWeight: 600,
            fontFamily: "var(--font-body)",
            color: "var(--accent)",
            cursor: "pointer",
            transition: "box-shadow 0.15s"
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--neu-raised)" }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--neu-raised-sm)" }}
        >
          View Portfolio Analysis
          <ArrowRight size={14} weight="bold" />
        </button>
      </div>

      {/* ══ ROW 1: KPI STRIP ══ */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", paddingTop: "20px" }}>
        <KPICard
          label="Portfolio Value"
          value={summary ? fmt(summary.total_portfolio_value) : "—"}
          hint="view chart →"
          onClick={() => setShowEquityModal(true)}
        />
        <KPICard
          label="Invested"
          value={summary ? fmt(summary.total_invested) : "—"}
        />
        <KPICard
          label="Total P&L"
          value={summary ? `${summary.total_pnl >= 0 ? "+" : ""}${fmt(summary.total_pnl)}` : "—"}
          valueColor={pnlColor(summary?.total_pnl)}
        />
        <KPICard
          label="Return %"
          value={summary ? fmtPct(summary.total_pnl_pct) : "—"}
          valueColor={pnlColor(summary?.total_pnl_pct)}
        />
        <KPICard
          label="Day P&L"
          value={summary ? `${(summary.day_pnl ?? 0) >= 0 ? "+" : ""}${fmt(summary.day_pnl)}` : "—"}
          valueColor={pnlColor(summary?.day_pnl)}
        />
      </div>

      {/* ══ ROW 2: HOLDINGS TABLE (full width) ══ */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>

        {/* Holdings table — full width */}
        <div style={{ flex: 1 }}>
          <div style={{
            background: 'var(--bg-surface)',
            boxShadow: 'var(--neu-raised)',
            borderRadius: 'var(--r-lg)',
            padding: 20,
          }}>
            {/* Table header: sliding pill tabs + account filter chips */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 16,
            }}>
              {/* Segmented pill tab — animated slider */}
              <div style={{
                position: "relative",
                display: "grid", gridTemplateColumns: "1fr 1fr",
                background: "var(--bg)", boxShadow: "var(--neu-inset)",
                borderRadius: "var(--r-pill)", padding: 3
              }}>
                {/* Slider pill — translateX(100%) = one cell width */}
                <div style={{
                  position: "absolute",
                  top: 3, bottom: 3, left: 3,
                  width: "calc(50% - 3px)",
                  background: "var(--bg-surface)",
                  boxShadow: "var(--neu-raised-sm)",
                  borderRadius: "var(--r-pill)",
                  transform: activeTab === "equity" ? "translateX(0)" : "translateX(100%)",
                  transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)"
                }} />
                {(["equity", "mf"] as ActiveTab[]).map(tab => (
                  <button type="button" key={tab} onClick={() => setActiveTab(tab)}
                    style={{
                      position: "relative", zIndex: 1,
                      padding: "6px 22px",
                      fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600,
                      background: "transparent", border: "none",
                      borderRadius: "var(--r-pill)",
                      color: activeTab === tab ? "var(--accent)" : "var(--text-mute)",
                      cursor: "pointer", transition: "color 0.22s",
                      whiteSpace: "nowrap", textAlign: "center"
                    }}>
                    {tab === "equity" ? "Equity" : "Mutual Funds"}
                  </button>
                ))}
              </div>

              {/* Account filter chips */}
              <div style={{ display: "flex", gap: 6 }}>
                {accountChips.map(acct => (
                  <button type="button" key={acct} onClick={() => setActiveAccount(acct)}
                    style={{
                      padding: "4px 14px",
                      borderRadius: "var(--r-pill)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11, fontWeight: 700,
                      letterSpacing: "0.5px",
                      border: "none",
                      background: "var(--bg)",
                      boxShadow: activeAccount === acct ? "var(--neu-inset)" : "var(--neu-raised-sm)",
                      color: activeAccount === acct ? "var(--accent)" : "var(--text-mute)",
                      cursor: "pointer", transition: "box-shadow 0.18s, color 0.18s"
                    }}>
                    {acct.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Table — no inner inset box, scrollbar hidden */}
            <div className="scroll-hidden" style={{ overflowX: "auto", overflowY: "auto", maxHeight: "620px" }}>
              {activeTab === "equity"
                ? <HoldingsTable holdings={filteredHoldings} accountMap={accountMap} />
                : <MFTable mf={filteredMF} />
              }
            </div>
          </div>
        </div>

      </div>


      {/* ══ MODALS ══ */}
      {showEquityModal && (
        <EquityCurveModal snapshots={snapshots} onClose={() => setShowEquityModal(false)} />
      )}

    </div>
  )
}
