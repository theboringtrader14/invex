import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import * as d3 from 'd3'
import { apiFetch } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

gsap.registerPlugin(useGSAP)

/* ─── Tokens ─────────────────────────────────────────────────────────── */
const C = {
  lime:       '#C9F53B',
  limeDim:    'rgba(201,245,59,0.10)',
  limeBorder: 'rgba(201,245,59,0.22)',
  bg:         '#080c10',
  surface:    '#0d1218',
  surface2:   '#111820',
  border:     'rgba(255,255,255,0.06)',
  text:       '#e2e8f0',
  textDim:    '#4a5568',
  textMute:   '#2a3545',
  green:      '#0EA66E',
  red:        '#FF4444',
  amber:      '#F59E0B',
}

/* ─── Axis modes ──────────────────────────────────────────────────────── */
const MODES = [
  { id:'perf_risk',     label:'Performance vs Risk',       x:{key:'pnl_pct',          label:'Return %'},    y:{key:'risk_score',       label:'Risk'},      q:{tr:'Champions',    br:'Momentum Bets',  tl:'Sleeping Giants', bl:'Capital Traps'} },
  { id:'fund_tech',     label:'Fundamental vs Technical',  x:{key:'fundamental_score', label:'Fundamental'}, y:{key:'technical_score',  label:'Technical'}, q:{tr:'Buy Zone',     br:'Buy on Dip',     tl:'Overbought',      bl:'Avoid'} },
  { id:'weight_return', label:'Weight vs Return',          x:{key:'weight',            label:'Portfolio %'}, y:{key:'pnl_pct',          label:'Return %'},  q:{tr:'Core Winners', br:'Heavy Losers',   tl:'Small Gems',      bl:'Trim These'} },
  { id:'conv_perf',     label:'Conviction vs Performance', x:{key:'conviction_level',  label:'Conviction'},  y:{key:'pnl_pct',          label:'Return %'},  q:{tr:'Right Calls',  br:'Wrong Bets',     tl:'Lucky Wins',      bl:'Regret Zone'} },
]

