import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001'

type Tab = 'fundamental' | 'technical' | 'scorecard'

function scoreColor(score: number) {
  if (score >= 75) return 'var(--green)'
  if (score >= 55) return 'var(--amber)'
  return 'var(--red)'
}

function scoreHex(score: number) {
  if (score >= 75) return '#22DD88'
  if (score >= 55) return '#F59E0B'
  return '#FF4444'
}

function RecChip({ rec }: { rec: string }) {
  const colors: Record<string, string> = {
    BUY: 'var(--green)', HOLD: 'var(--amber)', WATCH: 'var(--red)',
  }
  const hexColors: Record<string, string> = {
    BUY: '#22DD88', HOLD: '#F59E0B', WATCH: '#FF4444',
  }
  const color = colors[rec] || 'var(--text-mute)'
  const hex = hexColors[rec] || '#9CA3AF'
  return (
    <span style={{
      background: hex + '15',
      color,
      border: `1px solid ${hex}33`,
      borderRadius: 'var(--r-sm)',
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      fontFamily: 'var(--font-mono)',
    }}>{rec}</span>
  )
}

function SignalChip({ signal }: { signal: string }) {
  const map: Record<string, { color: string; label: string }> = {
    STRONG_BULL: { color: '#22DD88', label: '▲▲ STRONG BULL' },
    BULL:        { color: '#22DD88', label: '▲ BULL' },
    NEUTRAL:     { color: 'var(--text-mute)', label: '— NEUTRAL' },
    WEAK:        { color: '#F59E0B', label: '▼ WEAK' },
    BEAR:        { color: '#FF4444', label: '▼▼ BEAR' },
  }
  const c = map[signal] || { color: 'var(--text-mute)', label: signal }
  return (
    <span style={{
      background: c.color + '15',
      color: c.color,
      border: `1px solid ${c.color}33`,
      borderRadius: 'var(--r-sm)',
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 600,
      fontFamily: 'var(--font-mono)',
    }}>{c.label}</span>
  )
}

function ScoreArc({ score, size = 120, label }: { score: number; size?: number; label?: string }) {
  const r = size * 0.38
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const dashOffset = circ - (score / 100) * circ
  const hexColor = scoreHex(score)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={8} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={hexColor} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} />
        <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle"
          fill={hexColor} fontSize={size * 0.22} fontWeight={700} fontFamily="'JetBrains Mono', monospace">
          {score}
        </text>
        <text x={cx} y={cy + size * 0.2} textAnchor="middle" dominantBaseline="middle"
          fill="var(--text-mute)" fontSize={size * 0.1} fontFamily="'Syne', sans-serif">
          /100
        </text>
      </svg>
      {label && (
        <span style={{
          fontSize: 10,
          color: 'var(--text-mute)',
          letterSpacing: 2,
          textTransform: 'uppercase',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
        }}>{label}</span>
      )}
    </div>
  )
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const hexColor = scoreHex(score)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>{label}</span>
        <span style={{ fontSize: 12, color: hexColor, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{score}</span>
      </div>
      <div style={{ background: 'rgba(0,0,0,0.07)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(score, 100)}%`,
          background: hexColor,
          height: '100%',
          borderRadius: 4,
          transition: 'width 0.6s',
        }} />
      </div>
    </div>
  )
}

function Skeleton({ height = 120, width = '100%' }: { height?: number; width?: string | number }) {
  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.07) 50%, rgba(0,0,0,0.04) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      borderRadius: 'var(--r-lg)',
      height,
      width,
    }} />
  )
}

