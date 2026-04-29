import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import * as d3 from 'd3'
import { apiFetch } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

gsap.registerPlugin(useGSAP)

/* ─── Neumorphic tokens ───────────────────────────────────────────────── */
const C = {
  lime:       '#C9F53B',
  limeDim:    'rgba(201,245,59,0.08)',
  limeBorder: 'rgba(201,245,59,0.20)',
  bg:         '#0d1117',
  surface:    '#0d1117',
  surface2:   '#0a0e14',
  text:       '#e2e8f0',
  textDim:    '#4a5568',
  textMute:   '#252e3c',
  green:      '#0EA66E',
  red:        '#FF4444',
  amber:      '#F59E0B',
  /* Neumorphic shadows */
  shadowDark:  'rgba(0,0,0,0.85)',
  shadowLight: 'rgba(255,255,255,0.04)',
}

const neu = (raised = true) => raised
  ? `4px 4px 12px ${C.shadowDark}, -2px -2px 8px ${C.shadowLight}`
  : `inset 2px 2px 6px ${C.shadowDark}, inset -1px -1px 4px ${C.shadowLight}`

/* ─── Axis modes ──────────────────────────────────────────────────────── */
const MODES = [
  { id:'perf_risk',     label:'Performance vs Risk',       x:{key:'pnl_pct',            label:'Return %'},    y:{key:'volatility_proxy', label:'Volatility'}, q:{tr:'Champions',    br:'Momentum Bets',  tl:'Sleeping Giants', bl:'Capital Traps'} },
  { id:'fund_tech',     label:'Fundamental vs Technical',  x:{key:'fundamental_score',  label:'Fundamental'}, y:{key:'technical_score',  label:'Technical'},  q:{tr:'Buy Zone',     br:'Buy on Dip',     tl:'Overbought',      bl:'Avoid'} },
  { id:'weight_return', label:'Weight vs Return',          x:{key:'weight',             label:'Portfolio %'}, y:{key:'pnl_pct',          label:'Return %'},   q:{tr:'Core Winners', br:'Heavy Losers',   tl:'Small Gems',      bl:'Trim These'} },
  { id:'conv_perf',     label:'Conviction vs Performance', x:{key:'conviction_level',   label:'Conviction'},  y:{key:'pnl_pct',          label:'Return %'},   q:{tr:'Right Calls',  br:'Wrong Bets',     tl:'Lucky Wins',      bl:'Regret Zone'} },
]

/* ─── Types ───────────────────────────────────────────────────────────── */
interface Node {
  id: string; symbol: string; name: string; sector: string|null; account: string|null; account_id: string
  pnl_pct: number; pnl: number; current_value: number; weight: number; avg_price: number; ltp: number
  grade: string|null; signal: string|null; pe: number|null
  fundamental_score: number; technical_score: number; risk_score: number; conviction_level: number
  volatility_proxy: number
  is_crown: boolean; market_cap: string|null; rsi: number|null; action: string|null
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const SECTOR_RISK: Record<string,number> = {
  'Small Cap':0.9,'Mid Cap':0.7,'Technology':0.65,'Auto':0.6,'Defence':0.7,
  'Infrastructure':0.55,'Energy':0.5,'Materials':0.55,'FMCG':0.3,'Utilities':0.25,
  'Banking & Finance':0.5,'Pharma':0.45,'Index Fund':0.2,'Large Cap':0.3,
}

function fmtL(v:number):string {
  const abs=Math.abs(v), sign=v>=0?'+':'-'
  if (abs>=100000) return `${sign}₹${(abs/100000).toFixed(2)}L`
  if (abs>=1000)   return `${sign}₹${abs.toLocaleString('en-IN',{maximumFractionDigits:0})}`
  return `${sign}₹${abs.toFixed(0)}`
}

function strip(sym:string):string { return sym.replace(/-(EQ|BE)$/,'') }

function symHash(sym:string):number { return sym.split('').reduce((a,c)=>a+c.charCodeAt(0),0) }

const FILTERS = ['All','Winners','Losers','Large Cap','Mid Cap','Small Cap','Crown Jewels']

/* ─── Static sparkles (golden-ratio distributed, pure CSS animation) ─── */
const SPARKLES = Array.from({length:30}, (_,i) => ({
  x: (i * 137.508) % 100,
  y: (i * 97.421) % 100,
  size: (i % 3) + 1,
  opacity: 0.18 + (i % 5) * 0.06,
  dur: 3 + (i % 4),
  delay: i * 0.3,
}))

/* ─── Page ────────────────────────────────────────────────────────────── */
export default function InvexV2Page() {
  useAuth()

  const [nodes,      setNodes]      = useState<Node[]>([])
  const [loading,    setLoading]    = useState(true)
  const [modeIdx,    setModeIdx]    = useState(0)
  const [filter,     setFilter]     = useState('All')
  const [selected,   setSelected]   = useState<Node|null>(null)
  const [convMap,    setConvMap]    = useState<Map<string,number>>(new Map())
  const [kpi,        setKpi]        = useState({ pnl_pct:0, day_pnl:0, count:0, equity:0 })
  const [canvasDims, setCanvasDims] = useState({ w: 860, h: 520 })

  const nodesRef    = useRef<HTMLDivElement>(null)
  const canvasRef   = useRef<HTMLDivElement>(null)
  const glowRef     = useRef<HTMLDivElement>(null)
  const tickerRef   = useRef<HTMLDivElement>(null)
  const tickerIdxRef = useRef(0)

  /* ── canvas ResizeObserver ── */
  useEffect(() => {
    if (!canvasRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setCanvasDims({ w: entry.contentRect.width, h: entry.contentRect.height })
      }
    })
    ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [])

