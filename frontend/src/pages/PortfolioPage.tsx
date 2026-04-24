import { useState, useEffect, useCallback } from "react"
import { ArrowsClockwise } from "@phosphor-icons/react"
import { portfolioAPI } from "../services/api"

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
type SortKey = "symbol" | "pnl" | "pnl_pct" | "current_value"

const ACCOUNTS = ["All", "Karthik", "Mom", "Wife"]
const LS_SORT_KEY = "invex_holdings_sort"
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
const displaySym = (s: string) => s.replace(/-EQ$/i, "").replace(/-BE$/i, "")

const fmt = (n?: number) =>
  n != null ? `₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"
const fmtPct = (n?: number) =>
  n != null ? `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` : "—"
const pnlColor = (n?: number) =>
  !n ? "var(--text-mute)" : n >= 0 ? "var(--green)" : "var(--red)"

/* ─── MetricCard ─────────────────────────────────── */
function MetricCard({
  label, value, sub, valueColor, sparkline,
}: {
  label: string; value: string; sub?: string
  valueColor?: string; sparkline?: number[]
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
      {sparkline && sparkline.length > 1 && (
        <MiniSparkline data={sparkline} />
      )}
    </div>
  )
}

function MiniSparkline({ data }: { data: number[] }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const W = 120; const H = 32
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((v - min) / range) * (H - 4) - 2
    return `${x},${y}`
  }).join(" ")
  const fill = `${pts} ${W},${H} 0,${H}`
  return (
    <svg width="100%" height="32" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ display: "block", marginTop: "10px" }}>
      <polyline points={fill} fill="rgba(45,212,191,0.08)" stroke="none" />
      <polyline points={pts} fill="none" stroke="#2dd4bf" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ─── SkeletonCard ───────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      boxShadow: 'var(--neu-raised)',
      borderRadius: 'var(--r-lg)',
      border: '1px solid var(--border)',
      padding: "18px 18px 16px",
    }}>
      <div style={{ height: "10px", width: "55%", background: "rgba(0,0,0,0.06)", borderRadius: "3px", marginBottom: "12px", animation: "pulseLive 1.5s ease-in-out infinite" }} />
      <div style={{ height: "22px", width: "70%", background: "rgba(0,0,0,0.09)", borderRadius: "4px", animation: "pulseLive 1.5s ease-in-out infinite" }} />
    </div>
  )
}

/* ─── InsightCard ────────────────────────────────── */
function InsightCard({
  title, holdings, pick, subFn, subColor,
}: {
  title: string
  holdings: Holding[]
  pick: (hs: Holding[]) => Holding | null
  subFn: (h: Holding) => string
  subColor: string
}) {
  const h = holdings.length ? pick(holdings) : null
  return (
    <div style={{
      background: 'var(--bg-surface)',
      boxShadow: 'var(--neu-raised-sm)',
      borderRadius: 'var(--r-md)',
      border: '1px solid var(--border)',
      padding: "10px 14px", overflow: "hidden",
      display: "flex", flexDirection: "column", justifyContent: "center",
      height: "100%", boxSizing: "border-box",
    }}>
      <div style={{
        fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "var(--text-mute)",
        fontFamily: "var(--font-mono)", marginBottom: "8px",
      }}>{title}</div>
      <div style={{
        fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: 700,
        color: "var(--accent)", letterSpacing: "-0.3px", lineHeight: 1.2,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {h ? displaySym(h.symbol) : "—"}
      </div>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: "11px",
        color: h ? subColor : "var(--text-mute)", marginTop: "4px",
      }}>
        {h ? subFn(h) : "—"}
      </div>
    </div>
  )
}

/* ─── SectorAllocation ───────────────────────────── */
const SECTOR_PALETTE = [
  "#2dd4bf", "#4488FF", "#F59E0B", "#FF6B6B", "#A78BFA",
  "#34D399", "#FB923C", "#38BDF8", "#F472B6", "#9CA3AF",
]

function SectorAllocation({ holdings }: { holdings: Holding[] }) {
  const grouped: Record<string, number> = {}
  let total = 0
  for (const h of holdings) {
    const key = h.sector || "Others"
    const val = h.current_value ?? h.invested_value
    grouped[key] = (grouped[key] ?? 0) + val
    total += val
  }
  const allKeys = Object.keys(grouped).sort()
  const colorMap: Record<string, string> = {}
  allKeys.forEach((k, i) => { colorMap[k] = SECTOR_PALETTE[i % SECTOR_PALETTE.length] })

  const entries = Object.entries(grouped)
    .map(([k, v]) => ({ key: k, value: v, pct: total > 0 ? (v / total) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct)

  return (
    <div style={{
      background: 'var(--bg-surface)',
      boxShadow: 'var(--neu-raised)',
      borderRadius: 'var(--r-lg)',
      border: '1px solid var(--border)',
      overflow: "hidden",
    }}>
      <div style={{ padding: "14px 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-mute)", fontFamily: "var(--font-mono)" }}>
          Sector Allocation
        </div>
      </div>
      <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {entries.length === 0 ? (
          <div style={{ fontSize: "12px", color: "var(--text-mute)", textAlign: "center", padding: "20px 0" }}>
            No holdings data
          </div>
        ) : entries.map(({ key, pct }) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
              background: colorMap[key],
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>{key}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent)" }}>
                  {pct.toFixed(1)}%
                </span>
              </div>
              <div style={{ height: "4px", borderRadius: "2px", background: "rgba(0,0,0,0.08)" }}>
                <div style={{ width: `${pct}%`, height: "4px", borderRadius: "2px", background: colorMap[key], transition: "width 0.5s" }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── EquityCurve ─── */
type TimeRange = "1M" | "3M" | "1Y" | "All"

function EquityCurve({ snapshots }: { snapshots: Snapshot[] }) {
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
  const W = 400; const H = 100
  const pts = data.map((v, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * W : W / 2
    const y = H - ((v - min) / range_) * (H - 8) - 4
    return `${x},${y}`
  })
  const ptsStr = pts.join(" ")
  const fillStr = pts.length ? `${ptsStr} ${W},${H} 0,${H}` : `0,${H} ${W},${H}`

  return (
    <div style={{
      background: 'var(--bg-surface)',
      boxShadow: 'var(--neu-raised)',
      borderRadius: 'var(--r-lg)',
      border: '1px solid var(--border)',
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px 10px",
      }}>
        <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-mute)", fontFamily: "var(--font-mono)" }}>
          Equity Curve
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          {(["1M", "3M", "1Y", "All"] as TimeRange[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              style={{
                padding: "3px 10px", borderRadius: "var(--r-pill)",
                fontSize: "11px", fontWeight: 600,
                fontFamily: "var(--font-body)",
                border: "none",
                background: range === r ? "var(--bg)" : "transparent",
                boxShadow: range === r ? "var(--neu-inset)" : "none",
                color: range === r ? "var(--accent)" : "var(--text-dim)",
                cursor: "pointer", transition: "all 0.2s",
              }}>{r}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: "10px 18px 16px" }}>
        {data.length < 2 ? (
          <div style={{
            height: "100px", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "12px", color: "var(--text-mute)",
          }}>
            No snapshot data available
          </div>
        ) : (
          <svg width="100%" height="100" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(45,212,191,0.18)" />
                <stop offset="100%" stopColor="rgba(45,212,191,0)" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map(f => (
              <line key={f} x1="0" y1={H * f} x2={W} y2={H * f}
                stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />
            ))}
            <polyline points={fillStr} fill="url(#curveGrad)" stroke="none" />
            <polyline points={ptsStr} fill="none" stroke="#2dd4bf" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  )
}

/* ─── HoldingsTable ──────────────────────────────── */
function HoldingsTable({
  holdings, accountMap,
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

  const toggleSort = (key: SortKey) => {
    let nextAsc: boolean
    if (sortKey === key) {
      nextAsc = !sortAsc
    } else {
      nextAsc = key === "symbol"
    }
    setSortKey(key)
    setSortAsc(nextAsc)
    localStorage.setItem(LS_SORT_KEY, key)
    localStorage.setItem(LS_SORT_KEY + "_asc", String(nextAsc))
  }

  const sorted = [...holdings].sort((a, b) => {
    let va: number | string = 0; let vb: number | string = 0
    if (sortKey === "symbol") { va = displaySym(a.symbol); vb = displaySym(b.symbol) }
    else if (sortKey === "pnl") { va = a.pnl ?? 0; vb = b.pnl ?? 0 }
    else if (sortKey === "pnl_pct") { va = a.pnl_pct ?? 0; vb = b.pnl_pct ?? 0 }
    else if (sortKey === "current_value") { va = a.current_value ?? 0; vb = b.current_value ?? 0 }
    if (typeof va === "string") return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
    return sortAsc ? va - (vb as number) : (vb as number) - va
  })

  const SortIcon = ({ k }: { k: SortKey }) => (
    <span style={{ opacity: sortKey === k ? 1 : 0.3, marginLeft: "3px", fontSize: "9px" }}>
      {sortKey === k ? (sortAsc ? "▲" : "▼") : "▼"}
    </span>
  )

  if (holdings.length === 0) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "var(--text-mute)", fontSize: "13px" }}>
        No holdings found for this filter
      </div>
    )
  }

  const numStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: "12px", textAlign: "center",
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="ix-table">
        <thead>
          <tr>
            <th onClick={() => toggleSort("symbol")}
              style={{ cursor: "pointer", textAlign: "left" }}>
              Stock <SortIcon k="symbol" />
            </th>
            <th style={{ textAlign: "center" }}>Qty</th>
            <th style={{ textAlign: "center" }}>Avg Price</th>
            <th style={{ textAlign: "center" }}>LTP</th>
            <th onClick={() => toggleSort("pnl")}
              style={{ cursor: "pointer", textAlign: "center" }}>
              P&amp;L <SortIcon k="pnl" />
            </th>
            <th onClick={() => toggleSort("pnl_pct")}
              style={{ cursor: "pointer", textAlign: "center" }}>
              P&amp;L% <SortIcon k="pnl_pct" />
            </th>
            <th style={{ textAlign: "center" }}>Day Chg</th>
            <th style={{ textAlign: "center" }}>Account</th>
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
                  color: h.pnl != null ? (h.pnl >= 0 ? "var(--green)" : "var(--red)") : "var(--text-mute)",
                }}>
                  {h.pnl != null ? `${h.pnl >= 0 ? "+" : ""}${fmt(h.pnl)}` : "—"}
                </td>
                <td style={{
                  ...numStyle,
                  color: h.pnl_pct != null ? (h.pnl_pct >= 0 ? "var(--green)" : "var(--red)") : "var(--text-mute)",
                }}>
                  {fmtPct(h.pnl_pct)}
                </td>
                <td style={{
                  ...numStyle,
                  color: h.day_change != null ? (h.day_change >= 0 ? "var(--green)" : "var(--red)") : "var(--text-mute)",
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
      </table>
    </div>
  )
}

/* ─── MF Table ───────────────────────────────────── */
function MFTable({ mf }: { mf: MFHolding[] }) {
  if (mf.length === 0) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "var(--text-mute)", fontSize: "13px" }}>
        No mutual fund holdings found
      </div>
    )
  }
  const numStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: "12px", textAlign: "center",
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="ix-table">
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Fund</th>
            <th style={{ textAlign: "center" }}>Units</th>
            <th style={{ textAlign: "center" }}>NAV</th>
            <th style={{ textAlign: "center" }}>Invested</th>
            <th style={{ textAlign: "center" }}>Current Value</th>
            <th style={{ textAlign: "center" }}>P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {mf.map(f => (
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
                color: f.pnl != null ? (f.pnl >= 0 ? "var(--green)" : "var(--red)") : "var(--text-mute)",
              }}>
                {f.pnl != null ? `${f.pnl >= 0 ? "+" : ""}${fmt(f.pnl)}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────── */
