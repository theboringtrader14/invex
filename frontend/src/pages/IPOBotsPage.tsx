import { useState, useEffect, useCallback } from 'react'

/* ─── API helpers ──────────────────────────────────────────── */
const API =
  import.meta.env.VITE_API_URL?.replace('api.', 'invex-api.') ||
  'https://invex.lifexos.co.in'

function authHeaders() {
  const token = localStorage.getItem('staax_token')
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

/* ─── Types ────────────────────────────────────────────────── */
interface Bot {
  id: string
  symbol: string
  exchange: string
  status: string
  is_practix: boolean
  trade_amount: number
  account_id: string
  listing_date: string | null
  yearly_open: number | null
  upp1: number | null
  lpp1: number | null
}

interface YTRData {
  symbol?: string
  dopen?: number
  PR?: number
  LPP?: number
  UPP?: number
  LPP1?: number
  UPP1?: number
  PROFITUP?: number
  PROFITLP?: number
  PROFITUP1?: number
  PROFITLP1?: number
  ltp?: number
  signal?: string
  sl?: number
  target?: number
  error?: string
}

interface RowYTR {
  [botId: string]: YTRData
}

/* ─── Signal chip colors ────────────────────────────────────── */
function signalStyle(signal: string | undefined): React.CSSProperties {
  switch (signal) {
    case 'STRONG_BULLISH':
      return {
        background: 'rgba(0,230,118,0.18)',
        color: '#00e676',
        border: '0.5px solid rgba(0,230,118,0.45)',
      }
    case 'BULLISH':
      return {
        background: 'rgba(0,201,167,0.18)',
        color: 'var(--ix-vivid)',
        border: '0.5px solid rgba(0,201,167,0.40)',
      }
    case 'BEARISH':
      return {
        background: 'rgba(255,82,82,0.14)',
        color: '#ff5252',
        border: '0.5px solid rgba(255,82,82,0.35)',
      }
    case 'STRONG_BEARISH':
      return {
        background: 'rgba(213,0,0,0.18)',
        color: '#ff1744',
        border: '0.5px solid rgba(213,0,0,0.45)',
      }
    default:
      return {
        background: 'rgba(255,255,255,0.07)',
        color: 'var(--gs-muted)',
        border: '0.5px solid rgba(255,255,255,0.12)',
      }
  }
}

const chipBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 8px',
  borderRadius: 'var(--r-pill)',
  fontSize: '10px',
  fontWeight: 700,
}

