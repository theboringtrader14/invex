import { useState } from "react"

type Tab = "fundamental" | "technical"

function CardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 700,
        color: "var(--ix-glow)", letterSpacing: "0.3px",
      }}>{title}</div>
      <div style={{ fontSize: "11px", color: "var(--gs-light)", marginTop: "2px" }}>{subtitle}</div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "11px", color: "rgba(232,232,248,0.28)", fontStyle: "italic",
    }}>
      Analysis data loading...
    </div>
  )
}

const CARD: React.CSSProperties = {
  padding: "20px",
  minHeight: "180px",
  borderRadius: "12px",
  border: "0.5px solid var(--ix-border)",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
}

// ── Fundamental ───────────────────────────────────────────────────────────────

function SectorAllocation() {
  return (
    <div className="glass cloud-fill" style={CARD}>
      <CardHeader title="Sector Allocation" subtitle="Loading portfolio sectors..." />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          width: "90px", height: "90px", borderRadius: "50%",
          border: "2px dashed rgba(0,201,167,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: "50px", height: "50px", borderRadius: "50%",
            background: "rgba(0,201,167,0.08)", border: "0.5px solid var(--ix-border)",
          }} />
        </div>
      </div>
      <EmptyState />
    </div>
  )
}

function TopHoldings() {
  return (
    <div className="glass cloud-fill" style={CARD}>
      <CardHeader title="Top Holdings" subtitle="By portfolio value" />
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
        {[80, 60, 45].map((w, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "6px",
              background: "rgba(0,201,167,0.07)", border: "0.5px solid var(--ix-border)",
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: "8px", borderRadius: "4px", background: "rgba(232,232,248,0.08)", marginBottom: "4px" }}>
                <div style={{ width: `${w}%`, height: "100%", borderRadius: "4px", background: "rgba(0,201,167,0.20)" }} />
              </div>
              <div style={{ height: "6px", width: "40%", borderRadius: "3px", background: "rgba(232,232,248,0.05)" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PEDistribution() {
  const bars = [30, 55, 80, 65, 40]
  return (
    <div className="glass cloud-fill" style={CARD}>
      <CardHeader title="P/E Distribution" subtitle="Valuation bands" />
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: "6px", padding: "8px 0 0" }}>
        {bars.map((h, i) => (
          <div key={i} style={{
            flex: 1, height: `${h}px`, borderRadius: "4px 4px 0 0",
            background: `rgba(0,201,167,${0.08 + i * 0.04})`,
            border: "0.5px solid rgba(0,201,167,0.18)",
          }} />
        ))}
      </div>
      <EmptyState />
    </div>
  )
}

function DividendYield() {
  return (
    <div className="glass cloud-fill" style={CARD}>
      <CardHeader title="Dividend Yield" subtitle="Annual yield tracker" />
      <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "8px 0" }}>
        <svg width="100%" height="48" viewBox="0 0 200 48" preserveAspectRatio="none">
          <path d="M0 36 Q50 28 100 32 Q150 36 200 24"
            stroke="rgba(0,201,167,0.30)" strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
          <path d="M0 36 Q50 28 100 32 Q150 36 200 24 L200 48 L0 48 Z"
            fill="rgba(0,201,167,0.04)" />
        </svg>
      </div>
      <EmptyState />
    </div>
  )
}

// ── Technical ────────────────────────────────────────────────────────────────

function RSIIndicators() {
  return (
    <div className="glass cloud-fill" style={CARD}>
      <CardHeader title="RSI Indicators" subtitle="14-day RSI per stock" />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="100" height="60" viewBox="0 0 100 60">
          <path d="M5 55 A45 45 0 0 1 95 55" stroke="rgba(232,232,248,0.08)" strokeWidth="8" fill="none" />
          <path d="M5 55 A45 45 0 0 1 50 10" stroke="rgba(0,201,167,0.35)" strokeWidth="8" fill="none"
            strokeLinecap="round" />
          <text x="50" y="54" textAnchor="middle" fontSize="13" fontWeight="700"
            fill="rgba(0,201,167,0.50)">—</text>
        </svg>
      </div>
      <EmptyState />
    </div>
  )
}

function FiftyTwoWeekRange() {
  return (
    <div className="glass cloud-fill" style={CARD}>
      <CardHeader title="52-Week Range" subtitle="High / Low tracker" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "14px", justifyContent: "center" }}>
        {[0.72, 0.45, 0.88].map((pos, i) => (
          <div key={i} style={{
            height: "6px", borderRadius: "3px",
            background: "rgba(232,232,248,0.07)",
            position: "relative",
          }}>
            <div style={{
              position: "absolute", left: `${pos * 100}%`, top: "-3px",
              width: "12px", height: "12px", borderRadius: "50%",
              background: "var(--ix-vivid)", transform: "translateX(-50%)",
              border: "2px solid rgba(10,10,11,0.8)",
            }} />
          </div>
        ))}
      </div>
      <EmptyState />
    </div>
  )
}