type ActiveTab = "equity" | "mf"

export default function PortfolioPage() {
  const [summary, setSummary]     = useState<Summary | null>(() => readCache()?.summary ?? null)
  const [holdings, setHoldings]   = useState<Holding[]>(() => readCache()?.holdings ?? [])
  const [mf, setMF]               = useState<MFHolding[]>(() => readCache()?.mf ?? [])
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => readCache()?.snapshots ?? [])
  const [accountMap, setAccountMap] = useState<Record<string, string>>({})
  const [loading, setLoading]     = useState(() => readCache() === null)
  const [syncing, setSyncing]     = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab]   = useState<ActiveTab>("equity")
  const [activeAccount, setActiveAccount] = useState("All")

  const load = useCallback(async () => {
    const token = localStorage.getItem("staax_token")
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

    const acctPromise = fetch(`${import.meta.env.VITE_STAAX_API_URL || 'https://api.lifexos.co.in'}/api/v1/accounts/`, { headers })
      .then(async r => {
        if (!r.ok) return
        const accts: Array<{ id: string; nickname: string }> = await r.json()
        const map: Record<string, string> = {}
        accts.forEach(a => { map[a.id] = a.nickname })
        setAccountMap(map)
      })
      .catch(() => { /* STAAX may be down */ })

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
        snapshots: snap.data || [],
      }
      setSummary(data.summary)
      setHoldings(data.holdings)
      setMF(data.mf)
      setSnapshots(data.snapshots)
      writeCache(data)
    }).catch(() => { /* data might be empty */ })

    await Promise.all([acctPromise, portfolioPromise])
  }, [])

  useEffect(() => {
    if (readCache() !== null) {
      setSyncing(true)
      load().finally(() => setSyncing(false))
    } else {
      load().finally(() => setLoading(false))
    }
  }, [load])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await portfolioAPI.refresh()
      await load()
    } catch { /* ignore */ }
    finally { setRefreshing(false) }
  }

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

  const sparkData = snapshots.slice(-20).map(s => s.total_value)

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
      <div style={{ padding: "20px 0" }}>
        <div style={{ marginBottom: "16px" }}>
          <div style={{ height: "32px", width: "180px", background: "rgba(0,0,0,0.07)", borderRadius: "6px", marginBottom: "8px", animation: "pulseLive 1.5s ease-in-out infinite" }} />
          <div style={{ height: "12px", width: "140px", background: "rgba(0,0,0,0.05)", borderRadius: "4px", animation: "pulseLive 1.5s ease-in-out infinite" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-mute)", fontSize: "12px", fontFamily: "var(--font-mono)", gap: "8px",
          padding: "40px 0",
        }}>
          <ArrowsClockwise size={16} style={{ animation: "spin 1s linear infinite" }} />
          Fetching holdings...
        </div>
      </div>
    )
  }

  return (
    <div style={{ animation: "fadeUp 400ms cubic-bezier(0,0,0.2,1) both" }}>

      {/* ── Page header ── */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: "20px", paddingTop: "8px",
      }}>
        <div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 800,
            color: "var(--accent)", marginBottom: "4px",
          }}>Portfolio</div>
          <div style={{ fontSize: "12px", color: "var(--text-dim)", display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)" }}>
            {filteredHoldings.length} stocks · {filteredMF.length} funds
            {activeAccount !== "All" && <> · {activeAccount}</>}
            {syncing && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--text-mute)", fontSize: "11px" }}>
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--accent)", animation: "pulseLive 2s ease-out infinite", display: "inline-block" }} />
                syncing
              </span>
            )}
            <span style={{
              padding: "1px 7px", borderRadius: "var(--r-pill)",
              background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)",
              color: "var(--amber)", fontSize: "10px", fontWeight: 700, letterSpacing: "1px",
            }}>BETA</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={btnBase}>
            <svg style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }}
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            style={{ ...btnBase, color: "var(--accent)" }}
            onClick={() => alert('Export coming soon')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* ── 4-column Metric Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
        <MetricCard
          label="Total Portfolio"
          value={summary ? fmt(summary.total_portfolio_value) : "—"}
          sub={summary ? `across 3 accounts` : undefined}
          sparkline={sparkData}
        />
        <MetricCard
          label="Total P&L"
          value={summary ? `${summary.total_pnl >= 0 ? "+" : ""}${fmt(summary.total_pnl)}` : "—"}
          sub={summary ? fmtPct(summary.total_pnl_pct) : undefined}
          valueColor={pnlColor(summary?.total_pnl)}
        />
        <MetricCard
          label="Day P&L"
          value={summary ? `${(summary.day_pnl ?? 0) >= 0 ? "+" : ""}${fmt(summary.day_pnl)}` : "—"}
          valueColor={pnlColor(summary?.day_pnl)}
        />
        <MetricCard
          label="Invested"
          value={summary ? fmt(summary.total_invested) : "—"}
          sub="total cost basis"
        />
      </div>

      {/* ── Tabs + Account filter ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "6px",
        marginBottom: "14px", flexWrap: "wrap",
      }}>
        {(["equity", "mf"] as ActiveTab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: "7px 16px", borderRadius: "var(--r-md)",
              fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600,
              background: activeTab === tab ? "var(--bg)" : "var(--bg-surface)",
              boxShadow: activeTab === tab ? "var(--neu-inset)" : "var(--neu-raised-sm)",
              border: "none",
              color: activeTab === tab ? "var(--accent)" : "var(--text-dim)",
              cursor: "pointer", transition: "all 0.2s",
            }}>
            {tab === "equity" ? "Equity" : "Mutual Funds"}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
          {ACCOUNTS.map(a => (
            <button key={a} onClick={() => setActiveAccount(a)}
              style={{
                padding: "5px 12px", borderRadius: "var(--r-pill)",
                fontSize: "11px", fontWeight: 600,
                fontFamily: "var(--font-body)",
                background: activeAccount === a ? "var(--bg)" : "var(--bg-surface)",
                boxShadow: activeAccount === a ? "var(--neu-inset)" : "var(--neu-raised-sm)",
                border: "none",
                color: activeAccount === a ? "var(--accent)" : "var(--text-dim)",
                cursor: "pointer", transition: "all 0.2s",
              }}>{a}</button>
          ))}
        </div>
      </div>

      {/* ── Insight cards + Sector + Equity Curve — equity tab only ── */}
      {activeTab === "equity" && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 2fr",
          gap: "12px", marginBottom: "14px",
          alignItems: "stretch",
        }}>
          {/* Col 1 — 5 insight cards */}
          <div style={{ display: "grid", gridTemplateRows: "repeat(5, 1fr)", gap: "8px", height: "100%" }}>
            <InsightCard
              title="TOP HOLDING"
              holdings={filteredHoldings}
              pick={hs => hs.reduce((best, h) =>
                (h.current_value ?? 0) > (best.current_value ?? 0) ? h : best
              , hs[0])}
              subFn={h => fmt(h.current_value)}
              subColor="var(--text-dim)"
            />
            <InsightCard
              title="TOP PROFIT"
              holdings={filteredHoldings}
              pick={hs => hs.reduce((best, h) =>
                (h.pnl ?? -Infinity) > (best.pnl ?? -Infinity) ? h : best
              , hs[0])}
              subFn={h => h.pnl != null ? `+${fmt(h.pnl)}` : "—"}
              subColor="var(--green)"
            />
            <InsightCard
              title="TOP LOSS"
              holdings={filteredHoldings}
              pick={hs => hs.reduce((best, h) =>
                (h.pnl ?? Infinity) < (best.pnl ?? Infinity) ? h : best
              , hs[0])}
              subFn={h => h.pnl != null ? fmt(h.pnl) : "—"}
              subColor="var(--red)"
            />
            <InsightCard
              title="TOP GAINER"
              holdings={filteredHoldings}
              pick={hs => {
                const withDay = hs.filter(h => h.day_change != null)
                if (!withDay.length) return null
                return withDay.reduce((best, h) =>
                  (h.day_change ?? -Infinity) > (best.day_change ?? -Infinity) ? h : best
                , withDay[0])
              }}
              subFn={h => h.day_change != null ? `+${fmt(h.day_change)}` : "—"}
              subColor="var(--green)"
            />
            <InsightCard
              title="TOP LOSER"
              holdings={filteredHoldings}
              pick={hs => {
                const withDay = hs.filter(h => h.day_change != null)
                if (!withDay.length) return null
                return withDay.reduce((best, h) =>
                  (h.day_change ?? Infinity) < (best.day_change ?? Infinity) ? h : best
                , withDay[0])
              }}
              subFn={h => h.day_change != null ? fmt(h.day_change) : "—"}
              subColor="var(--red)"
            />
          </div>
          {/* Col 2 — Sector Allocation */}
          <SectorAllocation holdings={filteredHoldings} />
          {/* Col 3 — Equity Curve (2fr) */}
          <EquityCurve snapshots={snapshots} />
        </div>
      )}

      {/* ── Holdings Table ── */}
      {activeTab === "equity" && (
        <div style={{
          background: 'var(--bg-surface)',
          boxShadow: 'var(--neu-raised)',
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)',
          overflow: "hidden",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px 12px",
          }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-mute)", fontFamily: "var(--font-mono)" }}>
              Equity Holdings · {filteredHoldings.length} stocks
            </div>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "4px",
              padding: "2px 8px", borderRadius: "var(--r-pill)",
              fontSize: "10px", fontWeight: 700, fontFamily: "var(--font-mono)",
              background: "var(--bg)", boxShadow: "var(--neu-inset)",
              color: "var(--accent)",
            }}>
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--accent)", animation: "pulseLive 2s ease-out infinite", display: "inline-block" }} />
              Live
            </span>
          </div>
          <div style={{
            margin: "0 12px 12px",
            background: "var(--bg)",
            boxShadow: "var(--neu-inset)",
            borderRadius: "10px",
            overflow: "hidden",
          }}>
            <div style={{ overflowY: "auto", overflowX: "auto", maxHeight: "calc(100vh - 460px)" }}>
              <HoldingsTable holdings={filteredHoldings} accountMap={accountMap} />
            </div>
          </div>
        </div>
      )}

      {/* ── MF ── */}
      {activeTab === "mf" && (
        <div style={{
          background: 'var(--bg-surface)',
          boxShadow: 'var(--neu-raised)',
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)',
          overflow: "hidden",
        }}>
          <div style={{ padding: "14px 18px 12px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-mute)", fontFamily: "var(--font-mono)" }}>
              Mutual Funds · {filteredMF.length} funds
            </div>
          </div>
          <div style={{
            margin: "0 12px 12px",
            background: "var(--bg)",
            boxShadow: "var(--neu-inset)",
            borderRadius: "10px",
            overflow: "hidden",
          }}>
            <div style={{ overflowY: "auto", overflowX: "auto", maxHeight: "calc(100vh - 420px)" }}>
              <MFTable mf={filteredMF} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