/* ─── YTR Level Bar ─────────────────────────────────────────── */
function YTRBar({ ytr }: { ytr: YTRData }) {
  if (!ytr.LPP1 || !ytr.UPP1 || !ytr.ltp) return null

  const rangeMin = ytr.LPP1
  const rangeMax = ytr.UPP1
  const span = rangeMax - rangeMin
  if (span <= 0) return null

  const pct = (v: number) =>
    Math.min(100, Math.max(0, ((v - rangeMin) / span) * 100))

  const ltpPct = pct(ytr.ltp)
  const lppPct = ytr.LPP ? pct(ytr.LPP) : 0
  const uppPct = ytr.UPP ? pct(ytr.UPP) : 100

  const levels: { key: string; val: number; label: string }[] = [
    { key: 'LPP1', val: ytr.LPP1, label: 'LPP1' },
    { key: 'LPP', val: ytr.LPP!, label: 'LPP' },
    { key: 'dopen', val: ytr.dopen!, label: 'OPEN' },
    { key: 'UPP', val: ytr.UPP!, label: 'UPP' },
    { key: 'UPP1', val: ytr.UPP1, label: 'UPP1' },
  ]

  return (
    <div style={{ marginTop: '12px', padding: '0 4px' }}>
      {/* Bar */}
      <div style={{ position: 'relative', height: '22px', borderRadius: '4px', overflow: 'visible' }}>
        {/* Bearish zone: LPP1 → LPP */}
        <div style={{
          position: 'absolute', top: 0, height: '100%',
          left: '0%', width: `${lppPct}%`,
          background: 'rgba(255,82,82,0.22)', borderRadius: '4px 0 0 4px',
        }} />
        {/* Neutral zone: LPP → UPP */}
        <div style={{
          position: 'absolute', top: 0, height: '100%',
          left: `${lppPct}%`, width: `${uppPct - lppPct}%`,
          background: 'rgba(255,255,255,0.09)',
        }} />
        {/* Bullish zone: UPP → UPP1 */}
        <div style={{
          position: 'absolute', top: 0, height: '100%',
          left: `${uppPct}%`, width: `${100 - uppPct}%`,
          background: 'rgba(0,201,167,0.22)', borderRadius: '0 4px 4px 0',
        }} />

        {/* Level tick marks */}
        {levels.map(l => (
          <div key={l.key} style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${pct(l.val)}%`,
            width: '1px',
            background: 'rgba(255,255,255,0.20)',
          }} />
        ))}

        {/* LTP pulsing dot */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: `${ltpPct}%`,
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
        }}>
          <span style={{
            display: 'block',
            width: '10px', height: '10px',
            borderRadius: '50%',
            background: 'var(--ix-vivid)',
            boxShadow: '0 0 0 3px rgba(0,201,167,0.30)',
            animation: 'pulseLive 1.5s ease-in-out infinite',
          }} />
        </div>
      </div>

      {/* Labels row */}
      <div style={{ position: 'relative', height: '20px', marginTop: '4px' }}>
        {levels.map(l => (
          <div key={l.key} style={{
            position: 'absolute',
            left: `${pct(l.val)}%`,
            transform: 'translateX(-50%)',
            fontSize: '9px',
            color: 'var(--gs-muted)',
            whiteSpace: 'nowrap',
          }}>
            {l.label}
            <br />
            <span style={{ color: 'var(--ix-ultra)', fontWeight: 600 }}>
              {l.val.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function IPOBotsPage() {
  const [isPractix, setIsPractix] = useState(true)
  const [bots, setBots] = useState<Bot[]>([])
  const [rowYTR, setRowYTR] = useState<RowYTR>({})
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null)
  const [scanResults, setScanResults] = useState<YTRData[] | null>(null)

  /* Add form state */
  const [addSymbol, setAddSymbol] = useState('')
  const [addAccountId, setAddAccountId] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  /* Scan state */
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')

  /* Per-row refresh loading */
  const [refreshing, setRefreshing] = useState<{ [botId: string]: boolean }>({})

  /* ── Fetch bot list ── */
  const fetchBots = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/ipo-bots/`, { headers: authHeaders() })
      if (!res.ok) return
      const data: Bot[] = await res.json()
      setBots(data)
    } catch (_) { /* silent */ }
  }, [])

  useEffect(() => { fetchBots() }, [fetchBots])

  /* ── Add bot ── */
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addSymbol.trim() || !addAccountId.trim()) {
      setAddError('Symbol and Account ID are required.')
      return
    }
    setAdding(true)
    setAddError('')
    try {
      const res = await fetch(`${API}/api/v1/ipo-bots/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          symbol: addSymbol.trim().toUpperCase(),
          account_id: addAccountId.trim(),
          trade_amount: 10000,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setAddError(err.detail || 'Failed to add bot.')
      } else {
        setAddSymbol('')
        await fetchBots()
      }
    } catch (err: any) {
      setAddError(err.message || 'Network error.')
    } finally {
      setAdding(false)
    }
  }

  /* ── Refresh single row YTR ── */
  async function refreshRow(bot: Bot) {
    setRefreshing(r => ({ ...r, [bot.id]: true }))
    try {
      const res = await fetch(`${API}/api/v1/ipo-bots/ytr/${bot.symbol.toUpperCase()}`, {
        headers: authHeaders(),
      })
      const data: YTRData = await res.json()
      setRowYTR(prev => ({ ...prev, [bot.id]: data }))
    } catch (err: any) {
      setRowYTR(prev => ({ ...prev, [bot.id]: { error: err.message } }))
    } finally {
      setRefreshing(r => ({ ...r, [bot.id]: false }))
    }
  }

  /* ── Scan all ── */
  async function handleScan() {
    setScanning(true)
    setScanError('')
    setScanResults(null)
    try {
      const res = await fetch(`${API}/api/v1/ipo-bots/scan`, {
        method: 'POST',
        headers: authHeaders(),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setScanError(err.detail || 'Scan failed.')
      } else {
        const data = await res.json()
        setScanResults(data.signals || [])
        /* Also merge into rowYTR keyed by bot_id */
        const merged: RowYTR = {}
        for (const s of (data.signals || [])) {
          if (s.bot_id) merged[s.bot_id] = s
        }
        setRowYTR(prev => ({ ...prev, ...merged }))
      }
    } catch (err: any) {
      setScanError(err.message || 'Network error.')
    } finally {
      setScanning(false)
    }
  }

  const fmt = (v: number | null | undefined) =>
    v != null ? v.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'

  const selectedYTR = selectedBotId ? rowYTR[selectedBotId] : null

  /* ──────────────── RENDER ──────────────────────────────────── */
  return (
    <div style={{ padding: '24px 28px', animation: 'fadeUp 400ms cubic-bezier(0,0,0.2,1) both' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 800,
            color: 'var(--ix-vivid)', letterSpacing: '-1px', marginBottom: '4px',
          }}>
            IPO Bot
          </div>
          <div style={{ fontSize: '12px', color: 'var(--gs-muted)' }}>
            YTR strategy scanner · NSE auto-detect
          </div>
        </div>

        {/* LIVE / PRACTIX toggle chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '6px' }}>
          <button
            onClick={() => setIsPractix(false)}
            style={{
              ...chipBase,
              cursor: 'pointer',
              border: 'none',
              background: !isPractix ? 'rgba(0,201,167,0.18)' : 'rgba(255,255,255,0.06)',
              color: !isPractix ? 'var(--ix-vivid)' : 'var(--gs-muted)',
              outline: !isPractix ? '0.5px solid rgba(0,201,167,0.40)' : '0.5px solid rgba(255,255,255,0.12)',
            }}
          >
            {!isPractix && <span className="dot-live" />}
            LIVE
          </button>
          <button
            onClick={() => setIsPractix(true)}
            style={{
              ...chipBase,
              cursor: 'pointer',
              border: 'none',
              background: isPractix ? 'rgba(255,215,0,0.14)' : 'rgba(255,255,255,0.06)',
              color: isPractix ? 'var(--sem-warn)' : 'var(--gs-muted)',
              outline: isPractix ? '0.5px solid rgba(255,215,0,0.35)' : '0.5px solid rgba(255,255,255,0.12)',
            }}
          >
            PRACTIX
          </button>
        </div>
      </div>

      {/* ── Add symbol row ── */}
      <div className="glass cloud-fill" style={{ padding: '18px 20px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ix-ultra)', marginBottom: '12px', letterSpacing: '0.06em' }}>
          ADD TO WATCHLIST
        </div>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: 'var(--gs-muted)', fontWeight: 600 }}>SYMBOL</label>
            <input
              value={addSymbol}
              onChange={e => setAddSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. SWIGGY"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: 'var(--gs-muted)', fontWeight: 600 }}>ACCOUNT ID</label>
            <input
              value={addAccountId}
              onChange={e => setAddAccountId(e.target.value)}
              placeholder="e.g. ZER123"
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            style={addBtnStyle(adding)}
          >
            {adding ? 'Adding…' : '+ Add'}
          </button>

          {/* Scan All button */}
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            style={{
              ...addBtnStyle(scanning),
              background: scanning ? 'rgba(255,255,255,0.06)' : 'rgba(0,201,167,0.12)',
              color: scanning ? 'var(--gs-muted)' : 'var(--ix-vivid)',
              border: '0.5px solid rgba(0,201,167,0.35)',
            }}
          >
            {scanning ? 'Scanning…' : '⚡ Scan All'}
          </button>
        </form>
        {addError && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#ff5252' }}>{addError}</div>
        )}
        {scanError && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#ff5252' }}>Scan error: {scanError}</div>
        )}
      </div>

      {/* ── Scan results banner ── */}
      {scanResults && scanResults.length > 0 && (
        <div className="glass cloud-fill" style={{ padding: '14px 20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ix-ultra)', marginBottom: '10px', letterSpacing: '0.06em' }}>
            SCAN RESULTS · {scanResults.length} symbol{scanResults.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {scanResults.map((s, i) => (
              <div key={i} style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.10)',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span style={{ fontWeight: 700, color: 'var(--ix-vivid)', fontSize: '12px' }}>
                  {s.symbol}
                </span>
                {s.signal && (
                  <span style={{ ...chipBase, ...signalStyle(s.signal) }}>
                    {s.signal?.replace('_', ' ')}
                  </span>
                )}
                {s.ltp != null && (
                  <span style={{ fontSize: '11px', color: 'var(--gs-muted)' }}>
                    ₹{fmt(s.ltp)}
                  </span>
                )}
                {s.error && (
                  <span style={{ fontSize: '11px', color: '#ff5252' }}>{s.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Watchlist table ── */}
      <div className="glass cloud-fill" style={{ padding: '0', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{
          padding: '14px 20px', borderBottom: '0.5px solid var(--ix-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ix-ultra)', letterSpacing: '0.06em' }}>
            WATCHLIST · {bots.length} bot{bots.length !== 1 ? 's' : ''}
          </div>
          <span className={isPractix ? 'status-chip chip-paused' : 'status-chip chip-active'}>
            {!isPractix && <span className="dot-live" />}
            {isPractix ? 'PRACTIX' : 'LIVE'}
          </span>
        </div>

        {bots.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--gs-muted)', fontSize: '13px' }}>
            No bots yet — add a symbol above to get started.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Symbol', 'Signal', 'LTP', 'UPP / LPP', 'Target / SL', 'Status', ''].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: '10px', fontWeight: 700,
                      color: 'var(--gs-muted)',
                      letterSpacing: '0.06em',
                      borderBottom: '0.5px solid rgba(255,255,255,0.07)',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bots.map(bot => {
                  const ytr = rowYTR[bot.id]
                  const isSelected = selectedBotId === bot.id
                  return (
                    <>
                      <tr
                        key={bot.id}
                        onClick={() => setSelectedBotId(isSelected ? null : bot.id)}
                        style={{
                          cursor: 'pointer',
                          background: isSelected
                            ? 'rgba(0,201,167,0.06)'
                            : 'transparent',
                          transition: 'background 150ms',
                          borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.03)'
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                        }}
                      >
                        {/* Symbol */}
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--ix-vivid)', fontSize: '13px' }}>
                            {bot.symbol}
                          </span>
                          <div style={{ fontSize: '10px', color: 'var(--gs-muted)', marginTop: '2px' }}>
                            {bot.exchange}
                          </div>
                        </td>

                        {/* Signal */}
                        <td style={{ padding: '12px 16px' }}>
                          {ytr?.signal ? (
                            <span style={{ ...chipBase, ...signalStyle(ytr.signal) }}>
                              {ytr.signal.replace('_', ' ')}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--gs-muted)', fontSize: '11px' }}>—</span>
                          )}
                        </td>

                        {/* LTP */}
                        <td style={{ padding: '12px 16px', color: 'var(--ix-ultra)', fontWeight: 600 }}>
                          {ytr?.ltp != null ? `₹${fmt(ytr.ltp)}` : '—'}
                        </td>

                        {/* UPP / LPP badges */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {ytr?.UPP != null && (
                              <span style={{
                                ...chipBase,
                                background: 'rgba(0,201,167,0.10)',
                                color: 'var(--ix-vivid)',
                                border: '0.5px solid rgba(0,201,167,0.25)',
                              }}>
                                UPP {fmt(ytr.UPP)}
                              </span>
                            )}
                            {ytr?.LPP != null && (
                              <span style={{
                                ...chipBase,
                                background: 'rgba(255,82,82,0.10)',
                                color: '#ff5252',
                                border: '0.5px solid rgba(255,82,82,0.25)',
                              }}>
                                LPP {fmt(ytr.LPP)}
                              </span>
                            )}
                            {!ytr && <span style={{ color: 'var(--gs-muted)', fontSize: '11px' }}>—</span>}
                          </div>
                        </td>

                        {/* Target / SL */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {ytr?.target != null ? (
                              <span style={{ fontSize: '11px', color: '#00e676' }}>
                                T: ₹{fmt(ytr.target)}
                              </span>
                            ) : null}
                            {ytr?.sl != null ? (
                              <span style={{ fontSize: '11px', color: '#ff5252' }}>
                                SL: ₹{fmt(ytr.sl)}
                              </span>
                            ) : null}
                            {!ytr && <span style={{ color: 'var(--gs-muted)', fontSize: '11px' }}>—</span>}
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '12px 16px' }}>
                          <span className={bot.status === 'watching' ? 'status-chip chip-active' : 'status-chip chip-paused'}>
                            {bot.status === 'watching' && <span className="dot-live" />}
                            {bot.status.toUpperCase()}
                          </span>
                        </td>

                        {/* Refresh button */}
                        <td style={{ padding: '12px 16px' }}>
                          <button
                            onClick={e => { e.stopPropagation(); refreshRow(bot) }}
                            disabled={refreshing[bot.id]}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '10px', fontWeight: 600,
                              background: 'rgba(0,201,167,0.10)',
                              color: refreshing[bot.id] ? 'var(--gs-muted)' : 'var(--ix-vivid)',
                              border: '0.5px solid rgba(0,201,167,0.25)',
                              cursor: refreshing[bot.id] ? 'not-allowed' : 'pointer',
                              transition: 'all 150ms',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {refreshing[bot.id] ? '…' : '↻ Refresh'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded YTR bar row */}
                      {isSelected && (
                        <tr key={`${bot.id}-bar`} style={{ background: 'rgba(0,201,167,0.03)' }}>
                          <td
                            colSpan={7}
                            style={{
                              padding: '16px 20px 20px',
                              borderBottom: '0.5px solid rgba(255,255,255,0.07)',
                            }}
                          >
                            {!ytr ? (
                              <div style={{ fontSize: '12px', color: 'var(--gs-muted)' }}>
                                Click ↻ Refresh to load YTR levels for {bot.symbol}.
                              </div>
                            ) : ytr.error ? (
                              <div style={{ fontSize: '12px', color: '#ff5252' }}>
                                Error: {ytr.error}
                              </div>
                            ) : (
                              <>
                                {/* Summary row */}
                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                  {[
                                    { label: 'Open', val: ytr.dopen },
                                    { label: 'PR', val: ytr.PR },
                                    { label: 'LPP1', val: ytr.LPP1 },
                                    { label: 'LPP', val: ytr.LPP },
                                    { label: 'UPP', val: ytr.UPP },
                                    { label: 'UPP1', val: ytr.UPP1 },
                                    { label: 'Target', val: ytr.PROFITUP },
                                    { label: 'PROFITUP1', val: ytr.PROFITUP1 },
                                  ].map(item => (
                                    <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <span style={{ fontSize: '9px', color: 'var(--gs-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>
                                        {item.label.toUpperCase()}
                                      </span>
                                      <span style={{ fontSize: '12px', color: 'var(--ix-ultra)', fontWeight: 600 }}>
                                        ₹{fmt(item.val)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {/* Price bar */}
                                <YTRBar ytr={ytr} />
                              </>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}

/* ─── Local style constants ─────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '0.5px solid rgba(255,255,255,0.14)',
  borderRadius: '7px',
  padding: '7px 12px',
  color: 'var(--ix-ultra)',
  fontSize: '12px',
  width: '148px',
  outline: 'none',
}

function addBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '7px 16px',
    borderRadius: '7px',
    fontSize: '12px', fontWeight: 700,
    background: disabled ? 'rgba(255,255,255,0.06)' : 'rgba(0,201,167,0.18)',
    color: disabled ? 'var(--gs-muted)' : 'var(--ix-vivid)',
    border: '0.5px solid rgba(0,201,167,0.30)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 150ms',
    alignSelf: 'flex-end',
  }
}