const neuCard: React.CSSProperties = {
  background: 'var(--bg-surface)',
  boxShadow: 'var(--neu-raised)',
  borderRadius: 'var(--r-lg)',
  border: '1px solid var(--border)',
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
    background: tab === t ? 'var(--bg)' : 'transparent',
    boxShadow: tab === t ? 'var(--neu-inset)' : 'none',
    color: tab === t ? 'var(--accent)' : 'var(--text-dim)',
    transition: 'all 0.15s',
    fontFamily: 'var(--font-body)',
  })

  if (error) return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ color: 'var(--red)', marginBottom: 16, fontFamily: 'var(--font-body)' }}>{error}</div>
      <button onClick={() => window.location.reload()}
        style={{
          background: 'var(--bg-surface)',
          boxShadow: 'var(--neu-raised-sm)',
          color: 'var(--accent)',
          border: 'none',
          borderRadius: 'var(--r-md)',
          padding: '8px 20px',
          cursor: 'pointer',
          fontWeight: 700,
          fontFamily: 'var(--font-body)',
        }}>
        Retry
      </button>
    </div>
  )

  return (
    <div style={{ animation: 'fadeUp 400ms cubic-bezier(0,0,0.2,1) both' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 800,
          color: 'var(--text)',
          marginBottom: 4,
        }}>
          Analysis
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
          {fundamental
            ? `${fundamental.total_holdings} holdings · ${formatVal(fundamental.total_value || 0)}`
            : 'Fundamental + Technical deep-dive'}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 4,
        background: 'var(--bg-surface)',
        boxShadow: 'var(--neu-raised-sm)',
        border: '1px solid var(--border)',
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
              <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
                {/* Health Score Card */}
                <div style={{ ...neuCard }}>
                  <div style={{
                    fontSize: 10, color: 'var(--text-mute)', letterSpacing: '0.08em',
                    marginBottom: 16, textTransform: 'uppercase',
                    fontFamily: 'var(--font-mono)', fontWeight: 700,
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
                <div style={{ ...neuCard }}>
                  <div style={{
                    fontSize: 10, color: 'var(--text-mute)', letterSpacing: '0.08em',
                    marginBottom: 16, textTransform: 'uppercase',
                    fontFamily: 'var(--font-mono)', fontWeight: 700,
                  }}>Sector Allocation</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {fundamental.sector_allocation.slice(0, 8).map((s: any) => (
                      <div key={s.sector}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                          <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>{s.sector}</span>
                          <span style={{ color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                            {s.pct}% · {s.count} stocks · {formatVal(s.value)}
                          </span>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.07)', borderRadius: 4, height: 6 }}>
                          <div style={{
                            width: `${s.pct}%`,
                            background: 'linear-gradient(90deg, var(--accent), rgba(45,212,191,0.5))',
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
              <div style={{ ...neuCard }}>
                <div style={{
                  fontSize: 10, color: 'var(--text-mute)', letterSpacing: '0.08em',
                  marginBottom: 16, textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)', fontWeight: 700,
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
                          color: isNeg ? 'var(--red)' : 'var(--green)',
                          fontFamily: 'var(--font-mono)',
                        }}>{b.count}</span>
                        <div style={{
                          width: '100%', height: barH, borderRadius: '4px 4px 0 0',
                          background: isNeg
                            ? 'rgba(255,68,68,0.25)'
                            : 'rgba(34,221,136,0.25)',
                          border: `1px solid ${isNeg ? 'rgba(255,68,68,0.20)' : 'rgba(34,221,136,0.20)'}`,
                        }} />
                        <span style={{
                          fontSize: 10, color: 'var(--text-mute)', textAlign: 'center',
                          lineHeight: 1.2, fontFamily: 'var(--font-mono)',
                        }}>{b.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Top Holdings Table */}
              <div style={{ ...neuCard }}>
                <div style={{
                  fontSize: 10, color: 'var(--text-mute)', letterSpacing: '0.08em',
                  marginBottom: 16, textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)', fontWeight: 700,
                }}>Top Holdings</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Symbol', 'Sector', 'Value', 'Weight', 'Gain%'].map(h => (
                          <th key={h} style={{
                            padding: '8px 12px',
                            textAlign: h === 'Symbol' ? 'left' : 'right',
                            color: 'var(--text-mute)',
                            fontWeight: 700, fontSize: 10, letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            fontFamily: 'var(--font-mono)',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fundamental.top_holdings.map((h: any) => (
                        <tr key={h.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 12px', color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{h.symbol}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-dim)', textAlign: 'right', fontFamily: 'var(--font-body)', fontSize: 12 }}>{h.sector}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-dim)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatVal(h.current_value)}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-mute)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{h.weight_pct}%</td>
                          <td style={{
                            padding: '10px 12px', textAlign: 'right', fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color: h.gain_pct >= 0 ? 'var(--green)' : 'var(--red)',
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
                    NEUTRAL: 'var(--text-mute)',
                    WEAK: '#F59E0B',
                    BEAR: '#FF4444',
                  }
                  const labels: Record<string, string> = {
                    STRONG_BULL: '▲▲ Strong Bull',
                    BULL: '▲ Bull',
                    NEUTRAL: '— Neutral',
                    WEAK: '▼ Weak',
                    BEAR: '▼▼ Bear',
                  }
                  const color = colorMap[sig] || 'var(--text-mute)'
                  return (
                    <div key={sig} style={{
                      ...neuCard,
                      borderTop: `3px solid ${color}`,
                      padding: 16,
                    }}>
                      <div style={{
                        fontSize: 10, color: 'var(--text-mute)', marginBottom: 8,
                        fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}>{labels[sig] || sig}</div>
                      <div style={{
                        fontSize: 24, fontWeight: 700, color,
                        fontFamily: 'var(--font-mono)',
                      }}>{data.count}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4, fontFamily: 'var(--font-body)' }}>
                        stocks · {data.value_pct}%
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Holdings table */}
              <div style={{ ...neuCard }}>
                <div style={{
                  fontSize: 10, color: 'var(--text-mute)', letterSpacing: '0.08em',
                  marginBottom: 16, textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)', fontWeight: 700,
                }}>Holdings by Signal</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Symbol', 'Sector', 'Price', 'Avg Price', 'Gain%', 'Signal', 'RSI', 'MA50', 'MA200'].map(h => (
                          <th key={h} style={{
                            padding: '8px 12px',
                            textAlign: h === 'Symbol' || h === 'Sector' ? 'left' : 'right',
                            color: 'var(--text-mute)', fontWeight: 700, fontSize: 10,
                            letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                            fontFamily: 'var(--font-mono)',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...technical.holdings].sort((a: any, b: any) => {
                        const order = ['STRONG_BULL', 'BULL', 'NEUTRAL', 'WEAK', 'BEAR']
                        return order.indexOf(a.signal) - order.indexOf(b.signal)
                      }).map((h: any) => (
                        <tr key={h.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 12px', color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{h.symbol}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-dim)', fontFamily: 'var(--font-body)', fontSize: 12 }}>{h.sector}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-dim)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>₹{h.price?.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-mute)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>₹{h.avg_price?.toLocaleString('en-IN')}</td>
                          <td style={{
                            padding: '10px 12px', textAlign: 'right', fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color: h.gain_pct >= 0 ? 'var(--green)' : 'var(--red)',
                          }}>
                            {h.gain_pct >= 0 ? '+' : ''}{h.gain_pct?.toFixed(2)}%
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}><SignalChip signal={h.signal} /></td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-mute)', textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)' }} title="Phase 2">—</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-mute)', textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)' }} title="Phase 2">—</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-mute)', textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)' }} title="Phase 2">—</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--font-body)' }}>
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
                  <div key={i} style={{
                    ...neuCard,
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
                          fontSize: 10, color: 'var(--text-mute)', letterSpacing: '0.08em',
                          marginBottom: 12, textTransform: 'uppercase',
                          fontFamily: 'var(--font-mono)', fontWeight: 700,
                        }}>{card.label}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                          <span style={{ color: 'var(--green)', fontWeight: 700, fontFamily: 'var(--font-body)', fontSize: 13 }}>
                            ▲ {card.recs?.buy_count} BUY
                          </span>
                          <span style={{ color: 'var(--amber)', fontWeight: 700, fontFamily: 'var(--font-body)', fontSize: 13 }}>
                            ◆ {card.recs?.hold_count} HOLD
                          </span>
                          <span style={{ color: 'var(--red)', fontWeight: 700, fontFamily: 'var(--font-body)', fontSize: 13 }}>
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
                  <div key={title} style={{ ...neuCard }}>
                    <div style={{
                      fontSize: 10, color: 'var(--text-mute)', letterSpacing: '0.08em',
                      marginBottom: 16, textTransform: 'uppercase',
                      fontFamily: 'var(--font-mono)', fontWeight: 700,
                    }}>{title}</div>
                    {(holdings || []).map((h: any) => (
                      <div key={h.symbol} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div>
                            <span style={{
                              color: 'var(--accent)', fontWeight: 600, fontSize: 14,
                              fontFamily: 'var(--font-mono)',
                            }}>{h.symbol}</span>
                            <span style={{
                              color: 'var(--text-mute)', fontSize: 11, marginLeft: 8,
                              fontFamily: 'var(--font-body)',
                            }}>{h.sector}</span>
                          </div>
                          <RecChip rec={h.recommendation} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
                            Fund: <b style={{ color: scoreHex(h.fundamental_score) }}>{h.fundamental_score}</b>
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
                            Tech: <b style={{ color: scoreHex(h.technical_score) }}>{h.technical_score}</b>
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
                            Overall: <b style={{ color: scoreHex(h.overall_score) }}>{h.overall_score}</b>
                          </span>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.07)', borderRadius: 4, height: 5 }}>
                          <div style={{
                            width: `${h.overall_score}%`,
                            background: scoreHex(h.overall_score),
                            height: '100%', borderRadius: 4,
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Filter + Full Scorecard Table */}
              <div style={{ ...neuCard }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{
                    fontSize: 10, color: 'var(--text-mute)', letterSpacing: '0.08em',
                    textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 700,
                  }}>Full Scorecard</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['ALL', 'BUY', 'HOLD', 'WATCH'].map(f => (
                      <button key={f} onClick={() => setRecFilter(f)} style={{
                        background: recFilter === f ? 'var(--bg)' : 'var(--bg-surface)',
                        boxShadow: recFilter === f ? 'var(--neu-inset)' : 'var(--neu-raised-sm)',
                        color: recFilter === f ? 'var(--accent)' : 'var(--text-dim)',
                        border: 'none', borderRadius: 'var(--r-sm)',
                        padding: '4px 12px', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'var(--font-body)',
                        transition: 'all 0.15s',
                      }}>{f}</button>
                    ))}
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
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
                            color: sortCol === col.k ? 'var(--accent)' : 'var(--text-mute)',
                            fontWeight: 700, fontSize: 10, letterSpacing: '0.08em',
                            textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap',
                            fontFamily: 'var(--font-mono)',
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
                          <tr key={h.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 12px', color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{h.symbol}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-dim)', fontFamily: 'var(--font-body)', fontSize: 12 }}>{h.sector}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-dim)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatVal(h.current_value)}</td>
                            <td style={{
                              padding: '10px 12px', textAlign: 'right', fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              color: h.gain_pct >= 0 ? 'var(--green)' : 'var(--red)',
                            }}>
                              {h.gain_pct >= 0 ? '+' : ''}{h.gain_pct?.toFixed(2)}%
                            </td>
                            <td style={{
                              padding: '10px 12px', textAlign: 'right', fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              color: scoreHex(h.fundamental_score),
                            }}>{h.fundamental_score}</td>
                            <td style={{
                              padding: '10px 12px', textAlign: 'right', fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              color: scoreHex(h.technical_score),
                            }}>{h.technical_score}</td>
                            <td style={{
                              padding: '10px 12px', textAlign: 'right', fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              color: scoreHex(h.overall_score),
                            }}>{h.overall_score}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}><RecChip rec={h.recommendation} /></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--font-body)' }}>
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
