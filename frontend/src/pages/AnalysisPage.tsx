import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001'

type Tab = 'fundamental' | 'technical' | 'scorecard'

// Score color helper
function scoreColor(score: number) {
  if (score >= 75) return 'var(--sem-long)'
  if (score >= 55) return 'var(--sem-warn)'
  return 'var(--sem-short)'
}

// Recommendation chip
function RecChip({ rec }: { rec: string }) {
  const colors: Record<string, string> = {
    BUY: 'var(--sem-long)', HOLD: 'var(--sem-warn)', WATCH: 'var(--sem-short)',
  }
  const hexColors: Record<string, string> = {
    BUY: '#22DD88', HOLD: '#FFD700', WATCH: '#FF4444',
  }
  const color = colors[rec] || '#888'
  const hex = hexColors[rec] || '#888'
  return (
    <span style={{
      background: hex + '22',
      color,
      border: `1px solid ${hex}44`,
      borderRadius: 'var(--r-sm)',
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      fontFamily: 'var(--font-display)',
    }}>{rec}</span>
  )
}

// Signal chip
function SignalChip({ signal }: { signal: string }) {
  const map: Record<string, { color: string; label: string }> = {
    STRONG_BULL: { color: '#22DD88', label: '▲▲ STRONG BULL' },
    BULL:        { color: '#22DD88', label: '▲ BULL' },
    NEUTRAL:     { color: '#8A8A94', label: '— NEUTRAL' },
    WEAK:        { color: '#FFD700', label: '▼ WEAK' },
    BEAR:        { color: '#FF4444', label: '▼▼ BEAR' },
  }
  const c = map[signal] || { color: '#8A8A94', label: signal }
  return (
    <span style={{
      background: c.color + '22',
      color: c.color,
      border: `1px solid ${c.color}44`,
      borderRadius: 'var(--r-sm)',
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 600,
      fontFamily: 'var(--font-display)',
    }}>{c.label}</span>
  )
}

// Circular score arc (SVG)
function ScoreArc({ score, size = 120, label }: { score: number; size?: number; label?: string }) {
  const r = size * 0.38
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const dashOffset = circ - (score / 100) * circ
  const color = scoreColor(score)
  // map CSS var to a hex for SVG fill
  const hexColor = score >= 75 ? '#22DD88' : score >= 55 ? '#FFD700' : '#FF4444'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={hexColor} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} />
        <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle"
          fill={hexColor} fontSize={size * 0.22} fontWeight={700} fontFamily="'JetBrains Mono', monospace">
          {score}
        </text>
        <text x={cx} y={cy + size * 0.2} textAnchor="middle" dominantBaseline="middle"
          fill="#5A5A61" fontSize={size * 0.1} fontFamily="'Syne', sans-serif">
          /100
        </text>
      </svg>
      {label && (
        <span style={{
          fontSize: 10,
          color: 'var(--gs-light)',
          letterSpacing: 2,
          textTransform: 'uppercase',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
        }}>{label}</span>
      )}
    </div>
  )
}