function MASignals() {
  return (
    <div className="glass cloud-fill" style={CARD}>
      <CardHeader title="MA Signals" subtitle="20 / 50 / 200 DMA" />
      <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "4px 0" }}>
        <svg width="100%" height="56" viewBox="0 0 200 56" preserveAspectRatio="none">
          <path d="M0 40 Q40 20 80 28 Q120 36 160 16 Q180 8 200 20"
            stroke="rgba(0,201,167,0.40)" strokeWidth="1.5" fill="none" />
          <path d="M0 44 Q50 38 100 40 Q150 42 200 36"
            stroke="rgba(255,107,0,0.30)" strokeWidth="1.5" fill="none" />
          <path d="M0 46 Q100 44 200 42"
            stroke="rgba(232,232,248,0.15)" strokeWidth="1" fill="none" strokeDasharray="3 3" />
        </svg>
      </div>
      <EmptyState />
    </div>
  )
}

function VolumeAnalysis() {
  const vols = [45, 70, 55, 90, 60, 80, 50]
  return (
    <div className="glass cloud-fill" style={CARD}>
      <CardHeader title="Volume Analysis" subtitle="Avg volume vs today" />
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: "5px", padding: "8px 0 0" }}>
        {vols.map((h, i) => (
          <div key={i} style={{
            flex: 1, height: `${h}px`, borderRadius: "3px 3px 0 0",
            background: i === 6 ? "rgba(0,201,167,0.45)" : "rgba(232,232,248,0.07)",
            border: i === 6 ? "0.5px solid rgba(0,201,167,0.40)" : "none",
          }} />
        ))}
      </div>
      <EmptyState />
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const [tab, setTab] = useState<Tab>("fundamental")

  return (
    <div style={{ padding: "24px 28px", animation: "fadeUp 400ms cubic-bezier(0,0,0.2,1) both" }}>

      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: "32px", fontWeight: 800,
          color: "var(--ix-vivid)", letterSpacing: "-1px", marginBottom: "4px",
        }}>Analysis</div>
        <div style={{ fontSize: "12px", color: "var(--gs-light)" }}>
          Fundamental + Technical deep-dive
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: "4px",
        background: "rgba(0,201,167,0.05)",
        border: "0.5px solid var(--ix-border)",
        borderRadius: "10px", padding: "4px",
        width: "fit-content", marginBottom: "20px",
      }}>
        {(["fundamental", "technical"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "6px 18px", borderRadius: "7px", border: "none", cursor: "pointer",
              fontSize: "12px", fontWeight: 700, letterSpacing: "0.5px",
              textTransform: "uppercase" as const, transition: "all 150ms",
              background: tab === t ? "var(--ix-vivid)" : "transparent",
              color: tab === t ? "#0a0a0b" : "var(--gs-light)",
            }}
          >
            {t === "fundamental" ? "Fundamental" : "Technical"}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "14px",
      }}>
        {tab === "fundamental" ? (
          <>
            <SectorAllocation />
            <TopHoldings />
            <PEDistribution />
            <DividendYield />
          </>
        ) : (
          <>
            <RSIIndicators />
            <FiftyTwoWeekRange />
            <MASignals />
            <VolumeAnalysis />
          </>
        )}
      </div>
    </div>
  )
}
