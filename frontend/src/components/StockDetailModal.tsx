import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'

export interface NavItem { symbol: string; account_id: string }

export interface StockDetailModalProps {
  currentItem: NavItem | null
  onClose: () => void
  mode: 'portfolio' | 'fundamental' | 'technical' | 'scorecard'
  navList: NavItem[]
  onNavigate: (item: NavItem) => void
  holdingsMap: Record<string, any>
  enrichedMap: Record<string, any>
  technicalMap: Record<string, any>
  scorecardMap: Record<string, any>
  accountMap: Record<string, string>
  onViewAnalysis?: () => void
}

const fmtNum = (n: number) =>
  n >= 1e5 ? '₹' + (n / 1e5).toFixed(2) + 'L' : '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })

const fmtPrice = (n?: number | null) =>
  n != null ? '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'

const gradeColor = (g?: string | null) => {
  if (!g) return 'var(--text-mute)'
  if (g === 'A') return '#0EA66E'
  if (g === 'B') return '#F59E0B'
  if (g === 'C') return '#6B7280'
  return '#FF4444'
}

const signalColor = (s?: string | null) => {
  if (!s) return 'var(--text-mute)'
  if (s === 'STRONG_BULL') return '#0EA66E'
  if (s === 'BULL') return '#22c55e'
  if (s === 'NEUTRAL') return '#6B7280'
  if (s === 'WEAK') return '#F59E0B'
  if (s === 'BEAR') return '#FF4444'
  // Enriched signals
  if (s === 'Multibagger' || s === 'Momentum Leader' || s === 'Strong Compounder') return 'var(--accent)'
  if (s === 'Laggard' || s === 'Under Watch') return '#FF4444'
  return 'var(--text-mute)'
}

const pnlColor = (n?: number | null) => {
  if (n == null) return 'var(--text-mute)'
  return n >= 0 ? 'var(--green)' : 'var(--red)'
}

const scoreHex = (score: number) => {
  if (score >= 75) return '#0EA66E'
  if (score >= 60) return '#F59E0B'
  return '#FF4444'
}

function GradeChip({ grade }: { grade?: string | null }) {
  const color = gradeColor(grade)
  if (!grade) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: `${color}18`, color, border: `1px solid ${color}44`,
      borderRadius: 6, padding: '2px 8px',
      fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
      letterSpacing: 1,
    }}>{grade}</span>
  )
}

function SignalChipSmall({ signal }: { signal?: string | null }) {
  const color = signalColor(signal)
  if (!signal) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: `${color}18`, color, border: `1px solid ${color}44`,
      borderRadius: 6, padding: '2px 8px',
      fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
      letterSpacing: 0.5, whiteSpace: 'nowrap',
    }}>{signal.replace('_', ' ')}</span>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid var(--border)',
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