// Score bar (horizontal)
function ScoreBar({ score, label }: { score: number; label: string }) {
  const hexColor = score >= 75 ? '#22DD88' : score >= 55 ? '#FFD700' : '#FF4444'
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--gs-muted)', fontFamily: 'var(--font-display)' }}>{label}</span>
        <span style={{ fontSize: 12, color: hexColor, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{score}</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(score, 100)}%`,
          background: hexColor,
          height: '100%',
          borderRadius: 4,
          transition: 'width 0.6s var(--ease-smooth)',
        }} />
      </div>
    </div>
  )
}

// Skeleton loader
function Skeleton({ height = 120, width = '100%' }: { height?: number; width?: string | number }) {
  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      borderRadius: 'var(--r-lg)',
      height,
      width,
    }} />
  )
}

// Glass card style
const glassCard: React.CSSProperties = {
  background: 'var(--glass-bg)',
  border: 'var(--glass-border)',
  borderRadius: 'var(--r-lg)',
  padding: 20,
}

export default function AnalysisPage() {
  const [tab, setTab] = useState<Tab>('fundamental')
  const [fundamental, setFundamental] = useState<any>(null)
  const [technical, setTechnical] = useState<any>(null)
  const [scorecard, setScorecard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortCol, setSortCol] = useState('overall_score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [recFilter, setRecFilter] = useState<string>('ALL')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`${API}/api/v1/analysis/fundamental`).then(r => r.json()),
      fetch(`${API}/api/v1/analysis/technical`).then(r => r.json()),
      fetch(`${API}/api/v1/analysis/scorecard`).then(r => r.json()),
    ]).then(([f, t, s]) => {
      setFundamental(f)
      setTechnical(t)
      setScorecard(s)
      setLoading(false)
    }).catch(() => {
      setError('Unable to load analysis data')
      setLoading(false)
    })
  }, [])

  const formatVal = (v: number) => {
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`
    return `₹${v.toLocaleString('en-IN')}`
  }

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '6px 18px',
    borderRadius: 'var(--r-md)',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 1,
    cursor: 'pointer',
    border: 'none',
    textTransform: 'uppercase',
    background: tab === t ? 'var(--ix-vivid)' : 'transparent',
    color: tab === t ? '#0a0a0b' : 'var(--gs-light)',
    transition: 'all var(--dur-mid) var(--ease-smooth)',
    fontFamily: 'var(--font-display)',
  })

  if (error) return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ color: 'var(--sem-short)', marginBottom: 16, fontFamily: 'var(--font-display)' }}>{error}</div>
      <button onClick={() => window.location.reload()}
        style={{
          background: 'var(--ix-vivid)',
          color: '#0a0a0b',
          border: 'none',
          borderRadius: 'var(--r-md)',
          padding: '8px 20px',
          cursor: 'pointer',
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
        }}>
        Retry
      </button>
    </div>
  )

  return (
    <div style={{ padding: '24px 28px', animation: 'fadeUp 400ms cubic-bezier(0,0,0.2,1) both' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          fontWeight: 800,
          color: 'var(--ix-vivid)',
          letterSpacing: '-1px',
          marginBottom: 4,
        }}>
          Analysis
        </div>
        <div style={{ fontSize: 12, color: 'var(--gs-light)', fontFamily: 'var(--font-display)' }}>
          {fundamental
            ? `${fundamental.total_holdings} holdings · ${formatVal(fundamental.total_value || 0)}`
            : 'Fundamental + Technical deep-dive'}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 4,
        background: 'rgba(0,201,167,0.05)',
        border: '0.5px solid var(--ix-border)',
        borderRadius: 'var(--r-lg)',
        padding: 4,
        width: 'fit-content',
        marginBottom: 20,
      }}>
        {(['fundamental', 'technical', 'scorecard'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <Skeleton height={200} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Skeleton height={160} />
            <Skeleton height={160} />
          </div>
          <Skeleton height={300} />
        </div>
      ) : (
        <>
          {/* ═══ TAB 1: FUNDAMENTAL ═══ */}
          {tab === 'fundamental' && fundamental && (
            <div style={{ display: 'grid', gap: 20 }}>
              {/* Health Score + Sector side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
                {/* Health Score Card */}
                <div className="glass cloud-fill" style={{ ...glassCard }}>
                  <div style={{
                    fontSize: 10, color: 'var(--gs-light)', letterSpacing: 2,
                    marginBottom: 16, textTransform: 'uppercase',
                    fontFamily: 'var(--font-display)', fontWeight: 600,
                  }}>Portfolio Health</div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <ScoreArc score={fundamental.health_score.total} size={130} label="Health Score" />
                  </div>
                  <ScoreBar
                    score={Math.round(fundamental.health_score.diversification / 0.4)}
                    label={`Diversification · ${fundamental.health_score.sectors_count} sectors`}
                  />
                  <ScoreBar
                    score={Math.round(fundamental.health_score.concentration / 0.3)}
                    label={`Concentration · top3 = ${fundamental.health_score.top3_concentration_pct}%`}
                  />
                  <ScoreBar
                    score={Math.round(fundamental.health_score.gain_loss_balance / 0.3)}
                    label={`Win Rate · ${fundamental.health_score.winners_pct}%`}
                  />
                </div>

                {/* Sector Allocation */}
                <div className="glass cloud-fill" style={{ ...glassCard }}>
                  <div style={{
                    fontSize: 10, color: 'var(--gs-light)', letterSpacing: 2,
                    marginBottom: 16, textTransform: 'uppercase',
                    fontFamily: 'var(--font-display)', fontWeight: 600,
                  }}>Sector Allocation</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {fundamental.sector_allocation.slice(0, 8).map((s: any) => (
                      <div key={s.sector}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                          <span style={{ color: 'var(--gs-muted)', fontFamily: 'var(--font-display)' }}>{s.sector}</span>
                          <span style={{ color: 'var(--gs-light)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                            {s.pct}% · {s.count} stocks · {formatVal(s.value)}
                          </span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 4, height: 6 }}>
                          <div style={{
                            width: `${s.pct}%`,
                            background: 'linear-gradient(90deg, var(--ix-vivid), rgba(0,201,167,0.4))',
                            height: '100%',
                            borderRadius: 4,
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Gain Distribution */}
              <div className="glass cloud-fill" style={{ ...glassCard }}>
                <div style={{
                  fontSize: 10, color: 'var(--gs-light)', letterSpacing: 2,
                  marginBottom: 16, textTransform: 'uppercase',
                  fontFamily: 'var(--font-display)', fontWeight: 600,
                }}>Gain / Loss Distribution</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 120 }}>
                  {fundamental.gain_distribution.map((b: any, i: number) => {
                    const maxCount = Math.max(...fundamental.gain_distribution.map((x: any) => x.count), 1)
                    const barH = Math.max((b.count / maxCount) * 90, b.count > 0 ? 8 : 0)
                    const isNeg = i < 2
                    return (
                      <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 12, fontWeight: 700,
                          color: isNeg ? 'var(--sem-short)' : 'var(--sem-long)',
                          fontFamily: 'var(--font-mono)',
                        }}>{b.count}</span>
                        <div style={{
                          width: '100%', height: barH, borderRadius: '4px 4px 0 0',
                          background: isNeg
                            ? 'linear-gradient(0deg, rgba(255,68,68,0.53), rgba(255,68,68,0.20))'
                            : 'linear-gradient(0deg, rgba(34,221,136,0.53), rgba(34,221,136,0.20))',
                          border: `1px solid ${isNeg ? 'rgba(255,68,68,0.27)' : 'rgba(34,221,136,0.27)'}`,
                        }} />
                        <span style={{
                          fontSize: 10, color: 'var(--gs-light)', textAlign: 'center',
                          lineHeight: 1.2, fontFamily: 'var(--font-display)',
                        }}>{b.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Top Holdings Table */}
              <div className="glass cloud-fill" style={{ ...glassCard }}>
                <div style={{
                  fontSize: 10, color: 'var(--gs-light)', letterSpacing: 2,
                  marginBottom: 16, textTransform: 'uppercase',
                  fontFamily: 'var(--font-display)', fontWeight: 600,
                }}>Top Holdings</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '0.5px solid var(--ix-border)' }}>
                        {['Symbol', 'Sector', 'Value', 'Weight', 'Gain%'].map(h => (
                          <th key={h} style={{
                            padding: '8px 12px',
                            textAlign: h === 'Symbol' ? 'left' : 'right',
                            color: 'var(--gs-light)',
                            fontWeight: 600, fontSize: 10, letterSpacing: 2,
                            textTransform: 'uppercase',
                            fontFamily: 'var(--font-display)',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fundamental.top_holdings.map((h: any) => (
                        <tr key={h.symbol} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '10px 12px', color: 'var(--gs-muted)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{h.symbol}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--gs-light)', textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: 12 }}>{h.sector}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--gs-muted)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatVal(h.current_value)}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--gs-light)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{h.weight_pct}%</td>
                          <td style={{
                            padding: '10px 12px', textAlign: 'right', fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color: h.gain_pct >= 0 ? 'var(--sem-long)' : 'var(--sem-short)',
                          }}>
                            {h.gain_pct >= 0 ? '+' : ''}{h.gain_pct?.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB 2: TECHNICAL ═══ */}
          {tab === 'technical' && technical && (
            <div style={{ display: 'grid', gap: 20 }}>
              {/* Signal Overview */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                {Object.entries(technical.signal_summary || {}).map(([sig, data]: [string, any]) => {
                  const colorMap: Record<string, string> = {
                    STRONG_BULL: '#22DD88',
                    BULL: '#22DD88',
                    NEUTRAL: '#8A8A94',
                    WEAK: '#FFD700',
                    BEAR: '#FF4444',
                  }
                  const labels: Record<string, string> = {
                    STRONG_BULL: '▲▲ Strong Bull',
                    BULL: '▲ Bull',
                    NEUTRAL: '— Neutral',
                    WEAK: '▼ Weak',
                    BEAR: '▼▼ Bear',
                  }
                  const color = colorMap[sig] || '#8A8A94'
                  return (
                    <div key={sig} className="glass cloud-fill" style={{
                      ...glassCard,
                      borderTop: `2px solid ${color}`,
                      padding: 16,
                    }}>
                      <div style={{
                        fontSize: 10, color: 'var(--gs-light)', marginBottom: 8,
                        fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: 1,
                      }}>{labels[sig] || sig}</div>
                      <div style={{
                        fontSize: 24, fontWeight: 700, color,
                        fontFamily: 'var(--font-mono)',
                      }}>{data.count}</div>
                      <div style={{ fontSize: 11, color: 'var(--gs-light)', marginTop: 4, fontFamily: 'var(--font-display)' }}>
                        stocks · {data.value_pct}%
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Holdings table */}
              <div className="glass cloud-fill" style={{ ...glassCard }}>
                <div style={{
                  fontSize: 10, color: 'var(--gs-light)', letterSpacing: 2,
                  marginBottom: 16, textTransform: 'uppercase',
                  fontFamily: 'var(--font-display)', fontWeight: 600,
                }}>Holdings by Signal</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '0.5px solid var(--ix-border)' }}>
                        {['Symbol', 'Sector', 'Price', 'Avg Price', 'Gain%', 'Signal', 'RSI', 'MA50', 'MA200'].map(h => (
                          <th key={h} style={{
                            padding: '8px 12px',
                            textAlign: h === 'Symbol' || h === 'Sector' ? 'left' : 'right',
                            color: 'var(--gs-light)', fontWeight: 600, fontSize: 10,
                            letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap',
                            fontFamily: 'var(--font-display)',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...technical.holdings].sort((a: any, b: any) => {
                        const order = ['STRONG_BULL', 'BULL', 'NEUTRAL', 'WEAK', 'BEAR']
                        return order.indexOf(a.signal) - order.indexOf(b.signal)
                      }).map((h: any) => (
                        <tr key={h.symbol} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '10px 12px', color: 'var(--gs-muted)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{h.symbol}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--gs-light)', fontFamily: 'var(--font-display)', fontSize: 12 }}>{h.sector}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--gs-muted)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>₹{h.price?.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--gs-light)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>₹{h.avg_price?.toLocaleString('en-IN')}</td>
                          <td style={{
                            padding: '10px 12px', textAlign: 'right', fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color: h.gain_pct >= 0 ? 'var(--sem-long)' : 'var(--sem-short)',
                          }}>
                            {h.gain_pct >= 0 ? '+' : ''}{h.gain_pct?.toFixed(2)}%
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}><SignalChip signal={h.signal} /></td>
                          <td style={{ padding: '10px 12px', color: 'var(--gs-mid)', textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)' }} title="Phase 2">—</td>
                          <td style={{ padding: '10px 12px', color: 'var(--gs-mid)', textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)' }} title="Phase 2">—</td>
                          <td style={{ padding: '10px 12px', color: 'var(--gs-mid)', textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)' }} title="Phase 2">—</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--gs-light)', fontFamily: 'var(--font-display)' }}>
                  · RSI, MA50, MA200 will be populated via price history feed in Phase 2
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB 3: SCORECARD ═══ */}
          {tab === 'scorecard' && scorecard && (
            <div style={{ display: 'grid', gap: 20 }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { label: 'Overall Score', value: scorecard.portfolio.overall_score, arc: true },
                  { label: 'Fundamental', value: scorecard.portfolio.fundamental_score, arc: true },
                  { label: 'Technical', value: scorecard.portfolio.technical_score, arc: true },
                  { label: 'Recommendation', value: null, arc: false, recs: scorecard.portfolio },
                ].map((card, i) => (
                  <div key={i} className="glass cloud-fill" style={{
                    ...glassCard,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: 16,
                  }}>
                    {card.arc ? (
                      <ScoreArc score={card.value!} size={90} label={card.label} />
                    ) : (
                      <>
                        <div style={{
                          fontSize: 10, color: 'var(--gs-light)', letterSpacing: 2,
                          marginBottom: 12, textTransform: 'uppercase',
                          fontFamily: 'var(--font-display)', fontWeight: 600,
                        }}>{card.label}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                          <span style={{ color: 'var(--sem-long)', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 13 }}>
                            ▲ {card.recs?.buy_count} BUY
                          </span>
                          <span style={{ color: 'var(--sem-warn)', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 13 }}>
                            ◆ {card.recs?.hold_count} HOLD
                          </span>
                          <span style={{ color: 'var(--sem-short)', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 13 }}>
                            ● {card.recs?.watch_count} WATCH
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Top 3 + Bottom 3 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { title: 'Strongest Holdings', holdings: scorecard.portfolio.top_3 },
                  { title: 'Needs Attention', holdings: scorecard.portfolio.bottom_3 },
                ].map(({ title, holdings }) => (
                  <div key={title} className="glass cloud-fill" style={{ ...glassCard }}>
                    <div style={{
                      fontSize: 10, color: 'var(--gs-light)', letterSpacing: 2,
                      marginBottom: 16, textTransform: 'uppercase',
                      fontFamily: 'var(--font-display)', fontWeight: 600,
                    }}>{title}</div>
                    {(holdings || []).map((h: any) => (
                      <div key={h.symbol} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div>
                            <span style={{
                              color: 'var(--gs-muted)', fontWeight: 600, fontSize: 14,
                              fontFamily: 'var(--font-mono)',
                            }}>{h.symbol}</span>
                            <span style={{
                              color: 'var(--gs-light)', fontSize: 11, marginLeft: 8,
                              fontFamily: 'var(--font-display)',
                            }}>{h.sector}</span>
                          </div>
                          <RecChip rec={h.recommendation} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--gs-light)', fontFamily: 'var(--font-display)' }}>
                            Fund: <b style={{ color: h.fundamental_score >= 75 ? '#22DD88' : h.fundamental_score >= 55 ? '#FFD700' : '#FF4444' }}>{h.fundamental_score}</b>
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--gs-light)', fontFamily: 'var(--font-display)' }}>
                            Tech: <b style={{ color: h.technical_score >= 75 ? '#22DD88' : h.technical_score >= 55 ? '#FFD700' : '#FF4444' }}>{h.technical_score}</b>
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--gs-light)', fontFamily: 'var(--font-display)' }}>
                            Overall: <b style={{ color: h.overall_score >= 75 ? '#22DD88' : h.overall_score >= 55 ? '#FFD700' : '#FF4444' }}>{h.overall_score}</b>
                          </span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 4, height: 5 }}>
                          <div style={{
                            width: `${h.overall_score}%`,
                            background: h.overall_score >= 75 ? '#22DD88' : h.overall_score >= 55 ? '#FFD700' : '#FF4444',
                            height: '100%', borderRadius: 4,
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Filter + Full Scorecard Table */}
              <div className="glass cloud-fill" style={{ ...glassCard }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{
                    fontSize: 10, color: 'var(--gs-light)', letterSpacing: 2,
                    textTransform: 'uppercase', fontFamily: 'var(--font-display)', fontWeight: 600,
                  }}>Full Scorecard</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['ALL', 'BUY', 'HOLD', 'WATCH'].map(f => (
                      <button key={f} onClick={() => setRecFilter(f)} style={{
                        background: recFilter === f ? 'var(--ix-vivid)' : 'rgba(255,255,255,0.07)',
                        color: recFilter === f ? '#0a0a0b' : 'var(--gs-light)',
                        border: 'none', borderRadius: 'var(--r-sm)',
                        padding: '4px 12px', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'var(--font-display)',
                        transition: 'all var(--dur-mid) var(--ease-smooth)',
                      }}>{f}</button>
                    ))}
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '0.5px solid var(--ix-border)' }}>
                        {[
                          { k: 'symbol', label: 'Symbol' },
                          { k: 'sector', label: 'Sector' },
                          { k: 'current_value', label: 'Value' },
                          { k: 'gain_pct', label: 'Gain%' },
                          { k: 'fundamental_score', label: 'Fund' },
                          { k: 'technical_score', label: 'Tech' },
                          { k: 'overall_score', label: 'Overall' },
                          { k: 'recommendation', label: 'Action' },
                        ].map(col => (
                          <th key={col.k} onClick={() => {
                            if (sortCol === col.k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                            else { setSortCol(col.k); setSortDir('desc') }
                          }} style={{
                            padding: '8px 12px',
                            textAlign: col.k === 'symbol' || col.k === 'sector' ? 'left' : 'right',
                            color: sortCol === col.k ? 'var(--ix-vivid)' : 'var(--gs-light)',
                            fontWeight: 600, fontSize: 10, letterSpacing: 2,
                            textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap',
                            fontFamily: 'var(--font-display)',
                          }}>
                            {col.label} {sortCol === col.k ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(scorecard.holdings || [])
                        .filter((h: any) => recFilter === 'ALL' || h.recommendation === recFilter)
                        .sort((a: any, b: any) => {
                          const av = a[sortCol]; const bv = b[sortCol]
                          if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av
                          return sortDir === 'asc'
                            ? String(av).localeCompare(String(bv))
                            : String(bv).localeCompare(String(av))
                        })
                        .map((h: any) => (
                          <tr key={h.symbol} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '10px 12px', color: 'var(--gs-muted)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{h.symbol}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--gs-light)', fontFamily: 'var(--font-display)', fontSize: 12 }}>{h.sector}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--gs-muted)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatVal(h.current_value)}</td>
                            <td style={{
                              padding: '10px 12px', textAlign: 'right', fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              color: h.gain_pct >= 0 ? 'var(--sem-long)' : 'var(--sem-short)',
                            }}>
                              {h.gain_pct >= 0 ? '+' : ''}{h.gain_pct?.toFixed(2)}%
                            </td>
                            <td style={{
                              padding: '10px 12px', textAlign: 'right', fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              color: h.fundamental_score >= 75 ? '#22DD88' : h.fundamental_score >= 55 ? '#FFD700' : '#FF4444',
                            }}>{h.fundamental_score}</td>
                            <td style={{
                              padding: '10px 12px', textAlign: 'right', fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              color: h.technical_score >= 75 ? '#22DD88' : h.technical_score >= 55 ? '#FFD700' : '#FF4444',
                            }}>{h.technical_score}</td>
                            <td style={{
                              padding: '10px 12px', textAlign: 'right', fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              color: h.overall_score >= 75 ? '#22DD88' : h.overall_score >= 55 ? '#FFD700' : '#FF4444',
                            }}>{h.overall_score}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}><RecChip rec={h.recommendation} /></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--gs-light)', fontFamily: 'var(--font-display)' }}>
                  · P/E, P/B, ROE, Promoter%, FCF will be pulled from Screener.in in Phase 2
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>
    </div>
  )
}
