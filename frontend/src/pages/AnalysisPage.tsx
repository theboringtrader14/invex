import { useState, useEffect, useMemo } from 'react'
import { SortableHeader } from '../components/SortableHeader'
import { useSort } from '../hooks/useSort'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001'

const cleanSym = (s: string) =>
  s?.replace(/-EQ$/i, '').replace(/-BE$/i, '').replace(/\.NS$/i, '').replace(/\.BO$/i, '') || s

type Tab = 'fundamental' | 'technical' | 'mf' | 'scorecard'

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
    BUY: 'var(--green)', HOLD: 'var(--amber)', WATCH: 'var(--red)'
  }
  const color = colors[rec] || 'var(--text-mute)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', boxShadow: 'var(--neu-inset)',
      borderRadius: 'var(--r-sm)',
      padding: '3px 10px',
      color,
      fontSize: 10, fontWeight: 700,
      letterSpacing: 1,
      fontFamily: 'var(--font-mono)'
    }}>{rec}</span>
  )
}

function SignalChip({ signal }: { signal: string }) {
  const map: Record<string, { color: string; label: string }> = {
    STRONG_BULL: { color: '#22DD88', label: '▲▲ STRONG BULL' },
    BULL:        { color: '#22DD88', label: '▲ BULL' },
    NEUTRAL:     { color: 'var(--text-mute)', label: '— NEUTRAL' },
    WEAK:        { color: '#F59E0B', label: '▼ WEAK' },
    BEAR:        { color: '#FF4444', label: '▼▼ BEAR' }
  }
  const c = map[signal] || { color: 'var(--text-mute)', label: signal }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', boxShadow: 'var(--neu-inset)',
      borderRadius: 'var(--r-sm)',
      padding: '3px 10px',
      color: c.color,
      fontSize: 10, fontWeight: 700,
      fontFamily: 'var(--font-mono)',
      whiteSpace: 'nowrap'
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
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const trackStroke    = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(203,218,215,0.95)'
  const grooveDark     = isDark ? 'rgba(0,0,0,0.70)'       : 'rgba(130,155,150,0.55)'
  const grooveLight    = isDark ? 'rgba(255,255,255,0.06)'  : 'rgba(255,255,255,0.88)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size}>
        <defs>
          {/* Inset groove filter: dark shadow top-left, light highlight bottom-right */}
          <filter id="arc-groove" x="-12%" y="-12%" width="124%" height="124%">
            {/* Dark at top-left */}
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="b1"/>
            <feOffset in="b1" dx="2.5" dy="2.5" result="bs1"/>
            <feComposite in="SourceAlpha" in2="bs1" operator="out" result="topLeft"/>
            <feFlood floodColor={grooveDark} result="darkC"/>
            <feComposite in="darkC" in2="topLeft" operator="in" result="dark"/>
            {/* Light at bottom-right */}
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="b2"/>
            <feOffset in="b2" dx="-2.5" dy="-2.5" result="bs2"/>
            <feComposite in="SourceAlpha" in2="bs2" operator="out" result="btmRight"/>
            <feFlood floodColor={grooveLight} result="lightC"/>
            <feComposite in="lightC" in2="btmRight" operator="in" result="light"/>
            <feMerge>
              <feMergeNode in="SourceGraphic"/>
              <feMergeNode in="dark"/>
              <feMergeNode in="light"/>
            </feMerge>
          </filter>
        </defs>
        {/* Groove track */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={trackStroke} strokeWidth={9}
          filter="url(#arc-groove)"/>
        {/* Progress arc */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={hexColor} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} />
        <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle"
          fill={hexColor} fontSize={size * 0.22} fontWeight={700} style={{ fontFamily: 'var(--font-mono)' }}>
          {score}
        </text>
        <text x={cx} y={cy + size * 0.2} textAnchor="middle" dominantBaseline="middle"
          fill="var(--text-mute)" fontSize={size * 0.1} style={{ fontFamily: 'var(--font-mono)' }}>
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
          fontWeight: 600
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
      <div style={{ height: 10, borderRadius: 6, background: 'var(--bg)', boxShadow: 'var(--neu-inset)', padding: '2px 3px' }}>
        <div style={{
          width: `${Math.min(score, 100)}%`,
          background: hexColor,
          height: '100%',
          borderRadius: 4,
          transition: 'width 0.6s'
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
      width
    }} />
  )
}

const neuCard: React.CSSProperties = {
  background: 'var(--bg-surface)',
  boxShadow: 'var(--neu-raised)',
  borderRadius: 'var(--r-lg)',
  padding: 20
}

function GradeChip({ grade }: { grade?: string }) {
  if (!grade) return <span style={{ color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', fontSize: 9 }}>—</span>
  const colorMap: Record<string, string> = {
    A: '#0EA66E', B: '#2dd4bf', C: '#F59E0B', D: '#FF4444',
  }
  const color = colorMap[grade] || 'var(--text-mute)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', boxShadow: 'var(--neu-inset)',
      borderRadius: 4, padding: '2px 8px',
      color, fontSize: 10, fontWeight: 700,
      fontFamily: 'var(--font-mono)',
      letterSpacing: '0.5px', textTransform: 'uppercase',
      minWidth: 24
    }}>{grade}</span>
  )
}

type MFTabProps = {
  mfData: any
  funds: any[]
  fmt: (v: number) => string
  fmtPct: (v: number) => string
  neuCard: React.CSSProperties
}