/* ─── Types ───────────────────────────────────────────────────────────── */
interface Node {
  id: string; symbol: string; name: string; sector: string|null; account: string|null; account_id: string
  pnl_pct: number; pnl: number; current_value: number; weight: number; avg_price: number; ltp: number
  grade: string|null; signal: string|null; pe: number|null
  fundamental_score: number; technical_score: number; risk_score: number; conviction_level: number
  is_crown: boolean; market_cap: string|null; rsi: number|null; action: string|null
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const SECTOR_RISK: Record<string,number> = {
  'Small Cap':0.9,'Mid Cap':0.7,'Technology':0.65,'Auto':0.6,'Defence':0.7,
  'Infrastructure':0.55,'Energy':0.5,'Materials':0.55,'FMCG':0.3,'Utilities':0.25,
  'Banking & Finance':0.5,'Pharma':0.45,'Index Fund':0.2,'Large Cap':0.3,
}

function nodeColor(n:Node):string {
  if (n.is_crown) return C.amber
  if (n.pnl_pct > 50) return C.green
  if (n.pnl_pct > 0)  return '#34d399'
  if (n.pnl_pct > -15) return '#6b7280'
  return C.red
}

function fmtL(v:number):string {
  const abs=Math.abs(v), sign=v>=0?'+':'-'
  if (abs>=100000) return `${sign}₹${(abs/100000).toFixed(2)}L`
  if (abs>=1000)   return `${sign}₹${abs.toLocaleString('en-IN',{maximumFractionDigits:0})}`
  return `${sign}₹${abs.toFixed(0)}`
}

function strip(sym:string):string { return sym.replace(/-(EQ|BE)$/,'') }

const CANVAS_W = 860, CANVAS_H = 520
const FILTERS = ['All','Winners','Losers','Large Cap','Mid Cap','Small Cap','Crown Jewels']

/* ─── Page ────────────────────────────────────────────────────────────── */
export default function InvexV2Page() {
  useAuth()

  const [nodes,      setNodes]      = useState<Node[]>([])
  const [loading,    setLoading]    = useState(true)
  const [modeIdx,    setModeIdx]    = useState(0)
  const [filter,     setFilter]     = useState('All')
  const [selected,   setSelected]   = useState<Node|null>(null)
  const [hovered,    setHovered]    = useState<string|null>(null)
  const [insightIdx, setInsightIdx] = useState(0)
  const [convMap,    setConvMap]    = useState<Map<string,number>>(new Map())
  const [kpi,        setKpi]        = useState({ pnl_pct:0, day_pnl:0, count:0, equity:0 })

  const nodesRef = useRef<HTMLDivElement>(null)

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

        const raw: Node[] = holdings.map((h:any) => {
          const key  = `${h.symbol}|${h.account_id}`
          const e    = eMap.get(key) ?? {}
          const t    = tMap.get(key) ?? {}
          const sc   = scMap.get(key) ?? {}
          const rsi  = t.rsi ?? 50
          const rsiDev = Math.abs(rsi - 50) / 50
          const sectorKey = h.market_cap ?? e.market_cap ?? null
          const sectorRisk = sectorKey ? (SECTOR_RISK[sectorKey] ?? 0.5) : 0.5
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
            risk_score:        rsiDev * 0.6 + sectorRisk * 0.4,
            conviction_level:  3,
            is_crown:          false,
            market_cap:        h.market_cap ?? e.market_cap ?? null,
            rsi:               rsi,
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
    const top3w  = nodes.slice().sort((a,b)=>b.current_value-a.current_value).slice(0,3).map(n=>n.symbol)
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
    const t = setInterval(()=>setInsightIdx(i=>(i+1)%insights.length), 4000)
    return () => clearInterval(t)
  }, [insights.length])

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

  /* ── scales ── */
  const mode = MODES[modeIdx]
  const getVal = useCallback((n:Node, key:string):number => {
    return (n as unknown as Record<string,number>)[key] ?? 0
  }, [])

  const { xSc, ySc, szSc } = React.useMemo(()=>{
    const xs = filtered.map(n=>getVal(n, mode.x.key))
    const ys = filtered.map(n=>getVal(n, mode.y.key))
    const xMin = d3.min(xs) ?? 0, xMax = d3.max(xs) ?? 1
    const yMin = d3.min(ys) ?? 0, yMax = d3.max(ys) ?? 1
    const xPad = Math.abs(xMax-xMin)*0.1 || 1
    const yPad = Math.abs(yMax-yMin)*0.1 || 1
    const xSc  = d3.scaleLinear().domain([xMin-xPad, xMax+xPad]).range([CANVAS_W*0.10, CANVAS_W*0.90])
    const ySc  = d3.scaleLinear().domain([yMin-yPad, yMax+yPad]).range([CANVAS_H*0.90, CANVAS_H*0.10])
    const szSc = d3.scaleSqrt().domain([0, d3.max(filtered.map(n=>n.current_value)) ?? 1]).range([14,52])
    return { xSc, ySc, szSc }
  }, [filtered, mode, getVal])

  /* ── GSAP entrance ── */
  useGSAP(()=>{
    if (!nodesRef.current || loading) return
    gsap.fromTo(
      nodesRef.current.children,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.4, stagger: 0.02, ease: 'back.out(1.7)', transformOrigin:'center center' }
    )
  }, { dependencies: [filtered.length, modeIdx, loading], scope: nodesRef })

  /* ── conviction ── */
  const getConv = (n:Node) => convMap.get(n.id) ?? n.conviction_level
  const setConv = (id:string, v:number) => setConvMap(m=>new Map(m).set(id,v))

  /* ── render ── */
  const pnlColor = (v:number) => v>=0 ? C.green : C.red

