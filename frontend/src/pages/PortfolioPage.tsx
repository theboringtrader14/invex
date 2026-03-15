import { useState, useEffect } from "react"
import { portfolioAPI } from "../services/api"

type Holding = {
  id: string; account_id: string; symbol: string; exchange: string
  qty: number; avg_price: number; ltp?: number
  pnl?: number; pnl_pct?: number; current_value?: number; invested_value: number
  day_change?: number
}
type MFHolding = {
  id: string; fund_name: string; units: number; nav?: number
  invested_amount?: number; current_value?: number; pnl?: number
}
type Summary = {
  total_portfolio_value: number; total_invested: number
  total_pnl: number; total_pnl_pct: number
  day_pnl: number; equity_value: number; mf_value: number
  holdings_count: number; mf_count: number
}

const ACCOUNTS = ["all", "karthik", "mom", "wife"]
const fmt = (n?: number) => n != null ? `₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"
const fmtPct = (n?: number) => n != null ? `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` : "—"
const pnlColor = (n?: number) => !n ? "var(--text-dim)" : n >= 0 ? "var(--green)" : "var(--red)"

function HeroCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="glass-card" style={{ padding: "20px 24px", minWidth: "180px", flex: 1 }}>
      <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-dim)",
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: 700, color: color || "var(--text)",
        fontFamily: "'DM Mono', monospace", letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{sub}</div>}
    </div>
  )
}

export default function PortfolioPage() {
  const [summary, setSummary]     = useState<Summary | null>(null)
  const [holdings, setHoldings]   = useState<Holding[]>([])
  const [mf, setMF]               = useState<MFHolding[]>([])
  const [loading, setLoading]     = useState(true)
  const [activeAccount, setActiveAccount] = useState("all")
  const [activeTab, setActiveTab] = useState<"equity" | "mf">("equity")

  useEffect(() => {
    Promise.all([
      portfolioAPI.summary().then(r => setSummary(r.data)),
      portfolioAPI.holdings().then(r => setHoldings(r.data || [])),
      portfolioAPI.mf().then(r => setMF(r.data || [])),
    ]).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filteredHoldings = activeAccount === "all"
    ? holdings
    : holdings.filter(h => h.account_id.toLowerCase().includes(activeAccount))

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--text-muted)" }}>
      Loading portfolio...
    </div>
  )

  return (
    <div style={{ padding: "24px", animation: "fadeIn 0.3s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontFamily: "'ADLaM Display', serif", fontSize: "24px", fontWeight: 400, marginBottom: "2px" }}>
            Portfolio
          </h1>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {holdings.length} stocks · {mf.length} funds across all accounts
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {ACCOUNTS.map(a => (
            <button key={a} onClick={() => setActiveAccount(a)}
              style={{ padding: "5px 12px", borderRadius: "20px", border: "none", cursor: "pointer",
                fontSize: "11px", fontWeight: 600, textTransform: "capitalize",
                background: activeAccount === a ? "var(--accent-blue)" : "var(--bg-surface)",
                color: activeAccount === a ? "#000" : "var(--text-muted)",
                transition: "all 0.12s" }}>
              {a === "all" ? "All" : a.charAt(0).toUpperCase() + a.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Hero Cards (Glassmorphism) */}
      <div style={{ background: "linear-gradient(135deg, rgba(0,176,240,0.08) 0%, rgba(34,197,94,0.05) 100%)",
        borderRadius: "16px", padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <HeroCard label="Total Portfolio"
            value={summary ? fmt(summary.total_portfolio_value) : "—"}
            sub={summary ? `Invested ${fmt(summary.total_invested)}` : undefined} />
          <HeroCard label="Total P&L"
            value={summary ? `${summary.total_pnl >= 0 ? "+" : ""}${fmt(summary.total_pnl)}` : "—"}
            sub={summary ? fmtPct(summary.total_pnl_pct) : undefined}
            color={pnlColor(summary?.total_pnl)} />
          <HeroCard label="Day P&L"
            value={summary ? `${(summary.day_pnl || 0) >= 0 ? "+" : ""}${fmt(summary.day_pnl)}` : "—"}
            color={pnlColor(summary?.day_pnl)} />
          <HeroCard label="Equity Value"
            value={summary ? fmt(summary.equity_value) : "—"}
            sub={`${holdings.length} holdings`} />
          <HeroCard label="MF Value"
            value={summary ? fmt(summary.mf_value) : "—"}
            sub={`${mf.length} funds`} />
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: "2px", marginBottom: "16px",
        background: "var(--bg-secondary)", borderRadius: "8px", padding: "3px", width: "fit-content" }}>
        {(["equity", "mf"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: "6px 20px", borderRadius: "6px", border: "none", cursor: "pointer",
              fontSize: "12px", fontWeight: 600, textTransform: "capitalize",
              background: activeTab === tab ? "var(--bg-surface)" : "transparent",
              color: activeTab === tab ? "var(--accent-blue)" : "var(--text-muted)",
              transition: "all 0.12s" }}>
            {tab === "equity" ? "Equity" : "Mutual Funds"}
          </button>
        ))}
      </div>

      {/* Holdings Table */}
      {activeTab === "equity" && (
        <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
          border: "1px solid var(--bg-border)", overflow: "hidden" }}>
          {filteredHoldings.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)", fontSize: "13px" }}>
              No holdings found
            </div>
          ) : (
            <table className="staax-table">
              <thead>
                <tr>
                  <th>Stock</th><th>Account</th><th style={{textAlign:"right"}}>Qty</th>
                  <th style={{textAlign:"right"}}>Avg Price</th><th style={{textAlign:"right"}}>LTP</th>
                  <th style={{textAlign:"right"}}>Invested</th><th style={{textAlign:"right"}}>Current</th>
                  <th style={{textAlign:"right"}}>P&L</th><th style={{textAlign:"right"}}>P&L%</th>
                </tr>
              </thead>
              <tbody>
                {filteredHoldings.map(h => (
                  <tr key={h.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "13px" }}>{h.symbol}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>{h.exchange}</div>
                    </td>
                    <td style={{ fontSize: "11px" }}>
                      <span style={{ padding: "1px 7px", borderRadius: "20px", fontSize: "10px",
                        background: "var(--accent-blue-dim)", color: "var(--accent-blue)", fontWeight: 600 }}>
                        {h.account_id}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{h.qty}</td>
                    <td style={{ textAlign: "right", fontFamily: "'DM Mono', monospace" }}>₹{h.avg_price.toLocaleString("en-IN", {maximumFractionDigits: 2})}</td>
                    <td style={{ textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{h.ltp ? `₹${h.ltp.toLocaleString("en-IN", {maximumFractionDigits: 2})}` : "—"}</td>
                    <td style={{ textAlign: "right" }}>{fmt(h.invested_value)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(h.current_value)}</td>
                    <td style={{ textAlign: "right", color: pnlColor(h.pnl), fontWeight: 600 }}>
                      {h.pnl != null ? `${h.pnl >= 0 ? "+" : ""}${fmt(h.pnl)}` : "—"}
                    </td>
                    <td style={{ textAlign: "right", color: pnlColor(h.pnl_pct), fontWeight: 600 }}>
                      {fmtPct(h.pnl_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* MF Table */}
      {activeTab === "mf" && (
        <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
          border: "1px solid var(--bg-border)", overflow: "hidden" }}>
          {mf.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)", fontSize: "13px" }}>
              No mutual fund holdings found
            </div>
          ) : (
            <table className="staax-table">
              <thead>
                <tr>
                  <th>Fund</th><th style={{textAlign:"right"}}>Units</th>
                  <th style={{textAlign:"right"}}>NAV</th>
                  <th style={{textAlign:"right"}}>Invested</th>
                  <th style={{textAlign:"right"}}>Current Value</th>
                  <th style={{textAlign:"right"}}>P&L</th>
                </tr>
              </thead>
              <tbody>
                {mf.map(f => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600, maxWidth: "280px" }}>
                      <div style={{ fontSize: "12px" }}>{f.fund_name}</div>
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{f.units.toFixed(3)}</td>
                    <td style={{ textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{f.nav ? `₹${f.nav.toFixed(2)}` : "—"}</td>
                    <td style={{ textAlign: "right" }}>{fmt(f.invested_amount)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(f.current_value)}</td>
                    <td style={{ textAlign: "right", color: pnlColor(f.pnl), fontWeight: 600 }}>
                      {f.pnl != null ? `${f.pnl >= 0 ? "+" : ""}${fmt(f.pnl)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