function MFAnalysisTab({ mfData, funds, fmt, fmtPct, neuCard }: MFTabProps) {
  const { sorted, sortKey: mfSortKey, sortDir: mfSortDir, handleSort: handleMFSort } = useSort<any>(funds, 'pnl_pct')

  const gradeColor: Record<string, string> = { A: '#0EA66E', B: '#2dd4bf', C: '#F59E0B', D: '#FF4444' }
  const thStyle: React.CSSProperties = { position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Section A — Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Invested',  value: fmt(mfData.total_invested), color: 'var(--text)' },
          { label: 'Current Value',   value: fmt(mfData.total_current),  color: 'var(--text)' },
          { label: `Total P&L  ${fmtPct(mfData.total_pnl_pct)}`, value: fmt(Math.abs(mfData.total_pnl)), color: mfData.total_pnl >= 0 ? 'var(--green)' : 'var(--red)' },
        ].map(c => (
          <div key={c.label} style={{ ...neuCard }}>
            <div style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 400, marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: c.color, lineHeight: 1 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Section B — Fund holdings table */}
      <div style={{ ...neuCard }}>
        <div style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 400, marginBottom: 16 }}>
          Fund Holdings · {funds.length}
        </div>
        <div className="hide-scrollbar" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 436 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <SortableHeader label="Fund Name"  sortKey="fund_name"       currentKey={mfSortKey as string | null} currentDir={mfSortDir} onSort={k => handleMFSort(k as keyof any)} align="left" style={thStyle} />
                <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-mute)', fontWeight: 400, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', ...thStyle }}>Account</th>
                <SortableHeader label="Units"       sortKey="units"           currentKey={mfSortKey as string | null} currentDir={mfSortDir} onSort={k => handleMFSort(k as keyof any)} style={thStyle} />
                <SortableHeader label="NAV"         sortKey="nav"             currentKey={mfSortKey as string | null} currentDir={mfSortDir} onSort={k => handleMFSort(k as keyof any)} style={thStyle} />
                <SortableHeader label="Invested"    sortKey="invested_amount" currentKey={mfSortKey as string | null} currentDir={mfSortDir} onSort={k => handleMFSort(k as keyof any)} style={thStyle} />
                <SortableHeader label="Current"     sortKey="current_value"   currentKey={mfSortKey as string | null} currentDir={mfSortDir} onSort={k => handleMFSort(k as keyof any)} style={thStyle} />
                <SortableHeader label="P&L"         sortKey="pnl"             currentKey={mfSortKey as string | null} currentDir={mfSortDir} onSort={k => handleMFSort(k as keyof any)} style={thStyle} />
                <SortableHeader label="P&L%"        sortKey="pnl_pct"         currentKey={mfSortKey as string | null} currentDir={mfSortDir} onSort={k => handleMFSort(k as keyof any)} style={thStyle} />
                <SortableHeader label="Grade"       sortKey="grade"           currentKey={mfSortKey as string | null} currentDir={mfSortDir} onSort={k => handleMFSort(k as keyof any)} style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((f: any) => {
                const pnlColor = f.pnl >= 0 ? 'var(--green)' : 'var(--red)'
                const gc = gradeColor[f.grade] || 'var(--text-mute)'
                return (
                  <tr key={`mf_${f.id}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12, maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.fund_name}>
                      {f.fund_name_short}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap' }}>{f.account_nickname || f.account_id?.substring(0, 6) || '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{f.units?.toFixed(3)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>₹{f.nav?.toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{fmt(f.invested_amount)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{fmt(f.current_value)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontFamily: 'var(--font-mono)', color: pnlColor }}>{f.pnl >= 0 ? '+' : ''}{fmt(Math.abs(f.pnl))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontFamily: 'var(--font-mono)', color: pnlColor }}>{fmtPct(f.pnl_pct)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', boxShadow: 'var(--neu-inset)', borderRadius: 4, padding: '2px 8px', color: gc, fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', minWidth: 24 }}>{f.grade}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section C — Phase 2 placeholder */}
      <div style={{ ...neuCard, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 16, opacity: 0.4 }}>◎</span>
        <span style={{ fontSize: 12, color: 'var(--text-mute)', fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>
          Category analysis, expense ratios, and 1Y / 3Y returns coming in Phase 2 — data from mfapi.in
        </span>
      </div>
    </div>
  )
}

export default function AnalysisPage() {
  const [tab, setTab] = useState<Tab>('fundamental')
  const [fundamental, setFundamental] = useState<any>(null)
  const [technical, setTechnical] = useState<any>(null)
  const [scorecard, setScorecard] = useState<any>(null)
  const [mfData, setMfData] = useState<any>(null)
  const [mfLoading, setMfLoading] = useState(false)
  const [enriched, setEnriched] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortCol, setSortCol] = useState('overall_score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>('desc')
  const [fundSortCol, setFundSortCol] = useState<string>('current_value')
  const [fundSortDir, setFundSortDir] = useState<'asc' | 'desc' | null>('desc')
  const [techSortCol, setTechSortCol] = useState<string>('gain_pct')
  const [techSortDir, setTechSortDir] = useState<'asc' | 'desc' | null>('desc')
  const [recFilter, setRecFilter] = useState<string>('ALL')
  const [sectorFilter, setSectorFilter] = useState<string | null>(null)
  const [signalFilter, setSignalFilter] = useState<string | null>(null)
  const [alertFilter, setAlertFilter] = useState<'all' | 'danger' | 'warn' | 'ok'>('all')

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

    // Fetch enriched data independently — may be slower (Yahoo Finance fetch)
    fetch(`${API}/api/v1/analysis/holdings-enriched`)
      .then(r => r.json())
      .then(d => setEnriched(Array.isArray(d) ? d : []))
      .catch(() => setEnriched([]))

    // Portfolio summary for header strip
    fetch(`${API}/api/v1/portfolio/summary`)
      .then(r => r.json())
      .then(d => setSummary(d))
      .catch(() => {})
  }, [])

  // Lazy-load MF data when user opens that tab
  useEffect(() => {
    if (tab === 'mf' && !mfData && !mfLoading) {
      setMfLoading(true)
      fetch(`${API}/api/v1/analysis/mutual-funds`)
        .then(r => r.json())
        .then(d => { setMfData(d); setMfLoading(false) })
        .catch(() => setMfLoading(false))
    }
  }, [tab, mfData, mfLoading])

  // Look up enriched entry by symbol (handles -EQ/-BE suffix)
  const getE = (symbol: string) =>
    enriched.find(e => e.symbol === symbol.replace(/-EQ$/i, '').replace(/-BE$/i, '')) ?? null

  // Sort handler factory — cycles desc → asc → null → desc
  const makeSortHandler = (
    col: string, setCol: (c: string) => void,
    dir: 'asc' | 'desc' | null, setDir: (d: 'asc' | 'desc' | null) => void
  ) => (key: string) => {
    if (col === key) setDir(dir === 'desc' ? 'asc' : dir === 'asc' ? null : 'desc')
    else { setCol(key); setDir('desc') }
  }

  const handleFundSort  = makeSortHandler(fundSortCol, setFundSortCol, fundSortDir, setFundSortDir)
  const handleTechSort  = makeSortHandler(techSortCol, setTechSortCol, techSortDir, setTechSortDir)
  const handleScorecardSort = makeSortHandler(sortCol, setSortCol, sortDir, setSortDir)

  // Pre-join fundamental top_holdings with enriched data for sorting
  const joinedHoldings = useMemo(() => {
    if (!fundamental) return []
    return (fundamental.top_holdings || []).map((h: any) => {
      const e = getE(h.symbol)
      return { ...h, _pe: e?.pe ?? null, _grade: e?.grade ?? '', _signal: e?.signal ?? '', _mktcap: e?.market_cap_category ?? '' }
    })
  }, [fundamental, enriched])

  const sortedFundHoldings = useMemo(() => {
    if (!fundSortCol || !fundSortDir) return joinedHoldings
    return [...joinedHoldings].sort((a: any, b: any) => {
      const fieldMap: Record<string, string> = { current_value: 'current_value', weight_pct: 'weight_pct', gain_pct: 'gain_pct', symbol: 'symbol', sector: 'sector', pe: '_pe', grade: '_grade', signal: '_signal', mkt_cap: '_mktcap' }
      const field = fieldMap[fundSortCol] || fundSortCol
      const av = a[field]; const bv = b[field]
      if (av == null) return 1; if (bv == null) return -1
      if (typeof av === 'number') return fundSortDir === 'asc' ? av - bv : bv - av
      return fundSortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
  }, [joinedHoldings, fundSortCol, fundSortDir])

  const sortedTechHoldings = useMemo(() => {
    if (!technical) return []
    const base = [...technical.holdings].sort((a: any, b: any) => {
      const order = ['STRONG_BULL', 'BULL', 'NEUTRAL', 'WEAK', 'BEAR']
      return order.indexOf(a.signal) - order.indexOf(b.signal)
    })
    if (!techSortCol || !techSortDir) return base
    return [...(technical.holdings)].sort((a: any, b: any) => {
      const fieldMap: Record<string, string> = { symbol: 'symbol', sector: 'sector', cmp: 'price', gain_pct: 'gain_pct', signal: 'signal', rsi: 'rsi' }
      const field = fieldMap[techSortCol] || techSortCol
      const av = a[field]; const bv = b[field]
      if (av == null) return 1; if (bv == null) return -1
      if (typeof av === 'number') return techSortDir === 'asc' ? av - bv : bv - av
      const signalOrder = ['STRONG_BULL', 'BULL', 'NEUTRAL', 'WEAK', 'BEAR']
      if (field === 'signal') return techSortDir === 'asc' ? signalOrder.indexOf(av) - signalOrder.indexOf(bv) : signalOrder.indexOf(bv) - signalOrder.indexOf(av)
      return techSortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
  }, [technical, techSortCol, techSortDir])

  // Portfolio-level grade from enriched holdings
  const portfolioGrade = (() => {
    if (!enriched.length) return null
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
    enriched.forEach(e => { if (e.grade) counts[e.grade] = (counts[e.grade] || 0) + 1 })
    const total = enriched.length
    if ((counts.A + counts.B) / total >= 0.6) return 'A'
    if ((counts.A + counts.B) / total >= 0.4) return 'B'
    if (counts.D / total >= 0.4) return 'D'
    return 'C'
  })()

  const formatVal = (v: number) => {
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`
    return `₹${v.toLocaleString('en-IN')}`
  }

  const TABS: Tab[] = ['fundamental', 'technical', 'mf', 'scorecard']
  const tabIndex = TABS.indexOf(tab)

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
          fontFamily: 'var(--font-body)'
        }}>
        Retry
      </button>
    </div>
  )

  return (
    <div style={{ animation: 'fadeUp 400ms cubic-bezier(0,0,0.2,1) both' }}>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)', paddingBottom: 16 }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 800,
          color: 'var(--accent)',
          marginBottom: 4
        }}>
          Analysis
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
          {fundamental
            ? `${fundamental.total_holdings} holdings · ${formatVal(fundamental.total_value || 0)}`
            : 'Fundamental + Technical deep-dive'}
        </div>
      </div>


      {/* Tab bar — sliding pill */}
      <div style={{
        position: 'relative',
        display: 'flex',
        background: 'var(--bg-surface)',
        boxShadow: 'var(--neu-inset)',
        borderRadius: 'var(--r-lg)',
        padding: 4,
        width: '100%',
        marginBottom: 20,
        marginTop: 20
      }}>
        {/* Sliding raised pill */}
        <div style={{
          position: 'absolute',
          top: 4, bottom: 4,
          left: 4,
          width: 'calc((100% - 8px) / 4)',
          background: 'var(--bg-surface)',
          boxShadow: 'var(--neu-raised-sm)',
          borderRadius: 'calc(var(--r-lg) - 4px)',
          transform: `translateX(${tabIndex * 100}%)`,
          transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'none',
        }} />
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1,
            padding: '8px 0',
            borderRadius: 'calc(var(--r-lg) - 4px)',
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: 1,
            cursor: 'pointer',
            border: 'none',
            textTransform: 'uppercase',
            background: 'transparent',
            boxShadow: 'none',
            color: tab === t ? 'var(--accent)' : 'var(--text-dim)',
            transition: 'color 0.2s',
            fontFamily: 'var(--font-mono)',
            position: 'relative',
            zIndex: 1,
          }}>
            {{ fundamental: 'FUNDAMENTAL', technical: 'TECHNICAL', mf: 'MUTUAL FUNDS', scorecard: 'SCORECARD' }[t]}
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
              <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'stretch' }}>
                {/* Health Score Card — compact Option B */}
                <div style={{ ...neuCard }}>
                  <div style={{
                    fontSize: 10, color: 'var(--text-mute)', letterSpacing: '1px',
                    marginBottom: 12, textTransform: 'uppercase',
                    fontFamily: 'var(--font-mono)', fontWeight: 400
                  }}>Portfolio Health</div>

                  {/* Big score + /100 */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 8 }}>
                    <span style={{
                      fontSize: 44, fontWeight: 800, lineHeight: 1,
                      fontFamily: 'var(--font-mono)',
                      color: scoreHex(fundamental.health_score.total)
                    }}>{fundamental.health_score.total}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)' }}>/100</span>
                  </div>

                  {/* Full-width gauge bar */}
                  <div style={{ height: 8, borderRadius: 5, background: 'var(--bg)', boxShadow: 'var(--neu-inset)', padding: '1px 2px', marginBottom: 16 }}>
                    <div style={{
                      width: `${fundamental.health_score.total}%`, height: '100%',
                      borderRadius: 4, background: scoreHex(fundamental.health_score.total),
                      transition: 'width 0.6s'
                    }} />
                  </div>

                  {/* Three inset metric chips */}
                  <div style={{ display: 'flex', gap: 6, overflow: 'hidden' }}>
                    {[
                      { label: 'Diversification', score: Math.round(fundamental.health_score.diversification / 0.4), sub: `${fundamental.health_score.sectors_count} sectors` },
                      { label: 'Concentration',   score: Math.round(fundamental.health_score.concentration / 0.3),   sub: `top3 = ${fundamental.health_score.top3_concentration_pct}%` },
                      { label: 'Win Rate',         score: Math.round(fundamental.health_score.gain_loss_balance / 0.3), sub: `${fundamental.health_score.winners_pct}%` },
                    ].map(m => (
                      <div key={m.label} style={{
                        flex: '1 1 0', minWidth: 0, overflow: 'hidden',
                        background: 'var(--bg)', boxShadow: 'var(--neu-inset)',
                        borderRadius: 'var(--r-md)', padding: '8px 8px',
                        display: 'flex', flexDirection: 'column', gap: 2,
                      }}>
                        <span style={{ fontSize: 8, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.label}</span>
                        <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, fontFamily: 'var(--font-mono)', color: scoreHex(m.score) }}>{m.score}</span>
                        <span style={{ fontSize: 9, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.sub}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sector Allocation */}
                <div style={{ ...neuCard }}>
                  <div style={{
                    fontSize: 10, color: 'var(--text-mute)', letterSpacing: '1px',
                    marginBottom: 16, textTransform: 'uppercase',
                    fontFamily: 'var(--font-mono)', fontWeight: 400
                  }}>Sector Allocation</div>
                  {(() => {
                    const COLORS = [
                      '#2dd4bf','#0EA66E','#6366f1','#f59e0b',
                      '#06b6d4','#8b5cf6','#ef4444','#64748b',
                      '#0891b2','#d97706','#10b981','#ec4899',
                    ]
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
                        {fundamental.sector_allocation.map((s: any, i: number) => {
                          const color = COLORS[i % COLORS.length]
                          const isActive = sectorFilter === s.sector
                          return (
                            <div key={s.sector}
                              onClick={() => setSectorFilter(isActive ? null : s.sector)}
                              style={{
                                height: 80,
                                background: isActive ? color + '18' : 'var(--bg-surface)',
                                boxShadow: isActive ? 'var(--neu-inset)' : 'var(--neu-raised-sm)',
                                borderRadius: 'var(--r-md)',
                                padding: '12px 14px',
                                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                transition: 'box-shadow 0.18s, background 0.18s',
                              }}>
                              <span style={{
                                fontSize: 9, color, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                textTransform: 'uppercase', lineHeight: 1.3,
                                display: '-webkit-box', WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
                              }}>{s.sector}</span>
                              <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{s.pct}%</div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* Red Flags */}
              {(() => {
                const flags: any[] = fundamental.red_flags || []
                const dangerColor = '#FF4444'
                const warnColor   = '#F59E0B'
                return (
                  <div style={{ ...neuCard, padding: '14px 20px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 400, marginBottom: flags.length ? 12 : 0 }}>Red Flags</div>
                    {flags.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                        <span style={{ color: 'var(--green)', fontSize: 13 }}>✓</span>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>No major red flags detected</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {flags.map((f: any, i: number) => {
                          const color = f.severity === 'danger' ? dangerColor : warnColor
                          const icon  = f.severity === 'danger' ? '●' : '⚠'
                          return (
                            <div key={i} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 7,
                              background: color + '12',
                              border: `1px solid ${color}28`,
                              borderRadius: 'var(--r-sm)',
                              padding: '6px 12px',
                            }}>
                              <span style={{ color, fontSize: 10, lineHeight: 1 }}>{icon}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>{f.msg}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Gain Distribution */}
              <div style={{ ...neuCard }}>
                <div style={{
                  fontSize: 10, color: 'var(--text-mute)', letterSpacing: '1px',
                  marginBottom: 12, textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)', fontWeight: 400
                }}>Gain / Loss Distribution</div>
                {(() => {
                  const dist: any[] = fundamental.gain_distribution
                  const maxCount = Math.max(...dist.map((x: any) => x.count), 1)
                  return (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 76, paddingTop: 14 }}>
                      {dist.map((b: any, i: number) => {
                        const isNeg = i < 2
                        const barH = Math.max(4, Math.round((b.count / maxCount) * 40 * 0.85))
                        const color = isNeg ? 'var(--red)' : 'var(--green)'
                        const colorHex = isNeg ? '#FF4444' : '#0EA66E'
                        return (
                          <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            {/* Count label */}
                            <div style={{
                              fontSize: 10, fontWeight: 700, color,
                              fontFamily: 'var(--font-mono)', textAlign: 'center',
                              opacity: b.count === 0 ? 0.35 : 1
                            }}>{b.count}</div>
                            {/* Bar — 75% width, gradient to-top, glow */}
                            <div style={{
                              width: '75%', height: `${barH}px`,
                              borderRadius: '3px 3px 0 0',
                              background: isNeg
                                ? 'linear-gradient(to top, rgba(255,68,68,0.5), rgba(255,68,68,0.9))'
                                : 'linear-gradient(to top, rgba(14,166,110,0.5), rgba(14,166,110,0.9))',
                              boxShadow: b.count > 0 ? `0 0 6px ${colorHex}55` : 'none',
                              transition: 'height 0.4s cubic-bezier(0.4,0,0.2,1)',
                            }} />
                            {/* Category label */}
                            <div style={{
                              fontSize: 9, color: 'var(--text-mute)', textAlign: 'center',
                              fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap'
                            }}>{b.label}</div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>

              {/* Top Holdings Table */}
              <div style={{ ...neuCard }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 400 }}>Top Holdings</div>
                  {sectorFilter && (() => {
                    const sd = fundamental.sector_allocation.find((s: any) => s.sector === sectorFilter)
                    const COLORS = ['#2dd4bf','#0EA66E','#6366f1','#f59e0b','#06b6d4','#8b5cf6','#ef4444','#64748b','#0891b2','#d97706','#10b981','#ec4899']
                    const ci = fundamental.sector_allocation.findIndex((s: any) => s.sector === sectorFilter)
                    const color = COLORS[ci % COLORS.length]
                    return (
                      <>
                        {sd && (
                          <span style={{
                            background: 'var(--bg)', boxShadow: 'var(--neu-inset)',
                            borderRadius: 'var(--r-pill)', padding: '3px 10px',
                            fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color,
                          }}>{sd.count} stocks · {formatVal(sd.value)}</span>
                        )}
                        <button onClick={() => setSectorFilter(null)} style={{
                          fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)',
                          background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)',
                          border: 'none', borderRadius: 'var(--r-pill)',
                          padding: '4px 12px', cursor: 'pointer', fontWeight: 600,
                        }}>✕ Clear</button>
                      </>
                    )
                  })()}
                </div>
                <div className="hide-scrollbar" style={{ overflowX: 'auto', maxHeight: '402px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <SortableHeader label="Symbol"  sortKey="symbol"        currentKey={fundSortCol} currentDir={fundSortDir} onSort={handleFundSort} align="left"   style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }} />
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-mute)', fontWeight: 400, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>Account</th>
                        <SortableHeader label="Sector"  sortKey="sector"        currentKey={fundSortCol} currentDir={fundSortDir} onSort={handleFundSort}                style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }} />
                        <SortableHeader label="Value"   sortKey="current_value" currentKey={fundSortCol} currentDir={fundSortDir} onSort={handleFundSort}                style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }} />
                        <SortableHeader label="Weight"  sortKey="weight_pct"    currentKey={fundSortCol} currentDir={fundSortDir} onSort={handleFundSort}                style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }} />
                        <SortableHeader label="Gain%"   sortKey="gain_pct"      currentKey={fundSortCol} currentDir={fundSortDir} onSort={handleFundSort}                style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }} />
                        <SortableHeader label="PE"      sortKey="pe"            currentKey={fundSortCol} currentDir={fundSortDir} onSort={handleFundSort}                style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }} />
                        <SortableHeader label="Mkt Cap" sortKey="mkt_cap"       currentKey={fundSortCol} currentDir={fundSortDir} onSort={handleFundSort}                style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }} />
                        <SortableHeader label="Grade"   sortKey="grade"         currentKey={fundSortCol} currentDir={fundSortDir} onSort={handleFundSort}                style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }} />
                        <SortableHeader label="Signal"  sortKey="signal"        currentKey={fundSortCol} currentDir={fundSortDir} onSort={handleFundSort}                style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFundHoldings.filter((h: any) => !sectorFilter || h.sector === sectorFilter).map((h: any, i: number) => {
                        const e = getE(h.symbol)
                        return (
                          <tr key={h.symbol + '_' + (h.account_id || i)} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{cleanSym(h.symbol)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap' }}>{h.account_nickname || (h.account_id ? h.account_id.substring(0, 6) : '—')}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-body)', fontSize: 12 }}>{h.sector}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{formatVal(h.current_value)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-mute)', fontFamily: 'var(--font-mono)' }}>{h.weight_pct}%</td>
                            <td style={{
                              padding: '10px 12px', textAlign: 'center', fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              color: h.gain_pct >= 0 ? 'var(--green)' : 'var(--red)'
                            }}>
                              {h.gain_pct >= 0 ? '+' : ''}{h.gain_pct?.toFixed(2)}%
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                              {e?.pe ? e.pe.toFixed(1) : '—'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-mute)', whiteSpace: 'nowrap' }}>
                              {e?.market_cap_category ?? '—'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <GradeChip grade={e?.grade} />
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, fontStyle: 'italic', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                              {e?.signal ?? '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {enriched.length === 0 && (
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--font-body)' }}>
                    · PE, Grade, Signal: restart backend then trigger a portfolio refresh to populate
                  </div>
                )}
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
                    BEAR: '#FF4444'
                  }
                  const labels: Record<string, string> = {
                    STRONG_BULL: '▲▲ Strong Bull',
                    BULL: '▲ Bull',
                    NEUTRAL: '— Neutral',
                    WEAK: '▼ Weak',
                    BEAR: '▼▼ Bear'
                  }
                  const color = colorMap[sig] || 'var(--text-mute)'
                  const isActive = signalFilter === sig
                  return (
                    <div key={sig} onClick={() => setSignalFilter(isActive ? null : sig)} style={{
                      ...neuCard,
                      padding: 16,
                      cursor: 'pointer',
                      boxShadow: isActive ? 'var(--neu-inset)' : 'var(--neu-raised)',
                      transition: 'box-shadow 0.18s',
                    }}>
                      <div style={{
                        fontSize: 10, color, marginBottom: 8,
                        fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '1px',
                        textTransform: 'uppercase'
                      }}>{labels[sig] || sig}</div>
                      <div style={{
                        fontSize: 24, fontWeight: 700, color,
                        fontFamily: 'var(--font-mono)'
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 400 }}>Holdings by Signal</div>
                  {signalFilter && (
                    <button onClick={() => setSignalFilter(null)} style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)',
                      background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)',
                      border: 'none', borderRadius: 'var(--r-pill)',
                      padding: '4px 12px', cursor: 'pointer', fontWeight: 600,
                      letterSpacing: '0.5px'
                    }}>
                      ✕ Clear Filter
                    </button>
                  )}
                </div>
                <div className="hide-scrollbar" style={{ overflowX: 'auto', maxHeight: '369px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <SortableHeader label="Symbol"  sortKey="symbol"   currentKey={techSortCol} currentDir={techSortDir} onSort={handleTechSort} align="left" style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }} />
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-mute)', fontWeight: 400, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>Account</th>
                        <SortableHeader label="Sector"  sortKey="sector"   currentKey={techSortCol} currentDir={techSortDir} onSort={handleTechSort}              style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }} />
                        <SortableHeader label="CMP"    sortKey="cmp"      currentKey={techSortCol} currentDir={techSortDir} onSort={handleTechSort}              style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }} />
                        <SortableHeader label="vs Avg" sortKey="gain_pct" currentKey={techSortCol} currentDir={techSortDir} onSort={handleTechSort}              style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }} />
                        <SortableHeader label="Signal" sortKey="signal"   currentKey={techSortCol} currentDir={techSortDir} onSort={handleTechSort}              style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }} />
                        <SortableHeader label="RSI"    sortKey="rsi"      currentKey={techSortCol} currentDir={techSortDir} onSort={handleTechSort}              style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }} />
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-mute)', fontWeight: 400, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>50DMA</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-mute)', fontWeight: 400, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>200DMA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTechHoldings.filter((h: any) => !signalFilter || h.signal === signalFilter).map((h: any, i: number) => {
                        const pct = h.gain_pct || 0
                        const barW = Math.min(Math.abs(pct), 100)
                        const barColor = pct >= 0 ? '#0EA66E' : '#FF4444'
                        const rsiColor = h.rsi == null ? 'var(--text-mute)'
                          : h.rsi > 70 ? '#FF4444'
                          : h.rsi < 30 ? '#0EA66E'
                          : '#F59E0B'
                        const DmaChip = ({ above }: { above: boolean | null | undefined }) => above == null
                          ? <span style={{ color: 'var(--text-mute)', fontSize: 11 }}>—</span>
                          : <span style={{ fontSize: 10, fontWeight: 700, color: above ? '#0EA66E' : '#FF4444', fontFamily: 'var(--font-mono)' }}>{above ? '↑' : '↓'}</span>
                        return (
                          <tr key={`tech_${h.symbol}_${h.account_id || i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{cleanSym(h.symbol)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap' }}>{h.account_nickname || (h.account_id ? h.account_id.substring(0, 6) : '—')}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-body)', fontSize: 12 }}>{h.sector}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>₹{h.price?.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '10px 12px', minWidth: 160 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, height: 10, borderRadius: 6, background: 'var(--bg)', boxShadow: 'var(--neu-inset)', padding: '2px 3px' }}>
                                  <div style={{ width: `${barW}%`, height: '100%', background: barColor, borderRadius: 4 }} />
                                </div>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: barColor, minWidth: 52, textAlign: 'right' }}>
                                  {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}><SignalChip signal={h.signal} /></td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                              {h.rsi != null
                                ? <span style={{ color: rsiColor, fontWeight: 700 }}>{h.rsi.toFixed(0)}{h.rsi > 70 ? ' ↑' : h.rsi < 30 ? ' ↓' : ''}</span>
                                : <span style={{ color: 'var(--text-mute)' }}>—</span>}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}><DmaChip above={h.above_50} /></td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}><DmaChip above={h.above_200} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Alerts */}
              {(() => {
                const alerts: { type: 'warn' | 'danger' | 'ok'; msg: string }[] = []
                for (const h of technical.holdings) {
                  const sym = cleanSym(h.symbol)
                  if (h.signal === 'BEAR') alerts.push({ type: 'danger', msg: `${sym} in downtrend` })
                  if ((h.gain_pct || 0) < -20) alerts.push({ type: 'danger', msg: `${sym} down ${h.gain_pct?.toFixed(1)}% — review position` })
                  if (h.signal === 'WEAK') alerts.push({ type: 'warn', msg: `${sym} showing weakness — monitor closely` })
                  if (h.signal === 'STRONG_BULL') alerts.push({ type: 'ok', msg: `${sym} strong momentum +${h.gain_pct?.toFixed(1)}%` })
                }
                if (alerts.length === 0) return null
                const iconMap = { warn: '⚠', danger: '●', ok: '✓' }
                const colorMap = { warn: '#F59E0B', danger: '#FF4444', ok: '#0EA66E' }
                const chipLabels: { key: 'all' | 'danger' | 'warn' | 'ok'; label: string; color: string }[] = [
                  { key: 'all',    label: `All · ${alerts.length}`,                              color: 'var(--accent)' },
                  { key: 'danger', label: `Danger · ${alerts.filter(a => a.type === 'danger').length}`, color: '#FF4444' },
                  { key: 'warn',   label: `Watch · ${alerts.filter(a => a.type === 'warn').length}`,   color: '#F59E0B' },
                  { key: 'ok',     label: `Strong · ${alerts.filter(a => a.type === 'ok').length}`,    color: '#0EA66E' },
                ]
                const filtered = alertFilter === 'all' ? alerts : alerts.filter(a => a.type === alertFilter)
                return (
                  <div style={{ ...neuCard }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 400 }}>Action Alerts</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {chipLabels.map(c => {
                          const isActive = alertFilter === c.key
                          return (
                            <button key={c.key} onClick={() => setAlertFilter(c.key)} style={{
                              display: 'inline-flex', alignItems: 'center',
                              padding: '4px 14px', borderRadius: 'var(--r-pill)',
                              fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
                              letterSpacing: '0.5px',
                              color: isActive ? c.color : 'var(--text-mute)',
                              background: 'var(--bg)',
                              boxShadow: isActive ? 'var(--neu-inset)' : 'var(--neu-raised-sm)',
                              border: 'none', cursor: 'pointer',
                              transition: 'box-shadow 0.18s, color 0.18s',
                            }}>{c.label}</button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="hide-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 294, overflowY: 'auto' }}>
                      {filtered.map((a, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 'var(--r-sm)', background: colorMap[a.type] + '10', border: `1px solid ${colorMap[a.type]}22` }}>
                          <span style={{ color: colorMap[a.type], fontSize: 13 }}>{iconMap[a.type]}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>{a.msg}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ═══ TAB 3: MUTUAL FUNDS ═══ */}
          {tab === 'mf' && (() => {
            const fmt = (v: number) => v >= 1e5 ? `₹${(v/1e5).toFixed(2)}L` : `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
            const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

            if (mfLoading) return (
              <div style={{ display: 'grid', gap: 16 }}>
                <Skeleton height={80} />
                <Skeleton height={300} />
              </div>
            )
            if (!mfData) return (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-mute)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
                No mutual fund data — sync Zerodha account first
              </div>
            )

            const funds: any[] = mfData.funds || []
            return (
              <MFAnalysisTab
                mfData={mfData}
                funds={funds}
                fmt={fmt}
                fmtPct={fmtPct}
                neuCard={neuCard}
              />
            )
          })()}

          {/* ═══ TAB 4: SCORECARD ═══ */}
          {tab === 'scorecard' && scorecard && (
            <div style={{ display: 'grid', gap: 20 }}>
              {/* Summary Cards — always 5 cols (Grade conditional, Needs Attention always last) */}
              <div style={{ display: 'grid', gridTemplateColumns: portfolioGrade ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
                {/* Portfolio Grade card */}
                {portfolioGrade && (() => {
                  const gradeColorMap: Record<string, string> = { A: '#0EA66E', B: '#2dd4bf', C: '#F59E0B', D: '#FF4444' }
                  const gc = gradeColorMap[portfolioGrade] || 'var(--text-mute)'
                  const qualCount = enriched.filter(e => ['A','B'].includes(e.grade)).length
                  return (
                    <div style={{ ...neuCard, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 400, marginBottom: 10 }}>Portfolio Grade</div>
                      <div style={{ fontSize: 56, fontWeight: 800, fontFamily: 'var(--font-mono)', color: gc, lineHeight: 1, marginBottom: 10 }}>{portfolioGrade}</div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-body)', textAlign: 'center' }}>
                        <span style={{ color: gc, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{qualCount}</span>
                        <span style={{ color: 'var(--text-mute)' }}>/{enriched.length} quality</span>
                      </div>
                    </div>
                  )
                })()}
                {/* Arc score cards — Overall, Health, Technical */}
                {(() => {
                  const portfolioHealth = fundamental?.health_score?.total ?? scorecard.portfolio.fundamental_score
                  const technicalScore = scorecard.portfolio.technical_score
                  const overallScore = Math.round((portfolioHealth * 0.5) + (technicalScore * 0.5))
                  return [
                    { label: 'Overall Score',    value: overallScore    },
                    { label: 'Portfolio Health', value: portfolioHealth  },
                    { label: 'Technical',        value: technicalScore   },
                  ]
                })().map((card, i) => (
                  <div key={i} style={{ ...neuCard, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16 }}>
                    <ScoreArc score={card.value} size={90} label={card.label} />
                  </div>
                ))}
                {/* Needs Attention card — compact bottom_3 */}
                {(() => {
                  const bottom3 = scorecard.portfolio.bottom_3 || []
                  const uniqueRecs: string[] = [...new Set<string>(bottom3.map((h: any) => h.recommendation as string))]
                  return (
                    <div style={{ ...neuCard, padding: '16px 18px' }}>
                      {/* Header: label + rec chip(s) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 400 }}>Needs Attention</div>
                        {uniqueRecs.map(rec => <RecChip key={rec} rec={rec} />)}
                      </div>
                      {bottom3.length === 0 ? (
                        <div style={{ fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--font-body)', textAlign: 'center', paddingTop: 8 }}>All holdings healthy</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {bottom3.map((h: any) => (
                            <div key={h.symbol} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{cleanSym(h.symbol)}</span>
                              <span style={{ color: 'var(--text-mute)', fontSize: 10, fontFamily: 'var(--font-body)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.sector}</span>
                              <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: scoreHex(h.overall_score), flexShrink: 0 }}>{h.overall_score}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              {/* Benchmark comparison strip */}
              {scorecard.benchmark && (() => {
                const bm = scorecard.benchmark
                const ret = bm.portfolio_absolute_return
                const retColor = ret != null ? (ret >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-mute)'
                return (
                  <div style={{
                    ...neuCard,
                    padding: '14px 20px',
                    display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 400, flexShrink: 0 }}>vs Nifty 50</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Portfolio (since inception)</span>
                      <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)', color: retColor }}>
                        {ret != null ? `${ret >= 0 ? '+' : ''}${ret}%` : '—'}
                      </span>
                    </div>
                    <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nifty 50 (1Y)</span>
                      <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                        {bm.nifty_1y_return != null ? `${bm.nifty_1y_return >= 0 ? '+' : ''}${bm.nifty_1y_return}%` : '—'}
                      </span>
                    </div>
                    <span style={{
                      marginLeft: 'auto', flexShrink: 0,
                      background: 'var(--bg)', boxShadow: 'var(--neu-inset)',
                      borderRadius: 'var(--r-pill)', padding: '4px 14px',
                      fontSize: 10, fontFamily: 'var(--font-mono)',
                      color: 'var(--text-mute)', letterSpacing: '0.5px',
                    }}>
                      Alpha available after 1Y of snapshots
                    </span>
                  </div>
                )
              })()}

              {/* SWOT Analysis */}
              {(() => {
                const p = scorecard.portfolio
                const holdings = scorecard.holdings || []

                // Data computations
                const sectors = fundamental?.health_score?.sectors_count
                  ?? new Set(holdings.map((h: any) => h.sector)).size
                const winRate = fundamental?.health_score?.winners_pct ?? 0
                const top3ConcentrationPct = fundamental?.health_score?.top3_concentration_pct ?? 0

                const bullCount = holdings.filter((h: any) => h.signal === 'STRONG_BULL' || h.signal === 'BULL').length
                const bearCount = holdings.filter((h: any) => h.signal === 'BEAR').length
                const bullPct = holdings.length > 0 ? Math.round(bullCount / holdings.length * 100) : 0
                const down20 = holdings.filter((h: any) => (h.gain_pct || 0) < -20).length
                const down50 = holdings.filter((h: any) => (h.gain_pct || 0) < -50).length

                const techHoldings = technical?.holdings || []
                const oversold = techHoldings.filter((h: any) => h.rsi != null && h.rsi < 35).length
                const overbought = techHoldings.filter((h: any) => h.rsi != null && h.rsi > 70).length

                const sectorAlloc = fundamental?.sector_allocation || []
                const overweightSectors = sectorAlloc.filter((s: any) => s.pct > 30)
                const underweightSectors = sectorAlloc.filter((s: any) => s.pct < 5)

                const smallCapCount = enriched.filter(e => e.market_cap_category === 'Small Cap').length
                const smallCapHeavy = enriched.length > 0 && smallCapCount / enriched.length > 0.3

                const strengths: string[] = []
                const weaknesses: string[] = []
                const opportunities: string[] = []
                const threats: string[] = []

                // STRENGTHS
                if (sectors >= 10) strengths.push(`Well diversified across ${sectors} sectors`)
                else if (sectors >= 5) strengths.push(`Diversified across ${sectors} sectors`)
                if (winRate > 60) strengths.push(`${winRate}% of holdings are profitable`)
                if (bullPct > 50) strengths.push(`Strong bullish momentum — ${bullPct}% holdings trending up`)
                if (top3ConcentrationPct > 0 && top3ConcentrationPct < 40) strengths.push(`Low concentration risk — top 3 holdings = ${top3ConcentrationPct}%`)
                if (p.overall_score > 60) strengths.push(`Healthy portfolio quality score (${p.overall_score}/100)`)

                // WEAKNESSES
                if (down20 > 0) weaknesses.push(`${down20} holding${down20 > 1 ? 's' : ''} down more than 20%`)
                if (p.watch_count > 5) weaknesses.push(`${p.watch_count} holdings flagged for review`)
                if (top3ConcentrationPct > 50) weaknesses.push(`High concentration — top 3 = ${top3ConcentrationPct}% of portfolio`)
                if (sectors < 5) weaknesses.push(`Low diversification — only ${sectors} sectors`)
                if (p.buy_count === 0) weaknesses.push(`No high-conviction buy opportunities identified`)
                if (p.fundamental_score < 50) weaknesses.push(`Weak fundamental quality score`)

                // OPPORTUNITIES
                if (oversold > 0) opportunities.push(`${oversold} holding${oversold > 1 ? 's' : ''} at potential entry points (low RSI)`)
                if (p.hold_count > 15) opportunities.push(`${p.hold_count} holdings on HOLD — review for upgrade potential`)
                if (underweightSectors.length > 0) opportunities.push(`Underweight in ${underweightSectors[0].sector} — potential diversification opportunity`)
                if (winRate > 70) opportunities.push(`Strong track record — consider increasing position sizes`)
                if (opportunities.length === 0) opportunities.push(`Monitor for sector rotation opportunities`)

                // THREATS
                if (overbought > 0) threats.push(`${overbought} holding${overbought > 1 ? 's' : ''} overbought (RSI > 70) — pullback risk`)
                if (bearCount > 3) threats.push(`${bearCount} holdings in downtrend`)
                if (overweightSectors.length > 0) threats.push(`Overweight in ${overweightSectors[0].sector} (${overweightSectors[0].pct}%) — sector concentration risk`)
                if (down50 > 0) threats.push(`${down50} holding${down50 > 1 ? 's' : ''} down >50% — exit risk`)
                if (smallCapHeavy) threats.push(`High small-cap exposure — liquidity risk`)
                if (threats.length < 2) threats.push(`Regular rebalancing recommended for concentration management`)

                const limit = (arr: string[]) => arr.slice(0, 4)
                const quadrants = [
                  { key: 'S', label: 'STRENGTHS',    color: '#0EA66E', items: limit(strengths) },
                  { key: 'W', label: 'WEAKNESSES',   color: '#FF4444', items: limit(weaknesses) },
                  { key: 'O', label: 'OPPORTUNITIES',color: '#2dd4bf', items: limit(opportunities) },
                  { key: 'T', label: 'THREATS',      color: '#F59E0B', items: limit(threats) },
                ]

                return (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '1px', marginBottom: 16, textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 400 }}>SWOT Analysis</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {quadrants.map(q => (
                        <div key={q.key} style={{
                          display: 'flex', alignItems: 'center', gap: 0,
                          background: 'var(--bg-surface)',
                          boxShadow: 'var(--neu-raised)',
                          borderRadius: 10,
                          overflow: 'hidden',
                        }}>
                          {/* Left accent bar + letter */}
                          <div style={{
                            width: 48, flexShrink: 0,
                            background: q.color + '18',
                            alignSelf: 'stretch',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: 2,
                            padding: '12px 0',
                          }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 16, color: q.color, lineHeight: 1 }}>{q.key}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: q.color, letterSpacing: '0.5px', opacity: 0.7 }}>{q.label.slice(0, 3)}</span>
                          </div>
                          {/* Inset groove separator */}
                          <div style={{
                            width: 4, flexShrink: 0, alignSelf: 'stretch',
                            background: q.color + '55',
                            boxShadow: `inset 2px 0 3px rgba(0,0,0,0.28), inset -1px 0 2px rgba(255,255,255,0.30)`,
                          }} />
                          {/* Content — flex-wrap so row 2 aligns with row 1 start */}
                          <div style={{ flex: 1, padding: '10px 16px', display: 'flex', flexWrap: 'wrap', alignContent: 'center', gap: '5px 20px' }}>
                            {q.items.length === 0 ? (
                              <span style={{ fontSize: 12, color: 'var(--text-mute)', fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>No significant items identified</span>
                            ) : q.items.map((item, i) => (
                              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
                                <span style={{ color: q.color, fontSize: 7, lineHeight: 1, opacity: 0.8 }}>●</span>
                                {item}
                              </span>
                            ))}
                          </div>
                          {/* Count badge — larger */}
                          <div style={{ padding: '0 16px', flexShrink: 0 }}>
                            <span style={{
                              background: 'var(--bg)', boxShadow: 'var(--neu-inset)',
                              borderRadius: 'var(--r-pill)', padding: '4px 12px',
                              fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: q.color,
                            }}>{q.items.length}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Filter + Full Scorecard Table */}
              <div style={{ ...neuCard }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  {/* Left: label + count chips */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 400 }}>Full Scorecard</div>
                    {(() => {
                      const all = scorecard.holdings || []
                      const counts = { BUY: 0, HOLD: 0, WATCH: 0 }
                      all.forEach((h: any) => { if (h.recommendation in counts) counts[h.recommendation as keyof typeof counts]++ })
                      return [
                        { key: 'BUY',   color: 'var(--green)',        count: counts.BUY   },
                        { key: 'HOLD',  color: 'var(--accent-amber)', count: counts.HOLD  },
                        { key: 'WATCH', color: 'var(--red)',          count: counts.WATCH },
                      ].map(({ key, color, count }) => (
                        <span key={key} style={{
                          background: 'var(--bg)', boxShadow: 'var(--neu-inset)',
                          borderRadius: 'var(--r-pill)', padding: '3px 10px',
                          fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                          color, letterSpacing: '0.5px',
                        }}>{key} · {count}</span>
                      ))
                    })()}
                  </div>
                  {/* Right: filter chips */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['ALL', 'BUY', 'HOLD', 'WATCH'].map(f => (
                      <button key={f} onClick={() => setRecFilter(f)} style={{
                        background: 'var(--bg)',
                        boxShadow: recFilter === f ? 'var(--neu-inset)' : 'var(--neu-raised-sm)',
                        color: recFilter === f ? 'var(--accent)' : 'var(--text-mute)',
                        border: 'none', borderRadius: 'var(--r-pill)',
                        padding: '4px 14px', fontSize: 11, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'var(--font-mono)',
                        letterSpacing: '0.5px',
                        transition: 'all 0.15s'
                      }}>{f}</button>
                    ))}
                  </div>
                </div>
                <div className="hide-scrollbar" style={{ overflowX: 'auto', maxHeight: 416, overflowY: 'auto' }}>
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
                          { k: 'grade', label: 'Grade' },
                          { k: 'signal', label: 'Signal' },
                        ].map(col => (
                          <SortableHeader key={col.k} label={col.label} sortKey={col.k} currentKey={sortCol} currentDir={sortDir} onSort={handleScorecardSort} style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }} />
                        ))}
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-mute)', fontWeight: 400, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>Account</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(scorecard.holdings || [])
                        .filter((h: any) => recFilter === 'ALL' || h.recommendation === recFilter)
                        .sort((a: any, b: any) => {
                          if (!sortDir) return 0
                          const av = a[sortCol]; const bv = b[sortCol]
                          if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av
                          return sortDir === 'asc'
                            ? String(av).localeCompare(String(bv))
                            : String(bv).localeCompare(String(av))
                        })
                        .map((h: any, i: number) => {
                          const e = getE(h.symbol)
                          return (
                            <tr key={`score_${h.symbol}_${h.account_id || i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{cleanSym(h.symbol)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-body)', fontSize: 12 }}>{h.sector}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{formatVal(h.current_value)}</td>
                              <td style={{
                                padding: '10px 12px', textAlign: 'center', fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                                color: h.gain_pct >= 0 ? 'var(--green)' : 'var(--red)'
                              }}>
                                {h.gain_pct >= 0 ? '+' : ''}{h.gain_pct?.toFixed(2)}%
                              </td>
                              <td style={{
                                padding: '10px 12px', textAlign: 'center', fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                                color: scoreHex(h.fundamental_score)
                              }}>{h.fundamental_score}</td>
                              <td style={{
                                padding: '10px 12px', textAlign: 'center', fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                                color: scoreHex(h.technical_score)
                              }}>{h.technical_score}</td>
                              <td style={{
                                padding: '10px 12px', textAlign: 'center', fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                                color: scoreHex(h.overall_score)
                              }}>{h.overall_score}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}><RecChip rec={h.recommendation} /></td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}><GradeChip grade={e?.grade} /></td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, fontStyle: 'italic', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                                {e?.signal ?? '—'}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap' }}>{h.account_nickname || (h.account_id ? h.account_id.substring(0, 6) : '—')}</td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
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