/* ─── Portfolio Mode ─────────────────────────────────────────────────────── */
function PortfolioBody({
  symbol, accountId, h, e,
}: {
  symbol: string; accountId: string; h: any; e: any;
}) {
  const [note, setNote] = useState<{ story: string; purchase_reason: string; conviction_level: number }>({
    story: '', purchase_reason: '', conviction_level: 0,
  })
  const [noteLoading, setNoteLoading] = useState(true)
  const [savePending, setSavePending] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [history, setHistory] = useState<any>(null)
  const [histLoading, setHistLoading] = useState(true)

  const [analysis, setAnalysis] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisGenerated, setAnalysisGenerated] = useState(false)

  useEffect(() => {
    setNoteLoading(true)
    setAnalysis(null)
    setAnalysisGenerated(false)
    apiFetch(`/api/v1/stocks/${symbol}/notes?account_id=${accountId}`)
      .then(r => r.json())
      .then(d => {
        setNote({
          story: d.story || '',
          purchase_reason: d.purchase_reason || '',
          conviction_level: d.conviction_level || 0,
        })
      })
      .catch(() => {})
      .finally(() => setNoteLoading(false))

    setHistLoading(true)
    apiFetch(`/api/v1/stocks/${symbol}/history?account_id=${accountId}`)
      .then(r => r.json())
      .then(d => setHistory(d))
      .catch(() => setHistory(null))
      .finally(() => setHistLoading(false))
  }, [symbol, accountId])

  const saveNote = async () => {
    setSavePending(true)
    try {
      await apiFetch(`/api/v1/stocks/${symbol}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ account_id: accountId, ...note }),
      })
      setSaveMsg('Saved ✓')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch {
      setSaveMsg('Error saving')
      setTimeout(() => setSaveMsg(''), 2000)
    } finally {
      setSavePending(false)
    }
  }

  const runAnalysis = async (force = false) => {
    setAnalysisLoading(true)
    setAnalysisError(null)
    try {
      const res = await apiFetch(`/api/v1/stocks/${symbol}/analyse`, {
        method: 'POST',
        body: JSON.stringify({
          account_id: accountId,
          story: note.story,
          purchase_reason: note.purchase_reason,
          conviction_level: note.conviction_level,
          sector: h?.sector || e?.sector,
          avg_price: h?.avg_price,
          ltp: h?.ltp,
          pnl: h?.pnl,
          pnl_pct: h?.pnl_pct,
          grade: e?.grade,
          signal: e?.signal,
          pe: e?.pe,
          force,
        }),
      })
      const d = await res.json()
      if (d.error) setAnalysisError(d.error)
      else { setAnalysis(d.analysis); setAnalysisGenerated(true) }
    } catch {
      setAnalysisError('Failed to fetch analysis')
    } finally {
      setAnalysisLoading(false)
    }
  }

  const purchaseReasonOptions = [
    { value: 'self_research', label: 'Self Research' },
    { value: 'broker_reco', label: 'Broker Recommendation' },
    { value: 'friend_reco', label: 'Friend/Family Tip' },
    { value: 'news', label: 'News/Media' },
    { value: 'social_media', label: 'Social Media' },
    { value: 'technical', label: 'Technical Analysis' },
    { value: 'fundamental', label: 'Fundamental Analysis' },
    { value: 'gut', label: 'Gut Feeling' },
    { value: 'other', label: 'Other' },
  ]

  const sectionLabel: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
    letterSpacing: 1, color: 'var(--text-mute)', marginBottom: 8, display: 'block',
  }

  const insetCard: React.CSSProperties = {
    background: 'var(--bg)', boxShadow: 'var(--neu-inset)', borderRadius: 10, padding: '12px 14px',
  }

  return (
    <>
      {/* Position Snapshot */}
      <div style={{ marginBottom: 20 }}>
        <span style={sectionLabel}>POSITION SNAPSHOT</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'QTY', value: h?.qty != null ? String(h.qty) : '—' },
            { label: 'AVG', value: fmtPrice(h?.avg_price) },
            { label: 'INVESTED', value: h?.invested_value != null ? fmtNum(h.invested_value) : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Order History */}
      <div style={{ marginBottom: 20 }}>
        <span style={sectionLabel}>ORDER HISTORY</span>
        {histLoading ? (
          <div style={{ ...insetCard, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Spinner /><span style={{ fontSize: 12, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)' }}>Loading...</span>
          </div>
        ) : history ? (
          <div style={insetCard}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              {[
                { label: 'QTY', val: history.current_qty != null ? String(history.current_qty) : '—' },
                { label: 'AVG BUY', val: history.avg_buy_price != null ? fmtPrice(history.avg_buy_price) : '—' },
                { label: 'EST. INVESTED', val: history.approx_invested != null ? fmtNum(history.approx_invested) : '—' },
              ].map(({ label, val }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 600 }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--font-body)' }}>
              Upload broker statement for lot-wise purchase dates →
            </div>
          </div>
        ) : (
          <div style={{ ...insetCard, color: 'var(--text-mute)', fontSize: 12, fontFamily: 'var(--font-body)' }}>
            No history data available
          </div>
        )}
      </div>

      {/* Quick Intelligence */}
      <div style={{ marginBottom: 20 }}>
        <span style={sectionLabel}>FUNDAMENTALS</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'PE', val: e?.pe != null ? e.pe.toFixed(1) : '—' },
            { label: 'PB', val: e?.pb != null ? e.pb.toFixed(1) : '—' },
            { label: 'MKT CAP', val: e?.market_cap_category || '—' },
            { label: 'BETA', val: e?.beta != null ? e.beta.toFixed(2) : '—' },
            { label: 'ROE', val: e?.roe != null ? e.roe.toFixed(1) + '%' : '—' },
            { label: 'DIV YLD', val: e?.dividend_yield != null ? e.dividend_yield.toFixed(2) + '%' : '—' },
          ].map(({ label, val }) => (
            <div key={label} style={{ ...insetCard, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 600 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Investment Story */}
      <div style={{ marginBottom: 20 }}>
        <span style={{ ...sectionLabel, color: 'var(--accent)' }}>THE STORY BEHIND YOUR PURCHASE</span>
        <div style={{ fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--font-body)', marginBottom: 12 }}>
          Why did you buy this? Helps us give better AI analysis.
        </div>

        {noteLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
            <Spinner /><span style={{ fontSize: 12, color: 'var(--text-mute)' }}>Loading notes...</span>
          </div>
        ) : (
          <>
            {/* Purchase Reason */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>PURCHASE REASON</div>
              <select
                value={note.purchase_reason}
                onChange={e => setNote(n => ({ ...n, purchase_reason: e.target.value }))}
                style={{
                  width: '100%', background: 'var(--bg)', boxShadow: 'var(--neu-inset)',
                  border: 'none', borderRadius: 8, padding: '8px 12px',
                  fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--text)',
                  outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="">Select reason...</option>
                {purchaseReasonOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Conviction Level */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>CONVICTION LEVEL</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setNote(prev => ({ ...prev, conviction_level: n }))}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 20, padding: '2px 4px',
                      color: n <= (note.conviction_level || 0) ? 'var(--accent)' : 'var(--text-mute)',
                      transition: 'color 0.15s',
                    }}
                  >★</button>
                ))}
                {note.conviction_level > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', alignSelf: 'center' }}>
                    {note.conviction_level}/5
                  </span>
                )}
              </div>
            </div>

            {/* Story */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: 1 }}>YOUR STORY</div>
                <span style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)' }}>
                  {(note.story || '').length}/500
                </span>
              </div>
              <textarea
                value={note.story}
                onChange={e => setNote(n => ({ ...n, story: e.target.value.slice(0, 500) }))}
                rows={4}
                placeholder="Why did you buy this stock? What's your thesis? When would you exit?"
                style={{
                  width: '100%', background: 'var(--bg)', boxShadow: 'var(--neu-inset)',
                  border: 'none', borderRadius: 8, padding: '10px 12px',
                  fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--text)',
                  outline: 'none', resize: 'vertical', lineHeight: 1.5,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Save button */}
            <button
              onClick={saveNote}
              disabled={savePending}
              style={{
                background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)',
                border: 'none', borderRadius: 20, padding: '7px 18px',
                fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: saveMsg === 'Saved ✓' ? 'var(--green)' : 'var(--accent)',
                cursor: savePending ? 'default' : 'pointer',
                transition: 'color 0.2s',
              }}
            >
              {savePending ? 'Saving...' : saveMsg || 'Save Notes'}
            </button>
          </>
        )}
      </div>

      {/* AI Analysis — only if story is not empty */}
      {note.story && note.story.trim().length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <span style={{ ...sectionLabel, color: 'var(--text-mute)' }}>⚡ AI ANALYSIS</span>

          {!analysisGenerated && !analysisLoading && (
            <button
              onClick={() => runAnalysis(false)}
              style={{
                background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)',
                border: 'none', borderRadius: 20, padding: '8px 20px',
                fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: 'var(--accent)', cursor: 'pointer',
              }}
            >
              Analyse this position
            </button>
          )}

          {analysisLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
              <Spinner />
              <span style={{ fontSize: 12, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)' }}>
                Analysing
                <span style={{ animation: 'pulseLive 1s ease-in-out infinite', display: 'inline-block', marginLeft: 2 }}>...</span>
              </span>
            </div>
          )}

          {analysisError && (
            <div style={{ ...insetCard, color: '#FF4444', fontSize: 12, fontFamily: 'var(--font-body)' }}>
              {analysisError}
            </div>
          )}

          {analysis && (
            <>
              <div style={{
                ...insetCard,
                borderLeft: '3px solid var(--accent)',
                fontSize: 13, fontFamily: 'var(--font-body)', lineHeight: 1.6,
                color: 'var(--text)',
              }}>
                {analysis}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <button
                  onClick={() => runAnalysis(true)}
                  style={{
                    background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)',
                    border: 'none', borderRadius: 20, padding: '5px 14px',
                    fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                    color: 'var(--text-dim)', cursor: 'pointer',
                  }}
                >↺ Refresh</button>
                <span style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--font-body)' }}>
                  AI analysis is for reference only. Not investment advice.
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

/* ─── Fundamental Mode ───────────────────────────────────────────────────── */
function FundamentalBody({ h, e, sc }: { h: any; e: any; sc: any }) {
  const vals = e || h || {}
  const sectionLabel: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
    letterSpacing: 1, color: 'var(--text-mute)', marginBottom: 8, display: 'block',
  }
  const insetCard: React.CSSProperties = {
    background: 'var(--bg)', boxShadow: 'var(--neu-inset)', borderRadius: 10, padding: '12px 14px',
  }

  const recommendation = sc?.recommendation
  const recStyle = recommendation === 'BUY'
    ? { background: 'rgba(14,166,110,0.12)', color: '#0EA66E', border: '1px solid rgba(14,166,110,0.3)' }
    : recommendation === 'HOLD'
    ? { background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }
    : recommendation === 'WATCH'
    ? { background: 'rgba(255,68,68,0.12)', color: '#FF4444', border: '1px solid rgba(255,68,68,0.3)' }
    : { background: 'rgba(107,114,128,0.12)', color: '#6B7280', border: '1px solid rgba(107,114,128,0.3)' }

  const w52low = vals.week52_low
  const w52high = vals.week52_high

  return (
    <>
      {/* Valuation */}
      <div style={{ marginBottom: 20 }}>
        <span style={sectionLabel}>VALUATION</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'PE Ratio', val: vals.pe != null ? vals.pe.toFixed(1) : '—' },
            { label: 'PB Ratio', val: vals.pb != null ? vals.pb.toFixed(1) : '—' },
            { label: 'Market Cap', val: vals.market_cap_category || (vals.market_cap_cr != null ? `₹${vals.market_cap_cr.toFixed(0)}Cr` : '—') },
            { label: '52W Range', val: w52low != null && w52high != null ? `₹${w52low.toLocaleString('en-IN')} – ₹${w52high.toLocaleString('en-IN')}` : '—' },
          ].map(({ label, val }) => (
            <div key={label} style={insetCard}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 600 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quality Metrics */}
      <div style={{ marginBottom: 20 }}>
        <span style={sectionLabel}>QUALITY METRICS</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'ROE', val: vals.roe != null ? vals.roe.toFixed(1) + '%' : '—' },
            { label: 'Div Yield', val: vals.dividend_yield != null ? vals.dividend_yield.toFixed(2) + '%' : '—' },
            { label: 'Beta', val: vals.beta != null ? vals.beta.toFixed(2) : '—' },
          ].map(({ label, val }) => (
            <div key={label} style={insetCard}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 600 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Your Position */}
      <div style={{ marginBottom: 20 }}>
        <span style={sectionLabel}>YOUR POSITION</span>
        <div style={{ background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            {[
              { label: 'QTY', val: vals.qty != null ? String(vals.qty) : '—' },
              { label: 'AVG', val: fmtPrice(vals.avg_price) },
              { label: 'LTP', val: fmtPrice(vals.ltp) },
            ].map(({ label, val }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: 'var(--border)', margin: '0 0 10px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
            {[
              { label: 'INVESTED', val: vals.invested_value != null ? fmtNum(vals.invested_value) : '—', color: 'var(--text)' },
              { label: 'VALUE', val: vals.current_value != null ? fmtNum(vals.current_value) : '—', color: 'var(--text)' },
              { label: 'P&L', val: vals.pnl_pct != null ? `${vals.pnl_pct >= 0 ? '+' : ''}${vals.pnl_pct.toFixed(1)}%` : '—', color: pnlColor(vals.pnl_pct) },
              { label: 'WEIGHT', val: vals.weight_pct != null ? `${vals.weight_pct}%` : '—', color: 'var(--accent)' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color, fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grade Breakdown */}
      <div style={{ marginBottom: 20 }}>
        <span style={sectionLabel}>GRADE BREAKDOWN</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-mono)', color: gradeColor(vals.grade) }}>
            {vals.grade || '—'}
          </span>
          <SignalChipSmall signal={vals.signal} />
          {recommendation && (
            <span style={{ ...recStyle, borderRadius: 8, padding: '4px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {recommendation}
            </span>
          )}
        </div>
      </div>

      {/* Coming Soon */}
      <div style={{ ...insetCard, opacity: 0.5 }}>
        <div style={{ fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--font-body)' }}>
          5Y ROE · 10Y Sales · Promoter Holding · Cash Flow — Phase 2
        </div>
      </div>
    </>
  )
}

/* ─── Technical Mode ─────────────────────────────────────────────────────── */
function TechnicalBody({ t, e }: { t: any; e: any }) {
  const sectionLabel: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
    letterSpacing: 1, color: 'var(--text-mute)', marginBottom: 8, display: 'block',
  }
  const insetCard: React.CSSProperties = {
    background: 'var(--bg)', boxShadow: 'var(--neu-inset)', borderRadius: 10, padding: '12px 14px',
  }

  const price = t?.price
  const gainPct = t?.gain_pct
  const signal = t?.signal
  const rsi = t?.rsi
  const ma50 = t?.ma50
  const ma200 = t?.ma200
  const above50 = t?.above_50
  const above200 = t?.above_200
  const w52low = e?.week52_low ?? t?.week52_low
  const w52high = e?.week52_high ?? t?.week52_high

  const rsiText = rsi == null ? '— No RSI data'
    : rsi > 70 ? 'Overbought — pullback risk'
    : rsi < 30 ? 'Oversold — potential entry'
    : rsi >= 40 && rsi <= 60 ? 'Neutral zone'
    : 'Mild bias'
  const rsiColor = rsi == null ? 'var(--text-mute)'
    : rsi > 70 ? 'var(--red)'
    : rsi < 30 ? 'var(--green)'
    : rsi >= 40 && rsi <= 60 ? 'var(--text-mute)'
    : 'var(--text-dim)'

  const verdictText = (() => {
    if (signal === 'STRONG_BULL' && above200 && above50) return 'Strong uptrend across all timeframes'
    if (signal === 'BEAR' && !above200 && !above50) return 'Extended downtrend — high risk'
    if (rsi != null && rsi > 75) return 'Overbought — consider trimming'
    if (rsi != null && rsi < 28) return 'Deeply oversold — watch for reversal'
    return 'Mixed signals — monitor closely'
  })()

  const hasRange = w52low != null && w52high != null && price != null
  const rangePct = hasRange ? Math.max(0, Math.min(100, ((price - w52low) / (w52high - w52low)) * 100)) : 50

  return (
    <>
      {/* Price Action */}
      <div style={{ marginBottom: 20 }}>
        <span style={sectionLabel}>PRICE ACTION</span>
        <div style={{ background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>CMP</div>
              <div style={{ fontSize: 16, fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 700 }}>{fmtPrice(price)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>VS AVG</div>
              <div style={{ fontSize: 16, fontFamily: 'var(--font-mono)', color: pnlColor(gainPct), fontWeight: 700 }}>
                {gainPct != null ? `${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}%` : '—'}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>SIGNAL</div>
              <SignalChipSmall signal={signal} />
            </div>
          </div>
        </div>
      </div>

      {/* DMA Status */}
      <div style={{ marginBottom: 20 }}>
        <span style={sectionLabel}>DMA STATUS</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: '50 DMA', val: fmtPrice(ma50), above: above50 },
            { label: '200 DMA', val: fmtPrice(ma200), above: above200 },
          ].map(({ label, val, above }) => (
            <div key={label} style={insetCard}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>{val}</div>
              {above != null && (
                <span style={{
                  fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  color: above ? '#0EA66E' : '#FF4444',
                  background: above ? 'rgba(14,166,110,0.1)' : 'rgba(255,68,68,0.1)',
                  borderRadius: 4, padding: '2px 6px',
                }}>
                  {above ? 'Above ↑' : 'Below ↓'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* RSI */}
      <div style={{ marginBottom: 20 }}>
        <span style={sectionLabel}>RSI</span>
        <div style={insetCard}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 24, fontFamily: 'var(--font-mono)', fontWeight: 700, color: rsiColor }}>
              {rsi != null ? rsi.toFixed(0) : '—'}
            </span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: rsiColor }}>{rsiText}</span>
          </div>
        </div>
      </div>

      {/* 52W Range Visual */}
      {hasRange && (
        <div style={{ marginBottom: 20 }}>
          <span style={sectionLabel}>52-WEEK RANGE</span>
          <div style={insetCard}>
            <div style={{ marginBottom: 8 }}>
              <div style={{
                height: 8, borderRadius: 4, overflow: 'hidden',
                background: 'linear-gradient(to right, #22DD88, #FF4444)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: -3, left: `${rangePct}%`, transform: 'translateX(-50%)',
                  width: 14, height: 14, borderRadius: '50%',
                  background: 'var(--bg)', boxShadow: '0 0 0 2px var(--accent)',
                }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)' }}>
              <span style={{ color: '#22DD88' }}>₹{w52low?.toLocaleString('en-IN')}</span>
              <span style={{ color: '#FF4444' }}>₹{w52high?.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Technical Verdict */}
      <div>
        <span style={sectionLabel}>TECHNICAL VERDICT</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <SignalChipSmall signal={signal} />
          <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--text-dim)' }}>{verdictText}</span>
        </div>
      </div>
    </>
  )
}

/* ─── Scorecard Mode ─────────────────────────────────────────────────────── */
function ScorecardBody({ sc, e, t }: { sc: any; e: any; t: any }) {
  const sectionLabel: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
    letterSpacing: 1, color: 'var(--text-mute)', marginBottom: 8, display: 'block',
  }
  const insetCard: React.CSSProperties = {
    background: 'var(--bg)', boxShadow: 'var(--neu-inset)', borderRadius: 10, padding: '12px 14px',
  }

  const fundScore = sc?.fundamental_score ?? 0
  const techScore = sc?.technical_score ?? 0
  const overallScore = sc?.overall_score ?? 0
  const recommendation = sc?.recommendation
  const pe = sc?.pe ?? e?.pe
  const rsi = sc?.rsi ?? t?.rsi
  const gainPct = sc?.gain_pct ?? 0
  const above200 = t?.above_200
  const above50 = t?.above_50

  const scores = [
    { label: 'FUNDAMENTAL', score: fundScore },
    { label: 'TECHNICAL', score: techScore },
    { label: 'OVERALL', score: overallScore },
  ]

  // SWOT generation
  const strengths: string[] = []
  if (gainPct > 50) strengths.push(`Strong momentum — +${gainPct.toFixed(1)}%`)
  if (pe != null && pe < 15) strengths.push(`Attractively valued — PE ${pe.toFixed(1)}`)
  if (above200) strengths.push(`Above 200 DMA — long-term uptrend`)
  if (rsi != null && rsi >= 40 && rsi <= 65) strengths.push(`RSI in healthy range (${rsi.toFixed(0)})`)
  if (strengths.length === 0) strengths.push('Insufficient data')

  const weaknesses: string[] = []
  if (gainPct < -15) weaknesses.push(`Position underwater — ${gainPct.toFixed(1)}%`)
  if (pe != null && pe > 50) weaknesses.push(`High valuation — PE ${pe.toFixed(1)}`)
  if (t && above200 === false) weaknesses.push(`Below 200 DMA — long-term downtrend`)
  if (rsi != null && rsi > 75) weaknesses.push(`Overbought — RSI ${rsi.toFixed(0)}`)
  if (weaknesses.length === 0) weaknesses.push('No major weaknesses identified')

  const opportunities: string[] = []
  if (rsi != null && rsi < 35) opportunities.push(`Oversold at RSI ${rsi.toFixed(0)} — potential entry`)
  if (gainPct < 0 && above200) opportunities.push(`Below cost but in uptrend — averaging opportunity`)
  if (recommendation === 'BUY') opportunities.push(`Scoring model signals accumulation`)
  if (opportunities.length === 0) opportunities.push('Monitor for entry signals')

  const threats: string[] = []
  if (rsi != null && rsi > 70) threats.push(`Overbought — pullback risk (RSI ${rsi.toFixed(0)})`)
  if (above50 === false) threats.push(`Below 50 DMA — medium-term weakness`)
  if (gainPct < -25) threats.push(`Down ${Math.abs(gainPct).toFixed(1)}% — review stop loss`)
  if (threats.length === 0) threats.push('No immediate threats identified')

  const recStyle = recommendation === 'BUY'
    ? { background: 'rgba(14,166,110,0.12)', color: '#0EA66E', border: '1px solid rgba(14,166,110,0.3)' }
    : recommendation === 'HOLD'
    ? { background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }
    : { background: 'rgba(255,68,68,0.12)', color: '#FF4444', border: '1px solid rgba(255,68,68,0.3)' }

  const oneLineReason = (() => {
    if (fundScore >= 75 && techScore >= 60) return `Strong fundamentals (${fundScore}) + bullish technicals (${techScore})`
    if (fundScore >= 60 && techScore >= 60) return `Balanced scores — solid overall position (${overallScore})`
    if (techScore < 50) return `Weak technicals (${techScore}) dragging overall score`
    if (fundScore < 50) return `Weak fundamentals (${fundScore}) — monitor closely`
    return `Overall score ${overallScore} — mixed signals`
  })()

  return (
    <>
      {/* Scores */}
      <div style={{ marginBottom: 20 }}>
        <span style={sectionLabel}>SCORES</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {scores.map(({ label, score }) => {
            const hex = scoreHex(score)
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)', width: 90, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
                <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 700, color: hex, width: 36, textAlign: 'right' }}>{score}</span>
                <div style={{ flex: 1, height: 8, background: 'var(--bg)', boxShadow: 'var(--neu-inset)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${score}%`, height: '100%', background: hex, borderRadius: 4, transition: 'width 0.5s' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* SWOT */}
      <div style={{ marginBottom: 20 }}>
        <span style={sectionLabel}>SWOT ANALYSIS</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Strengths', items: strengths.slice(0, 3), color: '#0EA66E' },
            { label: 'Weaknesses', items: weaknesses.slice(0, 3), color: '#FF4444' },
            { label: 'Opportunities', items: opportunities.slice(0, 3), color: 'var(--accent)' },
            { label: 'Threats', items: threats.slice(0, 3), color: '#F5A623' },
          ].map(({ label, items, color }) => (
            <div key={label} style={{ ...insetCard, borderRadius: 10 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
              {items.map((item, i) => (
                <div key={i} style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--text-dim)', lineHeight: 1.4, marginBottom: i < items.length - 1 ? 4 : 0 }}>
                  · {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Recommendation */}
      <div>
        <span style={sectionLabel}>RECOMMENDATION</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ ...recStyle, borderRadius: 10, padding: '8px 20px', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {recommendation || '—'}
          </span>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--text-dim)', flex: 1 }}>
            {oneLineReason}
          </span>
        </div>
      </div>
    </>
  )
}

/* ─── Main Modal ─────────────────────────────────────────────────────────── */
export function StockDetailModal({
  currentItem, onClose, mode, navList, onNavigate,
  holdingsMap, enrichedMap, technicalMap, scorecardMap,
  accountMap, onViewAnalysis,
}: StockDetailModalProps) {
  if (!currentItem) return null

  const key = `${currentItem.symbol}_${currentItem.account_id}`
  const h = holdingsMap[key]
  const e = enrichedMap[key]
  const t = technicalMap[key]
  const sc = scorecardMap[key]

  // Fallback data merging for common fields
  const anyData = e || h || t || sc || {}
  const ltp = h?.ltp ?? e?.ltp ?? t?.price
  const pnlPct = h?.pnl_pct ?? e?.pnl_pct ?? sc?.gain_pct
  const grade = e?.grade ?? sc?.grade
  const signal = e?.signal ?? sc?.signal ?? t?.signal
  const sector = anyData.sector || h?.sector
  const accountNick = accountMap[currentItem.account_id] ?? currentItem.account_id.slice(0, 8)

  const currentIdx = navList.findIndex(
    n => n.symbol === currentItem.symbol && n.account_id === currentItem.account_id
  )
  const prevItem = currentIdx > 0 ? navList[currentIdx - 1] : null
  const nextItem = currentIdx < navList.length - 1 ? navList[currentIdx + 1] : null

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && prevItem) onNavigate(prevItem)
      if (e.key === 'ArrowRight' && nextItem) onNavigate(nextItem)
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prevItem, nextItem, onNavigate, onClose])

  const showPnlRow = mode === 'portfolio' || mode === 'fundamental' || mode === 'scorecard'

  const arrowBtnStyle: React.CSSProperties = {
    width: 40, height: 40, borderRadius: '50%',
    background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)',
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-dim)', fontSize: 18,
  }

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* Left Arrow */}
        {prevItem && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: 'max(12px, calc(50% - 340px))',
              top: '50%', transform: 'translateY(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}
          >
            <button style={arrowBtnStyle} onClick={() => onNavigate(prevItem)}>‹</button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-mute)', textAlign: 'center', marginTop: 4 }}>
              {prevItem.symbol}
            </span>
          </div>
        )}

        {/* Right Arrow */}
        {nextItem && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              right: 'max(12px, calc(50% - 340px))',
              top: '50%', transform: 'translateY(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}
          >
            <button style={arrowBtnStyle} onClick={() => onNavigate(nextItem)}>›</button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-mute)', textAlign: 'center', marginTop: 4 }}>
              {nextItem.symbol}
            </span>
          </div>
        )}

        {/* Modal Card */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: 'min(580px, 90vw)',
            maxHeight: '82vh',
            background: 'var(--bg)',
            boxShadow: 'var(--neu-raised-lg)',
            borderRadius: 20,
            position: 'relative',
            animation: 'slideUp 250ms ease-out both',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{ padding: '20px 24px 16px', flexShrink: 0 }}>
            {/* Row 1: Symbol + Close */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <span style={{
                fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)',
                color: 'var(--accent)', flex: 1,
              }}>
                {currentItem.symbol}
              </span>
              <button
                onClick={onClose}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-dim)', fontSize: 14,
                }}
              >×</button>
            </div>

            {/* Row 2: Account badge + Sector + Grade + Signal */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                background: 'var(--bg)', boxShadow: 'var(--neu-inset)',
                borderRadius: 20, padding: '3px 10px', color: 'var(--text-dim)',
              }}>
                {accountNick}
              </span>
              {sector && (
                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
                  {sector}
                </span>
              )}
              <GradeChip grade={grade} />
              <SignalChipSmall signal={signal} />
            </div>

            {/* Row 3: LTP + P&L (not shown in technical mode) */}
            {showPnlRow && (ltp != null || pnlPct != null) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {ltp != null && (
                  <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                    LTP: <strong>{fmtPrice(ltp)}</strong>
                  </span>
                )}
                {pnlPct != null && (
                  <span style={{
                    fontSize: 14, fontFamily: 'var(--font-mono)',
                    color: pnlColor(pnlPct), fontWeight: 700,
                  }}>
                    {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                  </span>
                )}
              </div>
            )}

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border)', marginTop: 12 }} />
          </div>

          {/* Scrollable body */}
          <div style={{
            overflowY: 'auto',
            maxHeight: 'calc(82vh - 160px)',
            padding: '4px 24px 20px',
            flex: 1,
          }}>
            {mode === 'portfolio' && (
              <PortfolioBody symbol={currentItem.symbol} accountId={currentItem.account_id} h={h} e={e} />
            )}
            {mode === 'fundamental' && (
              <FundamentalBody h={h} e={e} sc={sc} />
            )}
            {mode === 'technical' && (
              <TechnicalBody t={t} e={e} />
            )}
            {mode === 'scorecard' && (
              <ScorecardBody sc={sc} e={e} t={t} />
            )}

            {/* Footer */}
            {onViewAnalysis && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={onViewAnalysis}
                  style={{
                    background: 'var(--bg)', boxShadow: 'var(--neu-raised-sm)',
                    border: 'none', borderRadius: 20, padding: '8px 20px',
                    fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600,
                    color: 'var(--accent)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  View Full Analysis →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
