import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import * as d3 from 'd3'
import { apiFetch } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import PixelBurst from '../components/v2/PixelBurst'
import chartIcon3d  from '../assets/icons3d/invex-chart.webp'
import targetIcon3d from '../assets/icons3d/goalex-target.webp'
import techIcon3d   from '../assets/icons3d/finex-dollar.webp'

gsap.registerPlugin(useGSAP)

/* ─── Design tokens — CSS vars for theme, semantic for functional ─────── */
const C = {
  accent:      '#2dd4bf',                   // teal — hardcoded for non-style usage
  accentDim:   'rgba(45,212,191,0.08)',
  accentBorder:'rgba(45,212,191,0.20)',
  bg:          'var(--bg)',
  surface2:    'var(--bg-surface)',
  text:        'var(--text)',
  textDim:     'var(--text-dim)',
  textMute:    'var(--text-mute)',
  green:       '#0EA66E',
  red:         '#FF4444',
  amber:       '#F59E0B',
}

const neu = (raised = true) => raised
  ? 'var(--neu-raised-sm)'
  : 'var(--neu-inset)'

/* ─── Axis modes ──────────────────────────────────────────────────────── */
const MODES = [
  { id:'perf_risk',     label:'Performance vs Weight',      x:{key:'pnl_pct',           label:'Return %'},               y:{key:'weight',           label:'Portfolio Weight %'}, q:{tr:'Heavy Winners',     br:'Light Winners',  tl:'Heavy Anchors',    bl:'Trim These'} },
  { id:'fund_tech',     label:'PE vs Return',              x:{key:'pe',                 label:'PE Ratio (lower=cheaper)'},y:{key:'pnl_pct',          label:'Return %'},    q:{tr:'Expensive Winners', br:'Value Traps',     tl:'Value Champions',  bl:'Avoid'} },
  { id:'weight_return', label:'Weight vs Return',          x:{key:'weight',             label:'Portfolio %'},             y:{key:'pnl_pct',          label:'Return %'},    q:{tr:'Core Winners',      br:'Heavy Losers',   tl:'Small Gems',       bl:'Trim These'} },
  { id:'conv_perf',     label:'Conviction vs Performance', x:{key:'conviction_level',   label:'Conviction'},              y:{key:'pnl_pct',          label:'Return %'},    q:{tr:'Right Calls',       br:'Wrong Bets',     tl:'Lucky Wins',       bl:'Regret Zone'} },
]