  /* ── fetch ── */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [hRaw, eRaw, techRaw, scRaw, sumRaw] = await Promise.all([
          apiFetch('/api/v1/portfolio/holdings').then(r => r.json()),
          apiFetch('/api/v1/analysis/holdings-enriched').then(r => r.json()),
          apiFetch('/api/v1/analysis/technical').then(r => r.json()),
          apiFetch('/api/v1/analysis/scorecard').then(r => r.json()),
          apiFetch('/api/v1/portfolio/summary').then(r => r.json()),
        ])
        if (cancelled) return

        const holdings: any[] = Array.isArray(hRaw) ? hRaw : (hRaw?.holdings ?? [])
        const enriched: any[] = Array.isArray(eRaw) ? eRaw : (eRaw?.holdings ?? [])
        const techs:    any[] = techRaw?.holdings ?? []
        const scores:   any[] = scRaw?.holdings   ?? []
        const sum:      any   = sumRaw ?? {}

        const totalValue = holdings.reduce((a:number,h:any)=>a+(h.current_value??0),0) || 1

        const eMap  = new Map(enriched.map((e:any)=>[`${e.symbol}|${e.account_id}`, e]))
        const tMap  = new Map(techs.map((t:any)=>[`${t.symbol}|${t.account_id}`, t]))
        const scMap = new Map(scores.map((s:any)=>[`${s.symbol}|${s.account_id}`, s]))

        const raw: Node[] = holdings.map((h:any, index:number) => {
          const key  = `${h.symbol}|${h.account_id}`
          const e    = eMap.get(key) ?? {}
          const t    = tMap.get(key) ?? {}
          const sc   = scMap.get(key) ?? {}
          const rsi  = t.rsi ?? 50
          const sectorKey = h.market_cap ?? e.market_cap ?? null
          const sectorRisk = sectorKey ? (SECTOR_RISK[sectorKey] ?? 0.5) : 0.5
          const absPnl = Math.abs(h.pnl_pct ?? 0)
          const volatility_proxy =
            absPnl / 100 * 0.4 +
            (sectorKey === 'Small Cap' ? 0.8 : sectorKey === 'Mid Cap' ? 0.55 : 0.3) * 0.4 +
            Math.abs(rsi - 50) / 50 * 0.2

          return {
            id:                key,
            symbol:            strip(h.symbol),
            name:              e.name ?? h.symbol,
            sector:            e.sector ?? null,
            account:           h.account ?? null,
            account_id:        h.account_id,
            pnl_pct:           h.pnl_pct ?? 0,
            pnl:               h.pnl ?? 0,
            current_value:     h.current_value ?? 0,
            weight:            (h.current_value / totalValue) * 100,
            avg_price:         h.avg_price ?? 0,
            ltp:               h.ltp ?? 0,
            grade:             sc.grade ?? e.grade ?? null,
            signal:            t.signal ?? e.signal ?? null,
            pe:                e.pe ?? null,
            fundamental_score: e.fundamental_score ?? 50,
            technical_score:   t.technical_score   ?? 50,
            risk_score:        sectorRisk * 0.5 + (absPnl / 300 * 0.3) + (index * 0.02 * 0.2),
            volatility_proxy,
            conviction_level:  3,
            is_crown:          false,
            market_cap:        h.market_cap ?? e.market_cap ?? null,
            rsi,
            action:            e.action ?? null,
          }
        })