  return (
    <>
    <style>{`
      @keyframes crownPulse {
        0%, 100% { box-shadow: 0 0 8px #F59E0B30, 0 4px 16px rgba(0,0,0,0.4); }
        50% { box-shadow: 0 0 0 3px #F59E0B20, 0 0 24px #F59E0B60, 0 0 48px #F59E0B20, 0 8px 32px rgba(0,0,0,0.6); }
      }
    `}</style>
    <div style={{ width:'100vw', height:'100vh', background:C.bg, display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:'JetBrains Mono, monospace', color:C.text }}>

      {/* HEADER */}
      <div style={{ padding:'20px 24px 0', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <span style={{ fontFamily:'Syne, sans-serif', fontSize:22, fontWeight:700, letterSpacing:3, color:C.lime }}>MATRIX VIEW</span>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {[
            { label:'Portfolio P&L', value:`${kpi.pnl_pct>=0?'+':''}${kpi.pnl_pct.toFixed(2)}%`, color:pnlColor(kpi.pnl_pct) },
            { label:'Day P&L', value:fmtL(kpi.day_pnl), color:pnlColor(kpi.day_pnl) },
            { label:'Holdings', value:`${kpi.count}`, color:C.text },
            { label:'Equity', value:fmtL(kpi.equity), color:C.text },
          ].map(k=>(
            <div key={k.label} style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 14px', display:'flex', flexDirection:'column', gap:2 }}>
              <span style={{ fontSize:9, color:C.textDim, letterSpacing:1 }}>{k.label}</span>
              <span style={{ fontSize:13, color:k.color, fontWeight:600 }}>{k.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* TICKER */}
      <div style={{ margin:'14px 24px 0', height:32, background:C.surface, borderLeft:`3px solid ${C.lime}`, borderRadius:'0 6px 6px 0', display:'flex', alignItems:'center', paddingLeft:12, overflow:'hidden', position:'relative' }}>
        <AnimatePresence mode="wait">
          <motion.span key={insightIdx} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.35}}
            style={{ fontSize:11, color:C.textDim, letterSpacing:0.5 }}>
            {insights[insightIdx]}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* MODE SWITCHER */}
      <div style={{ display:'flex', gap:8, padding:'14px 24px 0' }}>
        {MODES.map((m,i)=>(
          <button key={m.id} onClick={()=>setModeIdx(i)}
            style={{ background: i===modeIdx ? C.lime : C.surface2, color: i===modeIdx ? C.bg : C.textDim,
              border:`1px solid ${i===modeIdx ? C.lime : C.border}`, borderRadius:20, padding:'6px 14px',
              fontSize:11, cursor:'pointer', fontFamily:'Syne, sans-serif', fontWeight:600, letterSpacing:0.5, transition:'all 0.2s' }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* FILTER BAR */}
      <div style={{ display:'flex', gap:8, padding:'10px 24px 0', flexWrap:'wrap' }}>
        {FILTERS.map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{ background: f===filter ? C.limeDim : 'transparent', border:`1px solid ${f===filter ? C.limeBorder : C.border}`,
              color: f===filter ? C.lime : C.textDim, borderRadius:16, padding:'5px 12px', fontSize:10,
              cursor:'pointer', fontFamily:'JetBrains Mono, monospace', letterSpacing:0.5, transition:'all 0.2s' }}>
            {f}
          </button>
        ))}
      </div>

      {/* MAIN ROW */}
      <div style={{ flex:1, display:'flex', gap:16, padding:'0 24px 16px', overflow:'hidden', minHeight:0 }}>

        {/* CANVAS */}
        <div style={{ flex:1, position:'relative', background:C.bg, borderRadius:16, border:`1px solid ${C.border}`, overflow:'hidden', minHeight:0 }}>

          {/* Ambient radial glow */}
          <div className="canvas-ambient" style={{
            position:'absolute', inset:0, pointerEvents:'none',
            background:'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(201,245,59,0.04) 0%, transparent 70%)',
          }} />
          {/* Grid overlay */}
          <div style={{
            position:'absolute', inset:0, pointerEvents:'none',
            backgroundImage:`linear-gradient(rgba(201,245,59,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(201,245,59,0.025) 1px, transparent 1px)`,
            backgroundSize:'60px 60px',
          }} />

          {/* Axis labels */}
          <span style={{ position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', fontSize:9, color:C.textDim, fontFamily:'JetBrains Mono,monospace', letterSpacing:1 }}>{mode.x.label} →</span>
          <span style={{ position:'absolute', top:'50%', left:8, transform:'rotate(-90deg) translateX(50%)', fontSize:9, color:C.textDim, fontFamily:'JetBrains Mono,monospace', letterSpacing:1 }}>{mode.y.label} →</span>

          {/* Quadrant lines */}
          <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, borderLeft:`1px dashed rgba(201,245,59,0.15)` }} />
          <div style={{ position:'absolute', top:'50%', left:0, right:0, height:1, borderTop:`1px dashed rgba(201,245,59,0.15)` }} />

          {/* Quadrant labels */}
          {[
            { label:mode.q.tl, style:{ top:12, left:16 } },
            { label:mode.q.tr, style:{ top:12, right:16 } },
            { label:mode.q.bl, style:{ bottom:20, left:16 } },
            { label:mode.q.br, style:{ bottom:20, right:16 } },
          ].map(ql=>(
            <span key={ql.label} style={{ position:'absolute', ...ql.style, fontSize:10, color:C.limeDim, fontFamily:'Syne,sans-serif', fontWeight:600, letterSpacing:0.5, pointerEvents:'none' }}>{ql.label}</span>
          ))}

          {/* Loading */}
          {loading && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:C.textDim, fontSize:12 }}>
              Loading nodes…
            </div>
          )}

