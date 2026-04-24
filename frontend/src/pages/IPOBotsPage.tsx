import { useState, useEffect, useCallback } from 'react'
import { Lightning } from '@phosphor-icons/react'

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
      return { color: '#22DD88', background: 'rgba(34,221,136,0.10)', border: '1px solid rgba(34,221,136,0.25)' }
    case 'BULLISH':
      return { color: 'var(--accent)', background: 'rgba(45,212,191,0.10)', border: '1px solid rgba(45,212,191,0.25)' }
    case 'BEARISH':
      return { color: 'var(--red)', background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.20)' }
    case 'STRONG_BEARISH':
      return { color: '#cc0000', background: 'rgba(204,0,0,0.08)', border: '1px solid rgba(204,0,0,0.20)' }
    default:
      return { color: 'var(--text-mute)', background: 'var(--bg)', border: '1px solid var(--border)' }
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
  fontFamily: 'var(--font-mono)',
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
      <div style={{ position: 'relative', height: '22px', borderRadius: '4px', overflow: 'visible' }}>
        {/* Bearish zone */}
        <div style={{
          position: 'absolute', top: 0, height: '100%',
          left: '0%', width: `${lppPct}%`,
          background: 'rgba(255,68,68,0.12)', borderRadius: '4px 0 0 4px',
        }} />
        {/* Neutral zone */}
        <div style={{
          position: 'absolute', top: 0, height: '100%',
          left: `${lppPct}%`, width: `${uppPct - lppPct}%`,
          background: 'rgba(0,0,0,0.05)',
        }} />
        {/* Bullish zone */}
        <div style={{
          position: 'absolute', top: 0, height: '100%',
          left: `${uppPct}%`, width: `${100 - uppPct}%`,
          background: 'rgba(45,212,191,0.15)', borderRadius: '0 4px 4px 0',
        }} />

        {levels.map(l => (
          <div key={l.key} style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${pct(l.val)}%`,
            width: '1px',
            background: 'rgba(0,0,0,0.15)',
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
            background: 'var(--accent)',
            boxShadow: '0 0 0 3px rgba(45,212,191,0.25)',
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
            color: 'var(--text-mute)',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-mono)',
          }}>
            {l.label}
            <br />
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
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

  const [addSymbol, setAddSymbol] = useState('')
  const [addAccountId, setAddAccountId] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')

  const [refreshing, setRefreshing] = useState<{ [botId: string]: boolean }>({})

  const fetchBots = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/ipo-bots/`, { headers: authHeaders() })
      if (!res.ok) return
      const data: Bot[] = await res.json()
      setBots(data)
    } catch (_) { /* silent */ }
  }, [])

  useEffect(() => { fetchBots() }, [fetchBots])

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

  const neuCard: React.CSSProperties = {
    background: 'var(--bg-surface)',
    boxShadow: 'var(--neu-raised)',
    borderRadius: 'var(--r-lg)',
    border: '1px solid var(--border)',
  }

  const inputStyleLocal: React.CSSProperties = {
    background: 'var(--bg)',
    boxShadow: 'var(--neu-inset)',
    border: '1px solid var(--border)',
    borderRadius: '7px',
    padding: '7px 12px',
    color: 'var(--text)',
    fontSize: '12px',
    width: '148px',
    outline: 'none',
    fontFamily: 'var(--font-body)',
  }

  const addBtnStyleLocal = (disabled: boolean): React.CSSProperties => ({
    padding: '7px 16px',
    borderRadius: '7px',
    fontSize: '12px', fontWeight: 700,
    background: 'var(--bg-surface)',
    boxShadow: disabled ? 'none' : 'var(--neu-raised-sm)',
    color: disabled ? 'var(--text-mute)' : 'var(--accent)',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 150ms',
    alignSelf: 'flex-end',
    fontFamily: 'var(--font-body)',
  })

  const toggleChipStyle = (active: boolean, colorActive: string): React.CSSProperties => ({
    ...chipBase,
    cursor: 'pointer',
    border: 'none',
    background: active ? 'var(--bg)' : 'var(--bg-surface)',
    boxShadow: active ? 'var(--neu-inset)' : 'var(--neu-raised-sm)',
    color: active ? colorActive : 'var(--text-mute)',
  })

  return (
    <div style={{ animation: 'fadeUp 400ms cubic-bezier(0,0,0.2,1) both' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800,
            color: 'var(--text)', marginBottom: '4px',
          }}>
            IPO Bot
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
            YTR strategy scanner · NSE auto-detect
          </div>
        </div>

        {/* LIVE / PRACTIX toggle chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '6px' }}>
          <button onClick={() => setIsPractix(false)} style={toggleChipStyle(!isPractix, 'var(--accent)')}>
            {!isPractix && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', animation: 'pulseLive 2s ease-out infinite', display: 'inline-block' }} />}
            LIVE
          </button>
          <button onClick={() => setIsPractix(true)} style={toggleChipStyle(isPractix, 'var(--amber)')}>
            PRACTIX
          </button>
        </div>
      </div>

      {/* ── Add symbol row ── */}
      <div style={{ ...neuCard, padding: '18px 20px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', marginBottom: '12px', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
          ADD TO WATCHLIST
        </div>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-mute)', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>SYMBOL</label>
            <input
              value={addSymbol}
              onChange={e => setAddSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. SWIGGY"
              style={inputStyleLocal}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-mute)', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>ACCOUNT ID</label>
            <input
              value={addAccountId}
              onChange={e => setAddAccountId(e.target.value)}
              placeholder="e.g. ZER123"
              style={inputStyleLocal}
            />
          </div>
          <button type="submit" disabled={adding} style={addBtnStyleLocal(adding)}>
            {adding ? 'Adding…' : '+ Add'}
          </button>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            style={{ ...addBtnStyleLocal(scanning), color: scanning ? 'var(--text-mute)' : 'var(--accent)' }}
          >
            {scanning ? 'Scanning…' : <><Lightning size={12} weight="fill" /> Scan All</>}
          </button>
        </form>
        {addError && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--red)', fontFamily: 'var(--font-body)' }}>{addError}</div>
        )}
        {scanError && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--red)', fontFamily: 'var(--font-body)' }}>Scan error: {scanError}</div>
        )}
      </div>

      {/* ── Scan results banner ── */}
      {scanResults && scanResults.length > 0 && (
        <div style={{ ...neuCard, padding: '14px 20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', marginBottom: '10px', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
            SCAN RESULTS · {scanResults.length} symbol{scanResults.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {scanResults.map((s, i) => (
              <div key={i} style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'var(--bg)',
                boxShadow: 'var(--neu-inset)',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                  {s.symbol}
                </span>
                {s.signal && (
                  <span style={{ ...chipBase, ...signalStyle(s.signal) }}>
                    {s.signal?.replace('_', ' ')}
                  </span>
                )}
                {s.ltp != null && (
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    ₹{fmt(s.ltp)}
                  </span>
                )}
                {s.error && (
                  <span style={{ fontSize: '11px', color: 'var(--red)' }}>{s.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Watchlist table ── */}
      <div style={{ ...neuCard, overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-mute)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
            WATCHLIST · {bots.length} bot{bots.length !== 1 ? 's' : ''}
          </div>
          <span style={{
            ...chipBase,
            background: 'var(--bg)', boxShadow: 'var(--neu-inset)',
            color: isPractix ? 'var(--amber)' : 'var(--accent)',
          }}>
            {!isPractix && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', animation: 'pulseLive 2s ease-out infinite', display: 'inline-block' }} />}
            {isPractix ? 'PRACTIX' : 'LIVE'}
          </span>
        </div>

        {bots.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-mute)', fontSize: '13px', fontFamily: 'var(--font-body)' }}>
            No bots yet — add a symbol above to get started.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                  {['Symbol', 'Signal', 'LTP', 'UPP / LPP', 'Target / SL', 'Status', ''].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: '10px', fontWeight: 700,
                      color: 'var(--text-mute)',
                      letterSpacing: '0.06em',
                      borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-mono)',
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
                          background: isSelected ? 'rgba(45,212,191,0.04)' : 'transparent',
                          transition: 'background 150ms',
                          borderBottom: '1px solid var(--border)',
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(0,0,0,0.02)'
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                        }}
                      >
                        {/* Symbol */}
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                            {bot.symbol}
                          </span>
                          <div style={{ fontSize: '10px', color: 'var(--text-mute)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
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
                            <span style={{ color: 'var(--text-mute)', fontSize: '11px' }}>—</span>
                          )}
                        </td>

                        {/* LTP */}
                        <td style={{ padding: '12px 16px', color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          {ytr?.ltp != null ? `₹${fmt(ytr.ltp)}` : '—'}
                        </td>

                        {/* UPP / LPP badges */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {ytr?.UPP != null && (
                              <span style={{
                                ...chipBase,
                                background: 'rgba(45,212,191,0.08)',
                                color: 'var(--accent)',
                                border: '1px solid rgba(45,212,191,0.20)',
                              }}>
                                UPP {fmt(ytr.UPP)}
                              </span>
                            )}
                            {ytr?.LPP != null && (
                              <span style={{
                                ...chipBase,
                                background: 'rgba(255,68,68,0.08)',
                                color: 'var(--red)',
                                border: '1px solid rgba(255,68,68,0.20)',
                              }}>
                                LPP {fmt(ytr.LPP)}
                              </span>
                            )}
                            {!ytr && <span style={{ color: 'var(--text-mute)', fontSize: '11px' }}>—</span>}
                          </div>
                        </td>

                        {/* Target / SL */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {ytr?.target != null ? (
                              <span style={{ fontSize: '11px', color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                                T: ₹{fmt(ytr.target)}
                              </span>
                            ) : null}
                            {ytr?.sl != null ? (
                              <span style={{ fontSize: '11px', color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                                SL: ₹{fmt(ytr.sl)}
                              </span>
                            ) : null}
                            {!ytr && <span style={{ color: 'var(--text-mute)', fontSize: '11px' }}>—</span>}
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            ...chipBase,
                            background: 'var(--bg)', boxShadow: 'var(--neu-inset)',
                            color: bot.status === 'watching' ? 'var(--green)' : 'var(--amber)',
                          }}>
                            {bot.status === 'watching' && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', animation: 'pulseLive 2s ease-out infinite', display: 'inline-block' }} />}
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
                              fontSize: '10px', fontWeight: 700,
                              background: 'var(--bg-surface)',
                              boxShadow: refreshing[bot.id] ? 'none' : 'var(--neu-raised-sm)',
                              color: refreshing[bot.id] ? 'var(--text-mute)' : 'var(--accent)',
                              border: 'none',
                              cursor: refreshing[bot.id] ? 'not-allowed' : 'pointer',
                              transition: 'all 150ms',
                              whiteSpace: 'nowrap',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {refreshing[bot.id] ? '…' : '↻ Refresh'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded YTR bar row */}
                      {isSelected && (
                        <tr key={`${bot.id}-bar`} style={{ background: 'rgba(45,212,191,0.02)' }}>
                          <td
                            colSpan={7}
                            style={{
                              padding: '16px 20px 20px',
                              borderBottom: '1px solid var(--border)',
                            }}
                          >
                            {!ytr ? (
                              <div style={{ fontSize: '12px', color: 'var(--text-mute)', fontFamily: 'var(--font-body)' }}>
                                Click ↻ Refresh to load YTR levels for {bot.symbol}.
                              </div>
                            ) : ytr.error ? (
                              <div style={{ fontSize: '12px', color: 'var(--red)', fontFamily: 'var(--font-body)' }}>
                                Error: {ytr.error}
                              </div>
                            ) : (
                              <>
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
                                      <span style={{ fontSize: '9px', color: 'var(--text-mute)', fontWeight: 700, letterSpacing: '0.05em', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                                        {item.label}
                                      </span>
                                      <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                                        ₹{fmt(item.val)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
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