        const sorted = [...raw].sort((a,b)=>b.pnl_pct - a.pnl_pct)
        const crownIds = new Set(sorted.filter(n=>n.pnl_pct>50).slice(0,3).map(n=>n.id))
        raw.forEach(n=>{ n.is_crown = crownIds.has(n.id) })

        setNodes(raw)
        setKpi({
          pnl_pct:  sum.total_pnl_pct ?? 0,
          day_pnl:  sum.day_pnl ?? 0,
          count:    raw.length,
          equity:   sum.equity_value ?? totalValue,
        })
      } catch(e) {
        console.error('InvexV2 fetch error', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  /* ── insights ── */
  const insights = React.useMemo(() => {
    if (!nodes.length) return ['Loading portfolio data…']
    const top3w   = nodes.slice().sort((a,b)=>b.current_value-a.current_value).slice(0,3).map(n=>n.symbol)
    const top3pct = (top3w.length ? nodes.filter(n=>top3w.includes(n.symbol)).reduce((a,n)=>a+n.weight,0) : 0).toFixed(1)
    const winners = nodes.filter(n=>n.pnl_pct>0).length
    const losers  = nodes.filter(n=>n.pnl_pct<0).length
    const best    = nodes.reduce((a,b)=>a.pnl_pct>b.pnl_pct?a:b)
    const worst   = nodes.reduce((a,b)=>a.pnl_pct<b.pnl_pct?a:b)
    const portPnl = kpi.pnl_pct.toFixed(2)
    return [
      `Top 3 positions hold ${top3pct}% of portfolio`,
      `${winners} winners · ${losers} losers across ${nodes.length} holdings`,
      `Best: ${best.symbol} at +${best.pnl_pct.toFixed(1)}%`,
      `Worst: ${worst.symbol} at ${worst.pnl_pct.toFixed(1)}%`,
      `Portfolio ${Number(portPnl)>=0?'+':''}${portPnl}% vs Nifty −1.25%`,
    ]
  }, [nodes, kpi])

  useEffect(() => {
    if (!insights.length) return
    tickerIdxRef.current = 0
    if (tickerRef.current) tickerRef.current.textContent = '◆ ' + insights[0]
    const t = setInterval(() => {
      tickerIdxRef.current = (tickerIdxRef.current + 1) % insights.length
      if (tickerRef.current) {
        gsap.to(tickerRef.current, { y: -10, opacity: 0, duration: 0.2, onComplete: () => {
          if (tickerRef.current) {
            tickerRef.current.textContent = '◆ ' + insights[tickerIdxRef.current]
            gsap.fromTo(tickerRef.current, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3 })
          }
        }})
      }
    }, 4000)
    return () => clearInterval(t)
  }, [insights])

  /* ── filtered nodes ── */
  const filtered = React.useMemo(()=>{
    switch(filter) {
      case 'Winners':     return nodes.filter(n=>n.pnl_pct>0)
      case 'Losers':      return nodes.filter(n=>n.pnl_pct<0)
      case 'Large Cap':   return nodes.filter(n=>n.market_cap==='Large Cap')
      case 'Mid Cap':     return nodes.filter(n=>n.market_cap==='Mid Cap')
      case 'Small Cap':   return nodes.filter(n=>n.market_cap==='Small Cap')
      case 'Crown Jewels':return nodes.filter(n=>n.is_crown)
      default:            return nodes
    }
  }, [nodes, filter])

  /* ── scales + positions ── */
  const mode = MODES[modeIdx]
  const getVal = useCallback((n:Node, key:string):number => {
    return (n as unknown as Record<string,number>)[key] ?? 0
  }, [])

  const { xSc, ySc, szSc, positions } = React.useMemo(()=>{
    const xs = filtered.map(n=>getVal(n, mode.x.key))
    const ys = filtered.map(n=>getVal(n, mode.y.key))
    const xMin = d3.min(xs) ?? 0, xMax = d3.max(xs) ?? 1
    const yMin = d3.min(ys) ?? 0, yMax = d3.max(ys) ?? 1
    const xPad = Math.abs(xMax-xMin)*0.1 || 1
    const yPad = Math.abs(yMax-yMin)*0.1 || 1
    const w = canvasDims.w || 860
    const h = canvasDims.h || 520
    const xSc = d3.scaleLinear().domain([xMin-xPad, xMax+xPad]).range([w*0.10, w*0.90])
    const ySc = d3.scaleLinear().domain([yMin-yPad, yMax+yPad]).range([h*0.90, h*0.10])
    const szSc = d3.scaleSqrt().domain([0, d3.max(filtered.map(n=>n.current_value)) ?? 1]).range([14,52])

    /* Symbol-hash jitter → stable per-symbol, prevents overlaps */
    const pcts = filtered.map(n => {
      const sh = symHash(n.symbol)
      const jx = ((sh % 17) - 8) * 0.5
      const jy = ((sh % 13) - 6) * 0.5
      return {
        x: Math.max(5, Math.min(95, xSc(getVal(n, mode.x.key)) / w * 100 + jx)),
        y: Math.max(5, Math.min(95, ySc(getVal(n, mode.y.key)) / h * 100 + jy)),
      }
    })

    /* Iterative collision separation (3 passes) */
    const MIN_DIST = 8
    for (let pass = 0; pass < 3; pass++) {
      pcts.forEach((a,i) => {
        pcts.forEach((b,j) => {
          if (i===j) return
          const dx = a.x-b.x, dy = a.y-b.y
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist < MIN_DIST && dist > 0) {
            const push = (MIN_DIST - dist) / 2
            a.x += (dx/dist)*push*0.5; a.y += (dy/dist)*push*0.5
            b.x -= (dx/dist)*push*0.5; b.y -= (dy/dist)*push*0.5
          }
        })
      })
    }

    const positions = new Map(filtered.map((n,i)=>[n.id, { x: pcts[i].x * w / 100, y: pcts[i].y * h / 100 }]))
    return { xSc, ySc, szSc, positions }
  }, [filtered, mode, getVal, canvasDims])

  /* ── GSAP entrance ── */
  useGSAP(() => {
    if (!canvasRef.current) return
    const nodeEls = canvasRef.current.querySelectorAll('.matrix-node')
    if (!nodeEls.length) return
    gsap.fromTo(nodeEls,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.5, stagger: { amount: 0.4, from: 'random' }, ease: 'back.out(2)' }
    )
  }, { scope: canvasRef, dependencies: [filtered.length, modeIdx, filter] })

  /* ── conviction ── */
  const getConv = (n:Node) => convMap.get(n.id) ?? n.conviction_level
  const setConv = (id:string, v:number) => setConvMap(m=>new Map(m).set(id,v))

  /* ── mouse glow (GSAP, no setState) ── */
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || !glowRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    gsap.to(glowRef.current, {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      duration: 0.5,
      ease: 'power2.out',
      overwrite: 'auto',
    })
  }, [])

  const pnlColor = (v:number) => v>=0 ? C.green : C.red

  return (
    <>
    <style>{`
      @keyframes crownPulse {
        0%, 100% { box-shadow: 3px 3px 10px rgba(0,0,0,0.8), -1px -1px 5px rgba(255,255,255,0.04), 0 0 8px #F59E0B20; }
        50%       { box-shadow: 3px 3px 10px rgba(0,0,0,0.8), -1px -1px 5px rgba(255,255,255,0.04), 0 0 24px #F59E0B60, 0 0 48px #F59E0B20; }
      }
      @keyframes sparkleFloat {
        0%, 100% { transform: translateY(0) scale(1); }
        50%       { transform: translateY(-4px) scale(1.4); }
      }
      .matrix-node {
        transition: box-shadow 0.25s ease, border-color 0.25s ease, transform 0.2s ease, filter 0.2s ease;
      }
      .matrix-node:not([data-selected="true"]):hover {
        transform: translate(-50%, -50%) scale(1.08) !important;
        filter: brightness(1.6) saturate(1.3);
        z-index: 10 !important;
      }
      .matrix-node[data-selected="true"] {
        transform: translate(-50%, -50%) scale(1.12) !important;
        z-index: 20 !important;
      }
    `}</style>

    <div style={{
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100vh',
      background: `
        radial-gradient(ellipse 80% 60% at 10% 20%, rgba(201,245,59,0.06) 0%, transparent 50%),
        radial-gradient(ellipse 60% 50% at 90% 80%, rgba(14,166,110,0.04) 0%, transparent 50%),
        ${C.bg}
      `,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: 'JetBrains Mono, monospace', color: C.text,
    }}>

      {/* HEADER */}
      <div style={{
        padding: '20px 24px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        boxShadow: `0 4px 20px rgba(0,0,0,0.6), 0 1px 0 ${C.shadowLight}`,
      }}>
        <span style={{ fontFamily:'Syne, sans-serif', fontSize:22, fontWeight:700, letterSpacing:3, color:C.lime }}>
          MATRIX VIEW
        </span>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {[
            { label:'Portfolio P&L', value:`${kpi.pnl_pct>=0?'+':''}${kpi.pnl_pct.toFixed(2)}%`, color:pnlColor(kpi.pnl_pct) },
            { label:'Day P&L',       value:fmtL(kpi.day_pnl),                                      color:pnlColor(kpi.day_pnl) },
            { label:'Holdings',      value:`${kpi.count}`,                                          color:C.text },
            { label:'Equity',        value:fmtL(kpi.equity),                                        color:C.text },
          ].map(k=>(
            <div key={k.label} style={{
              background: C.bg, borderRadius: 12, padding: '8px 16px',
              display: 'flex', flexDirection: 'column', gap: 2,
              boxShadow: neu(true),
            }}>
              <span style={{ fontSize:9, color:C.textDim, letterSpacing:1 }}>{k.label}</span>
              <span style={{ fontSize:13, color:k.color, fontWeight:600 }}>{k.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* TICKER */}
      <div style={{
        margin: '14px 24px 0', height: 32,
        background: 'rgba(201,245,59,0.04)',
        boxShadow: `inset 0 1px 0 rgba(201,245,59,0.08), inset 0 -1px 0 rgba(201,245,59,0.08), 0 2px 8px rgba(0,0,0,0.4)`,
        borderLeft: `3px solid rgba(201,245,59,0.5)`,
        borderRadius: '0 6px 6px 0',
        display: 'flex', alignItems: 'center', paddingLeft: 12, overflow: 'hidden',
      }}>
        <div ref={tickerRef} style={{ fontSize:11, color:C.textDim, letterSpacing:0.5 }}>
          ◆ Loading portfolio data…
        </div>
      </div>

      {/* MODE SWITCHER */}
      <div style={{ display:'flex', gap:8, padding:'14px 24px 0' }}>
        {MODES.map((m,i)=>(
          <button key={m.id} onClick={()=>setModeIdx(i)}
            style={{
              background: C.bg,
              color: i===modeIdx ? C.lime : C.textDim,
              border: i===modeIdx ? `1px solid rgba(201,245,59,0.2)` : '1px solid transparent',
              borderRadius: 20, padding: '6px 14px',
              fontSize: 11, cursor: 'pointer',
              fontFamily: 'Syne, sans-serif', fontWeight: 600, letterSpacing: 0.5,
              transition: 'all 0.2s',
              boxShadow: i===modeIdx
                ? `inset 2px 2px 6px ${C.shadowDark}, inset -1px -1px 3px ${C.shadowLight}, 0 0 12px rgba(201,245,59,0.12)`
                : neu(true),
            }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* FILTER BAR */}
      <div style={{ display:'flex', gap:8, padding:'10px 24px 0', flexWrap:'wrap' }}>
        {FILTERS.map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{
              background: C.bg,
              border: f===filter ? `1px solid rgba(201,245,59,0.18)` : '1px solid transparent',
              color: f===filter ? C.lime : C.textDim,
              borderRadius: 16, padding: '5px 12px', fontSize: 10,
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.5,
              transition: 'all 0.2s',
              boxShadow: f===filter
                ? `inset 2px 2px 5px ${C.shadowDark}, inset -1px -1px 3px ${C.shadowLight}`
                : `2px 2px 6px ${C.shadowDark}, -1px -1px 3px ${C.shadowLight}`,
            }}>
            {f}
          </button>
        ))}
      </div>

      {/* MAIN ROW */}
      <div style={{ flex:1, display:'flex', gap:16, padding:'12px 24px 16px', overflow:'hidden', minHeight:0 }}>

        {/* CANVAS */}
        <div ref={canvasRef}
          style={{
            flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden',
            background: C.surface2, borderRadius: 16,
            boxShadow: `inset 4px 4px 20px rgba(0,0,0,0.85), inset -2px -2px 10px rgba(255,255,255,0.02)`,
          }}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => glowRef.current && gsap.to(glowRef.current, { opacity:0, duration:0.3 })}
          onMouseEnter={() => glowRef.current && gsap.to(glowRef.current, { opacity:1, duration:0.3 })}
        >
          {/* Grid */}
          <div style={{
            position:'absolute', inset:0, pointerEvents:'none',
            backgroundImage: `linear-gradient(rgba(201,245,59,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(201,245,59,0.025) 1px, transparent 1px)`,
            backgroundSize: '96px 40px',
          }} />

          {/* Ambient center glow */}
          <div style={{
            position:'absolute', inset:0, pointerEvents:'none',
            background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(201,245,59,0.03) 0%, transparent 70%)',
          }} />

          {/* Static sparkles */}
          {SPARKLES.map((s,i)=>(
            <div key={i} style={{
              position:'absolute', left:`${s.x}%`, top:`${s.y}%`,
              width: s.size, height: s.size, borderRadius:'50%',
              background: '#C9F53B', opacity: s.opacity,
              pointerEvents:'none',
              animation: `sparkleFloat ${s.dur}s ease-in-out infinite`,
              animationDelay: `${s.delay}s`,
            }} />
          ))}

          {/* Mouse glow */}
          <div ref={glowRef} style={{
            position:'absolute', width:360, height:360, borderRadius:'50%',
            background:'radial-gradient(circle, rgba(201,245,59,0.07) 0%, transparent 70%)',
            transform:'translate(-50%, -50%)',
            pointerEvents:'none', left:0, top:0, opacity:0,
          }} />

          {/* Axis labels */}
          <span style={{ position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', fontSize:9, color:C.textDim, letterSpacing:1 }}>{mode.x.label} →</span>
          <span style={{ position:'absolute', top:'50%', left:8, transform:'rotate(-90deg) translateX(50%)', fontSize:9, color:C.textDim, letterSpacing:1 }}>{mode.y.label} →</span>

          {/* Quadrant lines */}
          <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, borderLeft:`1px dashed rgba(201,245,59,0.12)` }} />
          <div style={{ position:'absolute', top:'50%', left:0, right:0, height:1, borderTop:`1px dashed rgba(201,245,59,0.12)` }} />

          {/* Quadrant labels */}
          {[
            { label:mode.q.tl, s:{ top:12, left:16 } },
            { label:mode.q.tr, s:{ top:12, right:16 } },
            { label:mode.q.bl, s:{ bottom:20, left:16 } },
            { label:mode.q.br, s:{ bottom:20, right:16 } },
          ].map(ql=>(
            <span key={ql.label} style={{ position:'absolute', ...ql.s, fontSize:10, color:'rgba(201,245,59,0.12)', fontFamily:'Syne,sans-serif', fontWeight:600, letterSpacing:0.5, pointerEvents:'none' }}>{ql.label}</span>
          ))}

          {/* Loading */}
          {loading && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:C.textDim, fontSize:12 }}>
              Loading nodes…
            </div>
          )}

          {/* Nodes */}
          <div ref={nodesRef} style={{ position:'absolute', inset:0 }}>
            {!loading && filtered.map(n=>{
              const glowColor = n.is_crown ? '#F59E0B'
                : n.pnl_pct > 30 ? '#0EA66E'
                : n.pnl_pct > 0  ? '#34d399'
                : n.pnl_pct > -15 ? '#6b7280'
                : '#FF4444'
              const isSelected = selected?.id === n.id
              const dia = szSc(n.current_value) * 2
              return (
                <div key={n.id}
                  className="matrix-node"
                  data-selected={isSelected ? 'true' : undefined}
                  onClick={()=>setSelected(s=>s?.id===n.id?null:n)}
                  style={{
                    position: 'absolute',
                    left: positions.get(n.id)?.x ?? xSc(getVal(n, mode.x.key)),
                    top:  positions.get(n.id)?.y ?? ySc(getVal(n, mode.y.key)),
                    width: dia, height: dia, borderRadius: '50%',
                    transform: 'translate(-50%, -50%) scale(1)',
                    cursor: 'pointer',
                    zIndex: isSelected ? 20 : 1,
                    background: C.bg,
                    border: `1px solid ${glowColor}${isSelected ? '50' : '20'}`,
                    boxShadow: isSelected
                      ? `inset 3px 3px 10px rgba(0,0,0,0.9), inset -2px -2px 6px rgba(255,255,255,0.04), 0 0 20px ${glowColor}50, 0 0 40px ${glowColor}20`
                      : `3px 3px 10px rgba(0,0,0,0.8), -1px -1px 5px rgba(255,255,255,0.04), 0 0 8px ${glowColor}18`,
                    animation: n.is_crown ? 'crownPulse 2.5s ease-in-out infinite' : 'none',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: 4, userSelect: 'none',
                    overflow: 'hidden',
                  }}>
                  {/* Inner highlight (top-left light source) */}
                  <div style={{
                    position:'absolute', top:'12%', left:'18%',
                    width:'32%', height:'32%', borderRadius:'50%',
                    background:'radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 70%)',
                    pointerEvents:'none',
                  }} />
                  <span style={{ fontSize:9, color:'#e2e8f0', fontFamily:'JetBrains Mono,monospace', fontWeight:700, textAlign:'center', lineHeight:1.1, pointerEvents:'none', textShadow:`0 0 8px ${glowColor}50`, position:'relative' }}>
                    {n.symbol.length>6?n.symbol.slice(0,5)+'…':n.symbol}
                  </span>
                  <span style={{ fontSize:8, pointerEvents:'none', color: n.pnl_pct>=0 ? '#34d399' : '#FF4444', lineHeight:1.1, position:'relative' }}>
                    {n.pnl_pct>=0?'+':''}{n.pnl_pct.toFixed(1)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* DETAIL PANEL */}
        <AnimatePresence>
          {selected ? (
            <motion.div key="panel"
              initial={{ x:320, opacity:0 }} animate={{ x:0, opacity:1 }} exit={{ x:320, opacity:0 }}
              transition={{ type:'spring', stiffness:300, damping:30 }}
              style={{
                width:280, background:C.bg, borderRadius:16, padding:20,
                display:'flex', flexDirection:'column', gap:14,
                overflowY:'auto', flexShrink:0,
                boxShadow: `-8px 0 24px rgba(0,0,0,0.8), -1px 0 0 ${C.shadowLight}, ${neu(true)}`,
              }}>

              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontSize:18, fontWeight:700, color:C.text, fontFamily:'Syne,sans-serif' }}>{selected.symbol}</div>
                  <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>{selected.account ?? 'Portfolio'}</div>
                </div>
                <button onClick={()=>setSelected(null)}
                  style={{
                    background: C.bg, color: C.textDim, border:'none',
                    borderRadius:6, width:28, height:28, cursor:'pointer',
                    fontSize:16, display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow: neu(true),
                  }}>×</button>
              </div>

              {/* Chips */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {selected.grade && <span style={{ fontSize:10, background:C.limeDim, border:`1px solid ${C.limeBorder}`, color:C.lime, borderRadius:12, padding:'3px 10px' }}>Grade {selected.grade}</span>}
                {selected.signal && <span style={{ fontSize:10, background:'rgba(14,166,110,0.08)', border:'1px solid rgba(14,166,110,0.25)', color:C.green, borderRadius:12, padding:'3px 10px' }}>{selected.signal}</span>}
                {selected.is_crown && <span style={{ fontSize:10, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', color:C.amber, borderRadius:12, padding:'3px 10px' }}>👑 Crown</span>}
              </div>

              {/* P&L block */}
              <div style={{ background:C.surface2, borderRadius:10, padding:'12px 14px', display:'flex', justifyContent:'space-between', boxShadow: neu(false) }}>
                <div>
                  <div style={{ fontSize:9, color:C.textDim, letterSpacing:1 }}>P&L</div>
                  <div style={{ fontSize:22, fontWeight:700, color:pnlColor(selected.pnl_pct) }}>{selected.pnl_pct>=0?'+':''}{selected.pnl_pct.toFixed(2)}%</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:9, color:C.textDim, letterSpacing:1 }}>AMOUNT</div>
                  <div style={{ fontSize:14, color:pnlColor(selected.pnl), fontWeight:600 }}>{fmtL(selected.pnl)}</div>
                </div>
              </div>

              {/* Price grid */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { label:'LTP',   value:`₹${selected.ltp.toLocaleString('en-IN')}` },
                  { label:'Avg',   value:`₹${selected.avg_price.toLocaleString('en-IN')}` },
                  { label:'Value', value:fmtL(selected.current_value) },
                  { label:'Wt',    value:`${selected.weight.toFixed(2)}%` },
                ].map(r=>(
                  <div key={r.label} style={{ background:C.surface2, borderRadius:8, padding:'8px 10px', boxShadow: neu(false) }}>
                    <div style={{ fontSize:9, color:C.textDim }}>{r.label}</div>
                    <div style={{ fontSize:12, color:C.text, fontWeight:600, marginTop:2 }}>{r.value}</div>
                  </div>
                ))}
              </div>

              {/* RSI bar */}
              {selected.rsi != null && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:9, color:C.textDim, letterSpacing:1 }}>RSI</span>
                    <span style={{ fontSize:10, color:C.text }}>{selected.rsi.toFixed(1)}</span>
                  </div>
                  <div style={{ height:6, background:C.surface2, borderRadius:3, overflow:'hidden', boxShadow: neu(false) }}>
                    <div style={{ height:'100%', width:`${selected.rsi}%`, background:C.lime, borderRadius:3, transition:'width 0.4s' }} />
                  </div>
                </div>
              )}

              {/* Sector / cap */}
              <div style={{ display:'flex', gap:8, fontSize:10, color:C.textDim }}>
                {selected.sector && <span style={{ background:C.surface2, borderRadius:6, padding:'4px 8px', boxShadow: neu(false) }}>{selected.sector}</span>}
                {selected.market_cap && <span style={{ background:C.surface2, borderRadius:6, padding:'4px 8px', boxShadow: neu(false) }}>{selected.market_cap}</span>}
              </div>

              {/* Conviction */}
              <div>
                <div style={{ fontSize:9, color:C.textDim, letterSpacing:1, marginBottom:6 }}>CONVICTION</div>
                <div style={{ display:'flex', gap:6 }}>
                  {[1,2,3,4,5].map(v=>(
                    <button key={v} onClick={()=>setConv(selected.id, v)}
                      style={{
                        width:28, height:28, borderRadius:'50%', border:'none',
                        background: C.bg, cursor:'pointer',
                        fontSize:11, fontWeight:700,
                        color: getConv(selected)>=v ? C.lime : C.textMute,
                        boxShadow: getConv(selected)>=v ? neu(false) : neu(true),
                        transition: 'all 0.15s',
                      }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="empty"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              style={{ width:280, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <span style={{ fontSize:11, color:C.textMute, fontStyle:'italic' }}>← click any node</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    </>
  )
}
