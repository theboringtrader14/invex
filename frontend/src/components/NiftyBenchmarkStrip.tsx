import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch } from '../lib/api'

function Sparkline({ data, width = 120, height = 32 }: { data: { date: string; value: number }[]; width?: number; height?: number }) {
  if (!data || data.length < 2) return null
  const values = data.map(d => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((d.value - min) / range) * (height - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const lastVal = values[values.length - 1]
  const lineColor = lastVal >= 100 ? '#0EA66E' : '#FF4444'
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      <polyline points={points} fill="none" stroke={lineColor}
        strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

interface Props {
  compact?: boolean
}

export default function NiftyBenchmarkStrip({ compact = false }: Props) {
  const { token } = useAuth()
  const [benchmark, setBenchmark] = useState<any>(null)
  const [niftyHistory, setNiftyHistory] = useState<{ date: string; value: number }[]>([])

  useEffect(() => {
    if (!token) return
    Promise.all([
      apiFetch('/api/v1/analysis/scorecard')
        .then(r => r.json())
        .then(d => setBenchmark(d?.benchmark ?? null)),
      apiFetch('/api/v1/portfolio/price-history?symbol=NIFTY50&period=1y')
        .then(r => r.json())
        .then(d => setNiftyHistory(d?.nifty || [])),
    ]).catch(() => {})
  }, [token])

  if (!benchmark) return null

  const ret = benchmark.portfolio_absolute_return
  const retColor = ret != null ? (ret >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-mute)'

  return (
    <div style={{
      background: 'var(--bg-surface)',
      boxShadow: 'var(--neu-raised)',
      borderRadius: 'var(--r-lg)',
      padding: compact ? '10px 16px' : '14px 20px',
      display: 'flex', alignItems: 'center', gap: compact ? 16 : 24, flexWrap: 'wrap',
      marginBottom: compact ? 0 : undefined,
    }}>
      <div style={{
        fontSize: compact ? 9 : 10, color: 'var(--text-mute)',
        letterSpacing: '1px', textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)', fontWeight: 400, flexShrink: 0,
      }}>
        vs Nifty 50
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: compact ? 9 : 10, color: 'var(--text-mute)',
          fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          Portfolio (since inception)
        </span>
        <span style={{
          fontSize: compact ? 14 : 16, fontWeight: 800,
          fontFamily: 'var(--font-mono)', color: retColor,
        }}>
          {ret != null ? `${ret >= 0 ? '+' : ''}${ret}%` : '—'}
        </span>
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: compact ? 9 : 10, color: 'var(--text-mute)',
          fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          Nifty 50 (1Y)
        </span>
        <span style={{
          fontSize: compact ? 14 : 16, fontWeight: 800,
          fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
        }}>
          {benchmark.nifty_1y_return != null
            ? `${benchmark.nifty_1y_return >= 0 ? '+' : ''}${benchmark.nifty_1y_return}%`
            : '—'}
        </span>
        {niftyHistory.length >= 2 && (
          <Sparkline
            data={niftyHistory}
            width={compact ? 80 : 120}
            height={compact ? 24 : 32}
          />
        )}
      </div>

      <span style={{
        marginLeft: 'auto', flexShrink: 0,
        background: 'var(--bg)', boxShadow: 'var(--neu-inset)',
        borderRadius: 'var(--r-pill)', padding: compact ? '3px 10px' : '4px 14px',
        fontSize: compact ? 9 : 10, fontFamily: 'var(--font-mono)',
        color: 'var(--text-mute)', letterSpacing: '0.5px',
      }}>
        Alpha available after 1Y of snapshots
      </span>
    </div>
  )
}
