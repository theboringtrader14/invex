export default function AnalysisPage() {
  return (
    <div style={{ padding: "24px 28px", animation: "fadeUp 400ms cubic-bezier(0,0,0.2,1) both" }}>

      {/* Page header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: "32px", fontWeight: 800,
          color: "var(--ix-vivid)", letterSpacing: "-1px", marginBottom: "4px",
        }}>Analysis</div>
        <div style={{ fontSize: "12px", color: "var(--gs-light)" }}>
          Fundamental + technical dashboard
        </div>
      </div>

      {/* Coming Soon card */}
      <div className="glass cloud-fill" style={{
        padding: "64px 32px", textAlign: "center",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
      }}>
        {/* Teal icon */}
        <div style={{
          width: "56px", height: "56px", borderRadius: "16px",
          background: "linear-gradient(135deg, rgba(0,201,167,0.20), rgba(0,122,103,0.15))",
          border: "0.5px solid var(--ix-border)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ix-vivid)"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </div>

        <div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700,
            color: "var(--ix-glow)", marginBottom: "6px",
          }}>Coming in Phase 4</div>
          <div style={{ fontSize: "13px", color: "var(--gs-light)", maxWidth: "360px", lineHeight: 1.6 }}>
            Fundamental + technical analysis dashboard with AI-powered stock insights,
            RSI, MACD, 52W levels, and rebalancing suggestions.
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginTop: "4px" }}>
          {["Fundamentals", "Technical Indicators", "AI Analysis", "Rebalancing"].map(tag => (
            <span key={tag} style={{
              padding: "4px 12px", borderRadius: "var(--r-pill)",
              fontSize: "11px", fontWeight: 600,
              background: "rgba(0,201,167,0.08)", color: "var(--ix-ultra)",
              border: "0.5px solid rgba(0,201,167,0.20)",
            }}>{tag}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