/* ─── Types ───────────────────────────────────────────────────────────── */
interface Node {
  id: string; symbol: string; name: string; sector: string|null; account: string|null; account_id: string
  pnl_pct: number; pnl: number; current_value: number; weight: number; avg_price: number; ltp: number
  grade: string|null; signal: string|null; pe: number; pb: number|null
  fundamental_score: number; technical_score: number; risk_score: number; conviction_level: number
  volatility_proxy: number
  is_crown: boolean; market_cap: string|null; rsi: number|null; action: string|null
  above_50dma: boolean|null; above_200dma: boolean|null
  overall_score: number
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const SECTOR_RISK: Record<string,number> = {
  'Small Cap':0.9,'Mid Cap':0.7,'Technology':0.65,'Auto':0.6,'Defence':0.7,
  'Infrastructure':0.55,'Energy':0.5,'Materials':0.55,'FMCG':0.3,'Utilities':0.25,
  'Banking & Finance':0.5,'Pharma':0.45,'Index Fund':0.2,'Large Cap':0.3,
}

function gradeToScore(grade: string | null): number {
  return ({A: 85, B: 70, C: 55, D: 35} as Record<string, number>)[grade || ''] ?? 50
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

/* ─── SparkleLayer — isolated, React.memo, NEVER re-renders ─────────── */
const SPARKLE_DATA = Array.from({length:40}, (_,i) => ({
  x:   (i * 137.508) % 100,
  y:   (i * 97.421)  % 100,
  sz:  1 + (i % 3),
  op:  0.08 + (i % 5) * 0.03,
  dur: 3 + (i % 5),
  del: -(i * 0.7),
}))

const SparkleLayer = React.memo(function SparkleLayer() {
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
      {SPARKLE_DATA.map((s,i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${s.x}%`, top: `${s.y}%`,
          width: s.sz, height: s.sz,
          borderRadius: '50%',
          background: '#2dd4bf',
          opacity: s.op,
          pointerEvents: 'none',
          animation: `sparkleFloat ${s.dur}s ease-in-out infinite ${s.del}s`,
        }} />
      ))}
    </div>
  )
})

/* ─── Trigger pixel burst via DOM — no state, no re-render ──────────── */
function fireBurst(e: React.MouseEvent) {
  const rect = e.currentTarget.getBoundingClientRect()
  const canvas = document.querySelector('[data-pixel-burst]') as any
  if (canvas?.__burst) canvas.__burst(rect.left + rect.width / 2, rect.top + rect.height / 2)
}

/* ─── Panel helpers ────────────────────────────────────────────────── */
const chipSt = (color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center',
  fontSize: 9, fontFamily: 'JetBrains Mono, monospace',
  padding: '2px 8px', borderRadius: 20, letterSpacing: 1,
  border: `1px solid ${color}40`, color, background: 'transparent', whiteSpace: 'nowrap',
})

function gradeCol(g?: string|null) {
  if (g==='A') return '#0EA66E'; if (g==='B') return '#F59E0B'
  if (g==='C') return '#6B7280'; return '#FF4444'
}
function sigCol(s?: string|null) {
  if (!s) return 'var(--text-mute)'
  if (s.includes('BULL')||s==='Multibagger'||s==='Strong Compounder'||s==='Momentum Leader') return '#0EA66E'
  if (s==='NEUTRAL') return '#6B7280'
  if (s.includes('WEAK')||s==='Under Watch') return '#F59E0B'
  if (s.includes('BEAR')||s==='Laggard') return '#FF4444'
  return 'var(--text-mute)'
}
function actionCol(a?: string|null) {
  if (a==='BUY') return '#0EA66E'; if (a==='HOLD') return '#F59E0B'; return '#FF4444'
}

function generateSWOT(n: Node) {
  const s: string[] = [], w: string[] = [], o: string[] = [], t: string[] = []
  if (n.pnl_pct > 50)              s.push(`+${n.pnl_pct.toFixed(0)}% gain`)
  if (n.grade === 'A')             s.push('Grade A quality')
  if (n.above_200dma)              s.push('Above 200 DMA')
  if (n.pe && n.pe < 15)           s.push(`Low PE ${n.pe.toFixed(0)}`)
  if (n.pnl_pct < -15)             w.push(`${n.pnl_pct.toFixed(0)}% underwater`)
  if (n.rsi && n.rsi > 75)         w.push(`Overbought RSI ${n.rsi.toFixed(0)}`)
  if (n.above_200dma === false)    w.push('Below 200 DMA')
  if (n.grade === 'D')             w.push('Grade D')
  if (n.rsi && n.rsi < 35)         o.push(`Oversold RSI ${n.rsi.toFixed(0)}`)
  if (n.action === 'BUY')          o.push('Scorecard: BUY')
  if (n.pnl_pct < 0 && n.above_200dma) o.push('Dip in uptrend')
  if (n.rsi && n.rsi > 70)         t.push('Pullback risk')
  if (n.above_50dma === false)     t.push('Below 50 DMA')
  if (n.pnl_pct < -25)             t.push('Deep loss — review')
  return { s: s.slice(0,2), w: w.slice(0,2), o: o.slice(0,2), t: t.slice(0,2) }
}

interface PanelProps {
  node: Node; getConv:(n:Node)=>number; setConv:(id:string,v:number)=>void; onClose:()=>void
}

function IntelligencePanel({ node, getConv, setConv, onClose }: PanelProps) {
  const [notes,           setNotes]           = useState({ story:'', purchase_reason:'', conviction_level:0 })
  const [storyOpen,       setStoryOpen]       = useState(false)
  const [analysis,        setAnalysis]        = useState<string|null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError,   setAnalysisError]   = useState<string|null>(null)
  const [savePending,     setSavePending]     = useState(false)

  /* Tab refs — zero useState for tab switching */
  const activeTabRef    = useRef<'fund'|'tech'|'overall'>('fund')
  const fundBtnRef      = useRef<HTMLButtonElement>(null)
  const techBtnRef      = useRef<HTMLButtonElement>(null)
  const overallBtnRef   = useRef<HTMLButtonElement>(null)
  const fundContentRef  = useRef<HTMLDivElement>(null)
  const techContentRef  = useRef<HTMLDivElement>(null)
  const overallContentRef = useRef<HTMLDivElement>(null)

  const switchTab = useCallback((tab: 'fund'|'tech'|'overall') => {
    activeTabRef.current = tab
    const tabs    = ['fund','tech','overall'] as const
    const btnRefs = [fundBtnRef, techBtnRef, overallBtnRef]
    const contentRefs = [fundContentRef, techContentRef, overallContentRef]
    tabs.forEach((t, i) => {
      const btn     = btnRefs[i].current
      const content = contentRefs[i].current
      const isActive = t === tab
      if (btn) {
        btn.style.background  = isActive ? 'rgba(45,212,191,0.12)' : 'transparent'
        btn.style.color       = isActive ? 'var(--accent)' : 'var(--text-dim)'
        btn.style.boxShadow   = isActive ? 'var(--neu-inset)' : 'none'
      }
      if (content) content.style.display = isActive ? 'block' : 'none'
    })
  }, [])

  useEffect(() => {
    switchTab('fund')
    setNotes({ story:'', purchase_reason:'', conviction_level:0 })
    setAnalysis(null); setAnalysisError(null); setStoryOpen(false)
    apiFetch(`/api/v1/stocks/${node.symbol}/notes?account_id=${node.account_id}`)
      .then(r=>r.json())
      .then(d=>setNotes({ story:d.story||'', purchase_reason:d.purchase_reason||'', conviction_level:d.conviction_level||0 }))
      .catch(()=>{})
  }, [node.symbol, node.account_id, switchTab])

  const runAnalysis = async () => {
    setAnalysisLoading(true); setAnalysisError(null)
    try {
      const res = await apiFetch(`/api/v1/stocks/${node.symbol}/analyse`, {
        method:'POST',
        body: JSON.stringify({ account_id:node.account_id, story:notes.story, purchase_reason:notes.purchase_reason,
          conviction_level:notes.conviction_level, sector:node.sector, avg_price:node.avg_price,
          ltp:node.ltp, pnl:node.pnl, pnl_pct:node.pnl_pct, grade:node.grade, signal:node.signal, pe:node.pe }),
      })
      const d = await res.json()
      if (d.error) setAnalysisError(d.error); else setAnalysis(d.analysis)
    } catch { setAnalysisError('Failed') }
    finally  { setAnalysisLoading(false) }
  }

  const saveStory = async () => {
    setSavePending(true)
    try { await apiFetch(`/api/v1/stocks/${node.symbol}/notes`, { method:'PUT', body:JSON.stringify({ account_id:node.account_id, ...notes }) }) }
    catch {}
    finally { setSavePending(false) }
  }

  const swot = generateSWOT(node)

  /* ── Inner helpers (defined inside for access to node/theme) ── */
  const SectionHeader = ({ label }: { label: string }) => (
    <div style={{ fontSize:9, color:'var(--text-dim)', fontFamily:'var(--font-mono)', letterSpacing:2,
      textTransform:'uppercase', marginBottom:8, marginTop:4 }}>
      {label}
    </div>
  )

  const StatCell = ({ label, value }: { label: string; value: string }) => (
    <div style={{ background:'var(--bg)', borderRadius:8, padding:'8px 10px', boxShadow:'var(--neu-inset)' }}>
      <div style={{ fontSize:8, color:'var(--text-mute)', fontFamily:'var(--font-mono)', letterSpacing:1, textTransform:'uppercase' }}>{label}</div>
      <div style={{ fontSize:12, color:'var(--text)', fontWeight:700, fontFamily:'var(--font-mono)', marginTop:2 }}>{value}</div>
    </div>
  )

  const ScoreBar = ({ label, score }: { label: string; score: number }) => (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:9, color:'var(--text-dim)', fontFamily:'var(--font-mono)', letterSpacing:1 }}>{label}</span>
        <span style={{ fontSize:11, color:'var(--accent)', fontFamily:'var(--font-mono)', fontWeight:700 }}>{score}</span>
      </div>
      <div style={{ height:4, background:'var(--bg)', borderRadius:4, overflow:'hidden', boxShadow:'var(--neu-inset)' }}>
        <div style={{
          height:'100%', width:`${Math.min(100, Math.max(0, score))}%`,
          background:`linear-gradient(90deg, var(--accent), ${score>75 ? '#0EA66E' : '#F59E0B'})`,
          borderRadius:4, transition:'width 0.6s ease',
        }} />
      </div>
    </div>
  )

  /* Grade description */
  const gradeDesc = (g: string|null) => {
    if (g==='A') return 'Strong fundamentals — high quality stock'
    if (g==='B') return 'Good fundamentals — solid holding'
    if (g==='C') return 'Average — monitor closely'
    if (g==='D') return 'Weak — consider reviewing position'
    return 'No grade available'
  }

  /* RSI interpretation */
  const rsiLabel = (r: number) => r < 30 ? 'Oversold' : r > 70 ? 'Overbought' : 'Neutral'
  const rsiColor = (r: number) => r < 30 ? C.green : r > 70 ? C.red : C.amber

  /* Overall score = average of fund + tech if no explicit value */
  const overallScore = Math.round((node.overall_score > 0
    ? node.overall_score
    : (node.fundamental_score + node.technical_score) / 2))

  return (
    <div style={{
      width:360, height:'100%', background:'var(--bg)', borderRadius:14,
      display:'flex', flexDirection:'column', overflow:'hidden',
      boxShadow:`-4px 0 16px rgba(0,0,0,0.12), var(--neu-raised)`,
    }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>

        {/* Symbol row */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800, color:'var(--accent)' }}>
              {node.symbol}
            </span>
            {node.is_crown && <span style={{ fontSize:14 }}>👑</span>}
          </div>
          <button onClick={onClose} style={{
            background:'var(--bg)', color:'var(--text-dim)', border:'none', borderRadius:6,
            width:26, height:26, cursor:'pointer', fontSize:14,
            display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'var(--neu-raised-sm)',
          }}>×</button>
        </div>

        {/* Meta row */}
        <div style={{ fontSize:10, color:'var(--text-mute)', fontFamily:'var(--font-mono)', marginBottom:10 }}>
          {[node.sector, node.market_cap, node.account].filter(Boolean).join(' · ')}
        </div>

        {/* P&L hero */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10, flexWrap:'wrap' }}>
          <span style={{ fontSize:18, fontWeight:700, fontFamily:'var(--font-mono)', color: node.pnl_pct>=0 ? C.green : C.red }}>
            {node.pnl_pct>=0?'+':''}{node.pnl_pct.toFixed(2)}%
          </span>
          <span style={{ fontSize:13, fontWeight:600, fontFamily:'var(--font-mono)', color: node.pnl>=0 ? C.green : C.red }}>
            {fmtL(node.pnl)}
          </span>
          {node.grade && (
            <span style={{ fontSize:9, fontFamily:'var(--font-mono)', padding:'2px 7px', borderRadius:12,
              border:`1px solid ${gradeCol(node.grade)}40`, color:gradeCol(node.grade), letterSpacing:1 }}>
              {node.grade}
            </span>
          )}
          {node.action && (
            <span style={{ fontSize:9, fontFamily:'var(--font-mono)', padding:'2px 7px', borderRadius:12,
              border:`1px solid ${actionCol(node.action)}40`, color:actionCol(node.action), letterSpacing:1 }}>
              {node.action}
            </span>
          )}
        </div>

        {/* Mini-stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
          {[
            { label:'LTP', value:`₹${node.ltp.toLocaleString('en-IN')}` },
            { label:'AVG', value:`₹${node.avg_price.toLocaleString('en-IN')}` },
            { label:'WT%', value:`${node.weight.toFixed(1)}%` },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--bg-surface)', borderRadius:6, padding:'6px 8px', boxShadow:'var(--neu-inset)' }}>
              <div style={{ fontSize:8, color:'var(--text-mute)', fontFamily:'var(--font-mono)', letterSpacing:1 }}>{s.label}</div>
              <div style={{ fontSize:11, color:'var(--text)', fontWeight:700, fontFamily:'var(--font-mono)', marginTop:2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ TAB BAR ═══ */}
      <div style={{ display:'flex', padding:'8px 12px', gap:6, borderBottom:'1px solid var(--border)', background:'var(--bg-surface)', flexShrink:0 }}>
        {([
          { id:'fund',    label:'Fund',    icon: chartIcon3d  },
          { id:'tech',    label:'Tech',    icon: techIcon3d   },
          { id:'overall', label:'Overall', icon: targetIcon3d },
        ] as const).map(({ id, label, icon }, i) => {
          const btnRef = [fundBtnRef, techBtnRef, overallBtnRef][i]
          return (
            <button
              key={id}
              ref={btnRef}
              onClick={() => switchTab(id)}
              style={{
                flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:4,
                padding:'6px 4px', borderRadius:8, border:'none', cursor:'pointer',
                fontSize:10, fontFamily:'var(--font-mono)', letterSpacing:1,
                background: id === 'fund' ? 'rgba(45,212,191,0.12)' : 'transparent',
                color: id === 'fund' ? 'var(--accent)' : 'var(--text-dim)',
                boxShadow: id === 'fund' ? 'var(--neu-inset)' : 'none',
                transition:'all 0.15s',
              }}
            >
              <img src={icon} width={15} height={15} style={{ objectFit:'contain', mixBlendMode:'screen', borderRadius:4, flexShrink:0 }} alt="" />
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      <div style={{ flex:1, overflowY:'auto', minHeight:0 }}>

        {/* ─── TAB 1: FUNDAMENTAL ─── */}
        <div ref={fundContentRef} style={{ display:'block', padding:'12px 16px' }}>

          <SectionHeader label="Valuation" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
            <StatCell label="PE Ratio" value={node.pe ? node.pe.toFixed(1) : '—'} />
            <StatCell label="PB Ratio" value={node.pb ? node.pb.toFixed(1) : '—'} />
            <StatCell label="Market Cap" value={node.market_cap ?? '—'} />
            <StatCell label="Sector" value={node.sector ?? '—'} />
          </div>

          <SectionHeader label="Grade Intelligence" />
          <div style={{ background:'var(--bg)', borderRadius:10, padding:'10px 12px', boxShadow:'var(--neu-inset)', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              {node.grade && (
                <div style={{
                  width:40, height:40, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:20, fontWeight:800, fontFamily:'var(--font-display)',
                  color:gradeCol(node.grade),
                  background:`${gradeCol(node.grade)}12`,
                  boxShadow:`inset 0 0 0 1px ${gradeCol(node.grade)}30`,
                }}>
                  {node.grade}
                </div>
              )}
              {node.signal && (
                <span style={{ fontSize:9, fontFamily:'var(--font-mono)', padding:'3px 8px', borderRadius:12,
                  border:`1px solid ${sigCol(node.signal)}40`, color:sigCol(node.signal), letterSpacing:1 }}>
                  {node.signal.replace(/_/g,' ')}
                </span>
              )}
            </div>
            <div style={{ fontSize:10, color:'var(--text-dim)', fontFamily:'var(--font-mono)', lineHeight:1.5 }}>
              {gradeDesc(node.grade)}
            </div>
          </div>

          <SectionHeader label="Investment Story" />
          {notes.story && (
            <div style={{ fontSize:10, color:'var(--text-dim)', fontStyle:'italic', lineHeight:1.6,
              marginBottom:8, borderLeft:`2px solid rgba(45,212,191,0.3)`, paddingLeft:10 }}>
              {notes.story}
            </div>
          )}
          <button onClick={() => setStoryOpen(v => !v)}
            style={{ fontSize:9, color: notes.story ? 'var(--text-dim)' : 'var(--accent)',
              background:'var(--bg-surface)', border:'none', cursor:'pointer', letterSpacing:1,
              borderRadius:8, padding:'7px 10px', width:'100%', textAlign:'left', boxShadow:'var(--neu-inset)' }}>
            {storyOpen ? '▲ Collapse' : notes.story ? '▼ Edit story' : '+ Document why you bought this'}
          </button>
          {storyOpen && (
            <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:6 }}>
              <textarea value={notes.story} onChange={e => setNotes(n => ({...n, story: e.target.value}))}
                rows={4} placeholder="Why did you buy? What's your thesis?"
                style={{ background:'var(--bg-surface)', border:`1px solid var(--border)`, borderRadius:8,
                  padding:8, fontSize:10, color:'var(--text)', resize:'vertical', fontFamily:'var(--font-body)',
                  boxShadow:'var(--neu-inset)', outline:'none', width:'100%', boxSizing:'border-box' }} />
              <button onClick={saveStory} disabled={savePending}
                style={{ background:'var(--accent)', color:'var(--bg)', border:'none', borderRadius:8,
                  padding:'6px', fontSize:10, fontWeight:700, cursor:'pointer', letterSpacing:0.5 }}>
                {savePending ? 'Saving…' : 'Save Story'}
              </button>
            </div>
          )}
        </div>

        {/* ─── TAB 2: TECHNICAL ─── */}
        <div ref={techContentRef} style={{ display:'none', padding:'12px 16px' }}>

          <SectionHeader label="RSI" />
          {node.rsi != null ? (
            <div style={{ background:'var(--bg)', borderRadius:10, padding:'10px 12px', boxShadow:'var(--neu-inset)', marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <span style={{ fontSize:9, color:'var(--text-dim)', fontFamily:'var(--font-mono)', letterSpacing:1 }}>RSI {node.rsi.toFixed(1)}</span>
                <span style={{ fontSize:9, fontFamily:'var(--font-mono)', padding:'2px 8px', borderRadius:12,
                  border:`1px solid ${rsiColor(node.rsi)}40`, color:rsiColor(node.rsi) }}>
                  {rsiLabel(node.rsi)}
                </span>
              </div>
              <div style={{ height:6, background:'var(--bg-surface)', borderRadius:3, overflow:'hidden', boxShadow:'var(--neu-inset)' }}>
                <div style={{ height:'100%', width:`${node.rsi}%`,
                  background: node.rsi < 30 ? C.green : node.rsi > 70 ? C.red : C.amber,
                  borderRadius:3, transition:'width 0.6s ease' }} />
              </div>
              <div style={{ fontSize:9, color:'var(--text-mute)', fontFamily:'var(--font-mono)', marginTop:6 }}>
                RSI {node.rsi.toFixed(0)} — {rsiLabel(node.rsi)}
              </div>
            </div>
          ) : (
            <div style={{ fontSize:10, color:'var(--text-mute)', marginBottom:14 }}>RSI data unavailable</div>
          )}

          <SectionHeader label="Moving Averages" />
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
            {node.above_50dma != null ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--bg)', borderRadius:8,
                padding:'8px 12px', boxShadow:'var(--neu-inset)' }}>
                <span style={{ fontSize:14 }}>{node.above_50dma ? '↑' : '↓'}</span>
                <span style={{ fontSize:10, color: node.above_50dma ? C.green : C.red,
                  fontFamily:'var(--font-mono)', fontWeight:700 }}>
                  {node.above_50dma ? 'Above' : 'Below'} 50 DMA
                </span>
              </div>
            ) : null}
            {node.above_200dma != null ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--bg)', borderRadius:8,
                padding:'8px 12px', boxShadow:'var(--neu-inset)' }}>
                <span style={{ fontSize:14 }}>{node.above_200dma ? '↑' : '↓'}</span>
                <span style={{ fontSize:10, color: node.above_200dma ? C.green : C.red,
                  fontFamily:'var(--font-mono)', fontWeight:700 }}>
                  {node.above_200dma ? 'Above' : 'Below'} 200 DMA
                </span>
              </div>
            ) : null}
            {node.above_50dma == null && node.above_200dma == null && (
              <div style={{ fontSize:10, color:'var(--text-mute)', fontFamily:'var(--font-mono)' }}>Data unavailable</div>
            )}
          </div>

          <SectionHeader label="Signal" />
          {node.signal ? (
            <div style={{ marginBottom:14 }}>
              <span style={{ display:'block', textAlign:'center', fontSize:10, fontFamily:'var(--font-mono)',
                padding:'8px', borderRadius:10, border:`1px solid ${sigCol(node.signal)}40`,
                color:sigCol(node.signal), background:`${sigCol(node.signal)}08`, letterSpacing:1 }}>
                {node.signal.replace(/_/g,' ')}
              </span>
            </div>
          ) : (
            <div style={{ fontSize:10, color:'var(--text-mute)', marginBottom:14 }}>No signal</div>
          )}

          <SectionHeader label="Action" />
          {node.action ? (
            <div style={{ marginBottom:14 }}>
              <div style={{ textAlign:'center', fontSize:13, fontWeight:800, fontFamily:'var(--font-display)',
                padding:'10px', borderRadius:10, letterSpacing:2,
                color: actionCol(node.action),
                background: node.action==='BUY' ? 'rgba(14,166,110,0.12)' : node.action==='HOLD' ? 'rgba(245,158,11,0.12)' : 'rgba(255,68,68,0.12)',
                border:`1px solid ${actionCol(node.action)}30`,
                boxShadow:'var(--neu-inset)',
              }}>
                {node.action}
              </div>
            </div>
          ) : (
            <div style={{ fontSize:10, color:'var(--text-mute)', marginBottom:14 }}>No action signal</div>
          )}
        </div>

        {/* ─── TAB 3: OVERALL ─── */}
        <div ref={overallContentRef} style={{ display:'none', padding:'12px 16px' }}>

          <SectionHeader label="Scores" />
          <div style={{ marginBottom:14 }}>
            <ScoreBar label="FUNDAMENTAL" score={node.fundamental_score} />
            <ScoreBar label="TECHNICAL"   score={node.technical_score} />
            <ScoreBar label="OVERALL"     score={overallScore} />
          </div>

          <SectionHeader label="Conviction" />
          <div style={{ display:'flex', gap:6, marginBottom:14 }}>
            {[1,2,3,4,5].map(v => (
              <button key={v} onClick={() => setConv(node.id, v)}
                style={{ width:32, height:32, borderRadius:'50%', border:'none', background:'var(--bg)', cursor:'pointer',
                  fontSize:11, fontWeight:700,
                  color: getConv(node)>=v ? 'var(--accent)' : 'var(--text-mute)',
                  boxShadow: getConv(node)>=v ? 'var(--neu-inset)' : 'var(--neu-raised-sm)',
                  transition:'all 0.15s' }}>
                {v}
              </button>
            ))}
          </div>

          <SectionHeader label="SWOT" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:14 }}>
            {([
              { key:'s', label:'S — Strength',    color:C.green,   bg:'rgba(14,166,110,0.08)',        items:swot.s },
              { key:'w', label:'W — Weakness',    color:C.red,     bg:'rgba(255,68,68,0.08)',          items:swot.w },
              { key:'o', label:'O — Opportunity', color:C.accent,  bg:'rgba(45,212,191,0.08)',         items:swot.o },
              { key:'t', label:'T — Threat',      color:C.amber,   bg:'rgba(245,158,11,0.08)',         items:swot.t },
            ] as const).map(q => (
              <div key={q.key} style={{ background:q.bg, borderRadius:8, padding:'8px 10px',
                border:`1px solid ${q.color}20` }}>
                <div style={{ fontSize:8, fontWeight:700, color:q.color, marginBottom:4, letterSpacing:0.5 }}>{q.label}</div>
                {q.items.length
                  ? q.items.map((it, i) => <div key={i} style={{ fontSize:10, color:'var(--text-dim)', lineHeight:1.5 }}>· {it}</div>)
                  : <div style={{ fontSize:9, color:'var(--text-mute)' }}>—</div>}
              </div>
            ))}
          </div>

          <SectionHeader label="AI Analysis" />
          <div style={{ paddingBottom:8 }}>
            {analysis ? (
              <div style={{ fontSize:10, color:'var(--text-dim)', lineHeight:1.6,
                background:'var(--bg-surface)', borderRadius:8, padding:10, boxShadow:'var(--neu-inset)' }}>
                {analysis}
              </div>
            ) : analysisError ? (
              <div style={{ fontSize:10, color:C.red }}>{analysisError}</div>
            ) : (
              <button onClick={runAnalysis} disabled={analysisLoading}
                style={{ background:'var(--bg)', color:'var(--accent)',
                  border:`1px solid rgba(45,212,191,0.2)`, borderRadius:8,
                  padding:'8px 14px', fontSize:10, fontWeight:600,
                  cursor: analysisLoading ? 'wait' : 'pointer',
                  boxShadow:'var(--neu-raised-sm)', letterSpacing:0.5, width:'100%' }}>
                {analysisLoading ? '⏳ Analysing…' : '✦ Analyse with AI'}
              </button>
            )}
          </div>
        </div>

      </div>{/* end tab content wrapper */}
    </div>
  )
}

/* ─── Page ────────────────────────────────────────────────────────────── */
export default function InvexV2Page() {
  useAuth()

  const [nodes,      setNodes]    = useState<Node[]>([])
  const [loading,    setLoading]  = useState(true)
  const [modeIdx,    setModeIdx]  = useState(0)
  const [filter,     setFilter]   = useState('All')
  const [selected,   setSelected] = useState<Node|null>(null)
  const [convMap,    setConvMap]  = useState<Map<string,number>>(new Map())
  const [kpi,        setKpi]      = useState({ pnl_pct:0, day_pnl:0, count:0, equity:0 })
  const [canvasDims, setCanvasDims] = useState({ w: 860, h: 520 })

  const nodesRef      = useRef<HTMLDivElement>(null)
  const canvasRef     = useRef<HTMLDivElement>(null)
  const glowRef       = useRef<HTMLDivElement>(null)
  const tickerRef     = useRef<HTMLDivElement>(null)
  const tickerIdxRef  = useRef(0)
  const transformRef  = useRef<HTMLDivElement>(null)
  const zoomRef       = useRef(1)
  const panRef        = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const lastMouseRef  = useRef({ x: 0, y: 0 })

  /* ── canvas ResizeObserver ── */
  useEffect(() => {
    if (!canvasRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setCanvasDims({ w: e.contentRect.width, h: e.contentRect.height })
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

        const stripSym = (sym: string) => (sym || '').replace(/-(EQ|BE)$/, '').trim()
        const eMap  = new Map(enriched.map((e:any)=>[`${stripSym(e.symbol)}|${e.account_id}`, e]))
        const tMap  = new Map(techs.map((t:any)=>[`${stripSym(t.symbol)}|${t.account_id}`, t]))
        const scMap = new Map(scores.map((s:any)=>[`${stripSym(s.symbol)}|${s.account_id}`, s]))

        const raw: Node[] = holdings.map((h:any, index:number) => {
          const key  = `${stripSym(h.symbol)}|${h.account_id}`
          const e    = eMap.get(key) ?? {}
          const t    = tMap.get(key) ?? {}
          const sc   = scMap.get(key) ?? {}
          const rsi  = t.rsi ?? 50
          const sectorKey  = h.market_cap ?? e.market_cap ?? null
          const sectorRisk = sectorKey ? (SECTOR_RISK[sectorKey] ?? 0.5) : 0.5
          const absPnl     = Math.abs(h.pnl_pct ?? 0)
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
            pe:                e.pe ?? 25,
            pb:                e.pb ?? null,
            fundamental_score: e.fundamental_score ?? 50,
            technical_score:   t.technical_score   ?? 50,
            risk_score:        sectorRisk * 0.5 + (absPnl / 300 * 0.3) + (index * 0.02 * 0.2),
            volatility_proxy,
            conviction_level:  3,
            is_crown:          false,
            market_cap:        h.market_cap ?? e.market_cap ?? null,
            rsi,
            action:            e.action ?? null,
            above_50dma:       t.above_50dma ?? null,
            above_200dma:      t.above_200dma ?? null,
            overall_score:     (h as any).overall_score ?? gradeToScore(sc.grade ?? e.grade ?? null),
          }
        })

        const sorted = [...raw].sort((a,b)=>b.pnl_pct - a.pnl_pct)
        const crownIds = new Set(sorted.filter(n=>n.pnl_pct>50).slice(0,3).map(n=>n.id))
        raw.forEach(n=>{ n.is_crown = crownIds.has(n.id) })

        setNodes(raw)
        setKpi({
          pnl_pct: sum.total_pnl_pct ?? 0,
          day_pnl: sum.day_pnl ?? 0,
          count:   raw.length,
          equity:  sum.equity_value ?? totalValue,
        })
      } catch(err) {
        console.error('InvexV2 fetch error', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  /* ── insights (ticker) ── */
  const insights = useMemo(() => {
    if (!nodes.length) return ['Loading portfolio data…']
    const top3w   = nodes.slice().sort((a,b)=>b.current_value-a.current_value).slice(0,3).map(n=>n.symbol)
    const top3pct = (nodes.filter(n=>top3w.includes(n.symbol)).reduce((a,n)=>a+n.weight,0)).toFixed(1)
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
        gsap.to(tickerRef.current, { y:-10, opacity:0, duration:0.2, onComplete:() => {
          if (tickerRef.current) {
            tickerRef.current.textContent = '◆ ' + insights[tickerIdxRef.current]
            gsap.fromTo(tickerRef.current, { y:10, opacity:0 }, { y:0, opacity:1, duration:0.3 })
          }
        }})
      }
    }, 4000)
    return () => clearInterval(t)
  }, [insights])

  /* ── filtered nodes ── */
  const filtered = useMemo(()=>{
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
  const mode   = MODES[modeIdx]
  const getVal = useCallback((n:Node, key:string):number =>
    (n as unknown as Record<string,number>)[key] ?? 0
  , [])

  const { xSc, ySc, szSc, positions } = useMemo(()=>{
    const xs = filtered.map(n=>getVal(n, mode.x.key))
    const ys = filtered.map(n=>getVal(n, mode.y.key))
    const xMin = d3.min(xs) ?? 0, xMax = d3.max(xs) ?? 1
    const yMin = d3.min(ys) ?? 0, yMax = d3.max(ys) ?? 1
    const xPad = Math.abs(xMax-xMin)*0.1 || 1
    const yPad = Math.abs(yMax-yMin)*0.1 || 1
    const w = canvasDims.w || 860, h = canvasDims.h || 520
    const xSc  = d3.scaleLinear().domain([xMin-xPad, xMax+xPad]).range([w*0.10, w*0.90])
    const ySc  = d3.scaleLinear().domain([yMin-yPad, yMax+yPad]).range([h*0.90, h*0.10])
    const szSc = d3.scaleSqrt().domain([0, d3.max(filtered.map(n=>n.current_value)) ?? 1]).range([14,52])

    /* Symbol-hash jitter — stable per symbol, no randomness on re-render */
    const pcts = filtered.map(n => {
      const sh = symHash(n.symbol)
      return {
        x: Math.max(5, Math.min(95, xSc(getVal(n, mode.x.key)) / w * 100 + ((sh%17)-8)*0.5)),
        y: Math.max(5, Math.min(95, ySc(getVal(n, mode.y.key)) / h * 100 + ((sh%13)-6)*0.5)),
      }
    })

    /* Iterative collision separation (3 passes) */
    const MIN = 8
    for (let p=0; p<3; p++) {
      pcts.forEach((a,i) => pcts.forEach((b,j) => {
        if (i===j) return
        const dx=a.x-b.x, dy=a.y-b.y, dist=Math.sqrt(dx*dx+dy*dy)
        if (dist < MIN && dist > 0) {
          const push=(MIN-dist)/2
          a.x+=(dx/dist)*push*0.5; a.y+=(dy/dist)*push*0.5
          b.x-=(dx/dist)*push*0.5; b.y-=(dy/dist)*push*0.5
        }
      }))
    }

    const positions = new Map(filtered.map((n,i)=>[n.id, { x:pcts[i].x*w/100, y:pcts[i].y*h/100 }]))
    return { xSc, ySc, szSc, positions }
  }, [filtered, mode, getVal, canvasDims])

  /* ── GSAP entrance ── */
  useGSAP(() => {
    if (!canvasRef.current) return
    const els = canvasRef.current.querySelectorAll('.matrix-node')
    if (!els.length) return
    gsap.fromTo(els,
      { scale:0, opacity:0 },
      { scale:1, opacity:1, duration:0.5, stagger:{ amount:0.4, from:'random' }, ease:'back.out(2)' }
    )
  }, { scope: canvasRef, dependencies: [filtered.length, modeIdx, filter] })

  /* ── conviction ── */
  const getConv = (n:Node) => convMap.get(n.id) ?? n.conviction_level
  const setConv = (id:string, v:number) => setConvMap(m=>new Map(m).set(id,v))

  /* ── zoom / pan (all DOM-direct, zero setState) ── */
  const applyTransform = useCallback(() => {
    if (transformRef.current) {
      transformRef.current.style.transform =
        `translate(${panRef.current.x}px,${panRef.current.y}px) scale(${zoomRef.current})`
    }
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.85 : 1.15
    zoomRef.current = Math.max(0.75, Math.min(4, zoomRef.current * delta))
    applyTransform()
  }, [applyTransform])

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.matrix-node')) return
    isDraggingRef.current = true
    lastMouseRef.current = { x: e.clientX, y: e.clientY }
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
  }, [])

  const handleCanvasMouseUp = useCallback(() => {
    isDraggingRef.current = false
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
  }, [])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.matrix-node')) return
    zoomRef.current = 1
    panRef.current = { x: 0, y: 0 }
    if (transformRef.current) {
      gsap.to(transformRef.current, { x: 0, y: 0, scale: 1, duration: 0.4, ease: 'power2.inOut' })
    }
  }, [])

  /* ── mouse glow + pan (GSAP only, zero setState) ── */
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - lastMouseRef.current.x
      const dy = e.clientY - lastMouseRef.current.y
      panRef.current.x += dx
      panRef.current.y += dy
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
      applyTransform()
    }
    if (!canvasRef.current || !glowRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    gsap.to(glowRef.current, {
      x: e.clientX - rect.left, y: e.clientY - rect.top,
      duration: 0.5, ease: 'power2.out', overwrite: 'auto',
    })
  }, [applyTransform])

  const pnlColor = (v:number) => v>=0 ? C.green : C.red

  return (
    <>
    <style>{`
      @keyframes crownPulse {
        0%,100% { box-shadow: var(--neu-raised-sm), 0 0 8px #F59E0B20; }
        50%      { box-shadow: var(--neu-raised-sm), 0 0 24px #F59E0B60, 0 0 48px #F59E0B20; }
      }
      @keyframes sparkleFloat {
        0%,100% { transform: translateY(0) scale(1); }
        50%      { transform: translateY(-4px) scale(1.4); }
      }
      .matrix-node { transition: box-shadow 0.25s ease, transform 0.2s ease, filter 0.2s ease; }
      .matrix-node:not([data-selected="true"]):hover {
        transform: translate(-50%,-50%) scale(1.08) !important;
        filter: brightness(1.25) saturate(1.3);
        z-index: 10 !important;
      }
      .matrix-node[data-selected="true"] {
        transform: translate(-50%,-50%) scale(1.12) !important;
        z-index: 20 !important;
      }
    `}</style>

    {/* Pixel burst canvas — DOM-driven, no React state */}
    <PixelBurst color="#2dd4bf" />

    {/* ── Page container — fills Layout's <main> ── */}
    <div style={{
      flex: 1, display:'flex', flexDirection:'column', overflow:'hidden',
      background: 'var(--bg)',
      fontFamily: 'var(--font-mono)', color: 'var(--text)',
      position: 'relative', minHeight: 0,
    }}>

      {/* Sparkles — contained within page area */}
      <SparkleLayer />

      {/* Subtle ambient teal glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 70% 50% at 15% 25%, rgba(45,212,191,0.05) 0%, transparent 55%), radial-gradient(ellipse 55% 45% at 85% 75%, rgba(45,212,191,0.03) 0%, transparent 55%)',
      }} />

      {/* KPI STRIP */}
      <div style={{
        padding: '16px 0 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10, position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label:'Portfolio P&L', value:`${kpi.pnl_pct>=0?'+':''}${kpi.pnl_pct.toFixed(2)}%`, color:pnlColor(kpi.pnl_pct) },
            { label:'Day P&L',       value:fmtL(kpi.day_pnl),                                      color:pnlColor(kpi.day_pnl) },
            { label:'Holdings',      value:`${kpi.count}`,                                          color:'var(--text)' },
            { label:'Equity',        value:fmtL(kpi.equity),                                        color:'var(--text)' },
          ].map(k=>(
            <div key={k.label} style={{
              background: 'var(--bg)', borderRadius: 10, padding: '6px 14px',
              display: 'flex', flexDirection: 'column', gap: 2, boxShadow: 'var(--neu-raised-sm)',
            }}>
              <span style={{ fontSize:9, color:'var(--text-dim)', letterSpacing:1 }}>{k.label}</span>
              <span style={{ fontSize:13, color:k.color, fontWeight:600 }}>{k.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* TICKER */}
      <div style={{
        margin: '10px 0 0', height: 30,
        background: 'rgba(45,212,191,0.04)',
        boxShadow: `inset 0 1px 0 rgba(45,212,191,0.08), inset 0 -1px 0 rgba(45,212,191,0.08)`,
        borderLeft: `3px solid rgba(45,212,191,0.5)`,
        borderRadius: '0 6px 6px 0',
        display: 'flex', alignItems: 'center', paddingLeft: 12, overflow: 'hidden',
        position: 'relative', zIndex: 1,
      }}>
        <div ref={tickerRef} style={{ fontSize:10, color:'var(--text-dim)', letterSpacing:0.5 }}>
          ◆ Loading portfolio data…
        </div>
      </div>

      {/* MODE SWITCHER */}
      <div style={{ display:'flex', gap:6, paddingTop:10, position:'relative', zIndex:1 }}>
        {MODES.map((m,i)=>(
          <button key={m.id} onClick={()=>setModeIdx(i)}
            style={{
              background: 'var(--bg)',
              color: i===modeIdx ? 'var(--accent)' : 'var(--text-dim)',
              border: i===modeIdx ? `1px solid rgba(45,212,191,0.2)` : '1px solid transparent',
              borderRadius: 20, padding: '5px 13px',
              fontSize: 10, cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: 0.5,
              transition: 'all 0.2s',
              boxShadow: i===modeIdx
                ? `var(--neu-inset), 0 0 10px rgba(45,212,191,0.12)`
                : 'var(--neu-raised-sm)',
            }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* FILTER BAR */}
      <div style={{ display:'flex', gap:6, paddingTop:8, flexWrap:'wrap', position:'relative', zIndex:1 }}>
        {FILTERS.map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{
              background: 'var(--bg)',
              border: f===filter ? `1px solid rgba(45,212,191,0.18)` : '1px solid transparent',
              color: f===filter ? 'var(--accent)' : 'var(--text-dim)',
              borderRadius: 14, padding: '4px 11px', fontSize: 10,
              cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: 0.5,
              transition: 'all 0.2s',
              boxShadow: f===filter
                ? `var(--neu-inset), 0 0 8px rgba(45,212,191,0.10)`
                : 'var(--neu-raised-sm)',
            }}>
            {f}
          </button>
        ))}
      </div>

      {/* MAIN ROW — canvas + detail panel (75% of remaining viewport) */}
      <div style={{ flex:'0 0 auto', height:'calc((100vh - 260px) * 0.75)', display:'flex', gap:10, paddingTop:10, paddingBottom:14, overflow:'hidden', minHeight:0, position:'relative', zIndex:1 }}>

        {/* CANVAS */}
        <div ref={canvasRef}
          style={{
            flex:1, minWidth:0, position:'relative', minHeight:0, overflow:'hidden',
            background: 'var(--bg-surface)', borderRadius:14, cursor:'grab',
            boxShadow: 'var(--neu-inset)',
          }}
          onMouseMove={handleCanvasMouseMove}
          onMouseDown={handleCanvasMouseDown}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={()=>{ isDraggingRef.current=false; if(glowRef.current) gsap.to(glowRef.current,{opacity:0,duration:0.3}); if(canvasRef.current) canvasRef.current.style.cursor='grab' }}
          onMouseEnter={()=>glowRef.current && gsap.to(glowRef.current,{opacity:1,duration:0.3})}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
        >
          {/* Grid */}
          <div style={{
            position:'absolute', inset:0, pointerEvents:'none',
            backgroundImage:`linear-gradient(rgba(45,212,191,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(45,212,191,0.04) 1px,transparent 1px)`,
            backgroundSize:'96px 32px',
          }} />

          {/* Ambient glow */}
          <div style={{
            position:'absolute', inset:0, pointerEvents:'none',
            background:'radial-gradient(ellipse 60% 50% at 50% 50%,rgba(45,212,191,0.03) 0%,transparent 70%)',
          }} />

          {/* Mouse glow */}
          <div ref={glowRef} style={{
            position:'absolute', width:360, height:360, borderRadius:'50%',
            background:'radial-gradient(circle,rgba(45,212,191,0.07) 0%,transparent 70%)',
            transform:'translate(-50%,-50%)',
            pointerEvents:'none', left:0, top:0, opacity:0,
          }} />

          {/* Axis labels */}
          <span style={{ position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)', fontSize:9, color:'var(--text-mute)', letterSpacing:1 }}>{mode.x.label} →</span>
          <span style={{ position:'absolute', top:'50%', left:6, transform:'rotate(-90deg) translateX(50%)', fontSize:9, color:'var(--text-mute)', letterSpacing:1 }}>{mode.y.label} →</span>

          {/* Quadrant lines */}
          <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, borderLeft:`1px dashed rgba(45,212,191,0.12)` }} />
          <div style={{ position:'absolute', top:'50%', left:0, right:0, height:1, borderTop:`1px dashed rgba(45,212,191,0.12)` }} />

          {/* Quadrant labels */}
          {([
            { label:mode.q.tl, s:{ top:10, left:14 } },
            { label:mode.q.tr, s:{ top:10, right:14 } },
            { label:mode.q.bl, s:{ bottom:16, left:14 } },
            { label:mode.q.br, s:{ bottom:16, right:14 } },
          ] as const).map(ql=>(
            <span key={ql.label} style={{ position:'absolute', ...ql.s, fontSize:9, color:'rgba(45,212,191,0.14)', fontFamily:'var(--font-display)', fontWeight:600, letterSpacing:0.5, pointerEvents:'none' }}>{ql.label}</span>
          ))}

          {/* Loading */}
          {loading && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-mute)', fontSize:12 }}>
              Loading nodes…
            </div>
          )}

          {/* Zoom hint */}
          <div style={{ position:'absolute', bottom:8, right:12, fontSize:8, fontFamily:'var(--font-mono)', color:'rgba(45,212,191,0.22)', letterSpacing:1, pointerEvents:'none', userSelect:'none' }}>
            SCROLL ZOOM · DRAG PAN · DBL-CLICK RESET
          </div>

          {/* Nodes — inside transform wrapper for zoom/pan */}
          <div ref={transformRef} style={{ position:'absolute', inset:0, transformOrigin:'50% 50%' }}>
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
                  onMouseEnter={fireBurst}
                  onClick={()=>setSelected(s=>s?.id===n.id?null:n)}
                  style={{
                    position:'absolute',
                    left: positions.get(n.id)?.x ?? xSc(getVal(n, mode.x.key)),
                    top:  positions.get(n.id)?.y ?? ySc(getVal(n, mode.y.key)),
                    width:dia, height:dia, borderRadius:'50%',
                    transform:'translate(-50%,-50%) scale(1)',
                    cursor:'pointer',
                    zIndex:isSelected?20:1,
                    background:'transparent',
                    border:`1px solid ${glowColor}${isSelected?'50':'22'}`,
                    boxShadow: isSelected
                      ? `var(--neu-inset), 0 0 20px ${glowColor}50, 0 0 40px ${glowColor}20`
                      : `var(--neu-raised-sm), 0 0 6px ${glowColor}18`,
                    animation:n.is_crown?'crownPulse 2.5s ease-in-out infinite':'none',
                    display:'flex', flexDirection:'column',
                    alignItems:'center', justifyContent:'center',
                    padding:4, userSelect:'none', overflow:'hidden',
                  }}>
                  {/* Top-left highlight */}
                  <div style={{
                    position:'absolute', top:'12%', left:'18%',
                    width:'32%', height:'32%', borderRadius:'50%',
                    background:'radial-gradient(circle,rgba(255,255,255,0.10) 0%,transparent 70%)',
                    pointerEvents:'none',
                  }} />
                  <span style={{ fontSize:9, color:'var(--text)', fontFamily:'var(--font-mono)', fontWeight:700, textAlign:'center', lineHeight:1.1, pointerEvents:'none', textShadow:`0 0 8px ${glowColor}50`, position:'relative' }}>
                    {n.symbol.length>6?n.symbol.slice(0,5)+'…':n.symbol}
                  </span>
                  <span style={{ fontSize:8, pointerEvents:'none', color:n.pnl_pct>=0?'#34d399':'#FF4444', lineHeight:1.1, position:'relative' }}>
                    {n.pnl_pct>=0?'+':''}{n.pnl_pct.toFixed(1)}%
                  </span>
                </div>
              )
            })}
          </div>
          </div>{/* end transformRef */}
        </div>

        {/* DETAIL PANEL — width collapses to 0 when no node selected */}
        <AnimatePresence>
          {selected && (
            <motion.div key="panel"
              initial={{ width:0, opacity:0 }} animate={{ width:360, opacity:1 }} exit={{ width:0, opacity:0 }}
              transition={{ type:'spring', stiffness:300, damping:30 }}
              style={{
                overflow:'hidden', flexShrink:0, height:'100%',
              }}>
            <IntelligencePanel
              node={selected}
              getConv={getConv}
              setConv={setConv}
              onClose={()=>setSelected(null)}
            />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    </>
  )
}