          {/* Nodes container */}
          <div ref={nodesRef} style={{ position:'absolute', inset:0 }}>
            {!loading && filtered.map(n=>{
              const glowColor = n.is_crown ? '#F59E0B'
                : n.pnl_pct > 30 ? '#0EA66E'
                : n.pnl_pct > 0  ? '#34d399'
                : n.pnl_pct > -15 ? '#6b7280'
                : '#FF4444'
              const isSelected = selected?.id === n.id
              const isHovered  = hovered === n.id
              const r   = szSc(n.current_value)
              const dia = r * 2
              return (
                <div key={n.id}
                  className="matrix-node"
                  onMouseEnter={()=>setHovered(n.id)}
                  onMouseLeave={()=>setHovered(null)}
                  onClick={()=>setSelected(s=>s?.id===n.id?null:n)}
                  style={{
                    position: 'absolute',
                    left: xSc(getVal(n, mode.x.key)),
                    top:  ySc(getVal(n, mode.y.key)),
                    width: dia,
                    height: dia,
                    borderRadius: '50%',
                    transform: isSelected
                      ? 'translate(-50%, -50%) scale(1.15)'
                      : isHovered
                      ? 'translate(-50%, -50%) scale(1.08)'
                      : 'translate(-50%, -50%) scale(1)',
                    cursor: 'pointer',
                    zIndex: isSelected ? 20 : isHovered ? 10 : 1,
                    background: `radial-gradient(circle at 30% 30%, ${glowColor}28 0%, ${glowColor}08 60%, transparent 100%)`,
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: `1.5px solid ${glowColor}${isSelected ? '90' : isHovered ? '60' : '30'}`,
                    boxShadow: isSelected
                      ? `0 0 0 2px ${glowColor}30, 0 0 20px ${glowColor}50, 0 0 40px ${glowColor}20, 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 ${glowColor}40`
                      : isHovered
                      ? `0 0 0 1px ${glowColor}25, 0 0 16px ${glowColor}45, 0 0 32px ${glowColor}15, 0 8px 24px rgba(0,0,0,0.5)`
                      : `0 0 8px ${glowColor}20, 0 4px 16px rgba(0,0,0,0.4)`,
                    transition: 'box-shadow 0.3s ease, border-color 0.3s ease, transform 0.2s ease',
                    animation: n.is_crown ? 'crownPulse 2.5s ease-in-out infinite' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                    userSelect: 'none',
                  }}>
                  <span style={{ fontSize:9, color:'#fff', fontFamily:'JetBrains Mono,monospace', fontWeight:700, textAlign:'center', lineHeight:1.1, pointerEvents:'none', textShadow:`0 0 10px ${glowColor}60` }}>
                    {n.symbol.length>6?n.symbol.slice(0,5)+'…':n.symbol}
                  </span>
                  <span style={{ fontSize:8, pointerEvents:'none', textShadow: n.pnl_pct >= 0 ? '0 0 8px #0EA66E80' : '0 0 8px #FF444480', color: n.pnl_pct >= 0 ? '#34d399' : '#FF4444', lineHeight:1.1 }}>
                    {n.pnl_pct >= 0 ? '+' : ''}{n.pnl_pct.toFixed(1)}%
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
              style={{ width:280, background:C.surface, borderRadius:16, border:`1px solid ${C.border}`, padding:20, display:'flex', flexDirection:'column', gap:14, overflowY:'auto', flexShrink:0 }}>

              {/* Header row */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontSize:18, fontWeight:700, color:C.text, fontFamily:'Syne,sans-serif' }}>{selected.symbol}</div>
                  <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>{selected.account ?? 'Portfolio'}</div>
                </div>
                <button onClick={()=>setSelected(null)}
                  style={{ background:'transparent', border:`1px solid ${C.border}`, color:C.textDim, borderRadius:6, width:28, height:28, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
              </div>

              {/* Chips */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {selected.grade && <span style={{ fontSize:10, background:C.limeDim, border:`1px solid ${C.limeBorder}`, color:C.lime, borderRadius:12, padding:'3px 10px' }}>Grade {selected.grade}</span>}
                {selected.signal && <span style={{ fontSize:10, background:'rgba(14,166,110,0.1)', border:'1px solid rgba(14,166,110,0.3)', color:C.green, borderRadius:12, padding:'3px 10px' }}>{selected.signal}</span>}
                {selected.is_crown && <span style={{ fontSize:10, background:`rgba(245,158,11,0.12)`, border:`1px solid rgba(245,158,11,0.3)`, color:C.amber, borderRadius:12, padding:'3px 10px' }}>👑 Crown</span>}
              </div>

              {/* P&L */}
              <div style={{ background:C.surface2, borderRadius:10, padding:'12px 14px', display:'flex', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:9, color:C.textDim, letterSpacing:1 }}>P&L</div>
                  <div style={{ fontSize:22, fontWeight:700, color:pnlColor(selected.pnl_pct) }}>{selected.pnl_pct>=0?'+':''}{selected.pnl_pct.toFixed(2)}%</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:9, color:C.textDim, letterSpacing:1 }}>AMOUNT</div>
                  <div style={{ fontSize:14, color:pnlColor(selected.pnl), fontWeight:600 }}>{fmtL(selected.pnl)}</div>
                </div>
              </div>

              {/* Prices */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { label:'LTP',   value:`₹${selected.ltp.toLocaleString('en-IN')}` },
                  { label:'Avg',   value:`₹${selected.avg_price.toLocaleString('en-IN')}` },
                  { label:'Value', value:fmtL(selected.current_value) },
                  { label:'Wt',    value:`${selected.weight.toFixed(2)}%` },
                ].map(r=>(
                  <div key={r.label} style={{ background:C.surface2, borderRadius:8, padding:'8px 10px' }}>
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
                  <div style={{ height:6, background:C.surface2, borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${selected.rsi}%`, background:C.lime, borderRadius:3, transition:'width 0.4s' }} />
                  </div>
                </div>
              )}

              {/* Sector / market cap */}
              <div style={{ display:'flex', gap:8, fontSize:10, color:C.textDim }}>
                {selected.sector && <span style={{ background:C.surface2, borderRadius:6, padding:'4px 8px' }}>{selected.sector}</span>}
                {selected.market_cap && <span style={{ background:C.surface2, borderRadius:6, padding:'4px 8px' }}>{selected.market_cap}</span>}
              </div>

              {/* Conviction stepper */}
              <div>
                <div style={{ fontSize:9, color:C.textDim, letterSpacing:1, marginBottom:6 }}>CONVICTION</div>
                <div style={{ display:'flex', gap:6 }}>
                  {[1,2,3,4,5].map(v=>(
                    <button key={v} onClick={()=>setConv(selected.id, v)}
                      style={{ width:28, height:28, borderRadius:'50%', border:`2px solid ${getConv(selected)>=v ? C.lime : C.border}`,
                        background: getConv(selected)>=v ? C.limeDim : 'transparent', cursor:'pointer',
                        fontSize:11, fontWeight:700, color: getConv(selected)>=v ? C.lime : C.textMute, transition:'all 0.15s' }}>
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
