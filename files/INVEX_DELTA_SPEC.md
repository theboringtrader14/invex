# INVEX — Delta Design Spec
# Inherits 100% of STAAX design system. Only overrides listed here.
# Reference: STAAX_BRAND_REFERENCE.html + CLAUDE_CODE_PROMPT.md

---

## 1. Accent Colour Override (the only major delta)

Replace every `--ox-*` token with `--ix-*` in INVEX globals.css:

```css
:root {
  /* INVEX Teal Primary — replaces STAAX orange */
  --ix-vivid:   #00C9A7;   /* PRIMARY — headlines, CTAs, active states */
  --ix-glow:    #00B396;   /* subheadings, secondary CTAs */
  --ix-deep:    #007A67;   /* gradient partner (replaces --ox-ember) */
  --ix-ultra:   #5EECD8;   /* lightest tint — XIRR highlight, hover text */
  --ix-ember:   #009E84;   /* chart fills, dual-tone gradient */
  --ix-ghost:   rgba(0,201,167,0.10);
  --ix-border:  rgba(0,201,167,0.20);
  --ix-border-hi:rgba(0,201,167,0.45);

  /* Everything else ↓ is IDENTICAL to STAAX — do not redefine */
  /* --bg-void, --gs-*, --sem-*, --font-display, --font-mono, --r-*, --ease-* */
}
```

### Cloud fill — teal variant (replace in GlassCard.module.css for INVEX)
```css
.cloud::before {
  background:
    radial-gradient(ellipse 80% 60% at 12% 22%, rgba(0,201,167,0.15) 0%, transparent 56%),
    radial-gradient(ellipse 55% 70% at 80% 75%, rgba(0,154,132,0.12) 0%, transparent 52%),
    radial-gradient(ellipse 45% 50% at 55%  8%, rgba(0,179,150,0.08) 0%, transparent 48%),
    radial-gradient(ellipse 60% 35% at 90% 18%, rgba(0,122,103,0.10) 0%, transparent 50%);
}
```

### Gradient — teal dual-tone (replaces orange gradient on buttons/logo)
```css
/* btn-primary in INVEX */
background: linear-gradient(135deg, #00C9A7 0%, #007A67 100%);
box-shadow on hover: 0 0 22px rgba(0,201,167,0.40);

/* logo mark */
background: linear-gradient(135deg, #00C9A7, #007A67);
box-shadow: 0 0 16px rgba(0,201,167,0.30);
```

---

## 2. Logo Mark

```
STAAX: "S"  orange gradient  → trading terminal
INVEX: "IX" teal  gradient   → portfolio intelligence
```

Sidebar top logo mark: `IX` in Syne 800, white, on teal gradient rounded rect.

---

## 3. Sidebar — 5 items (vs STAAX 7)

```
Portfolio     /portfolio    (grid icon)
SIP Engine    /sips         (clock icon)
IPO Bot       /ipo          (trending-up icon)   [Phase 3]
Watchlist     /watchlist    (eye icon)            [Phase 4]
Analysis      /analysis     (bar-chart icon)      [Phase 4/5]
```

Active indicator bar: `--ix-vivid` teal, not orange.

---

## 4. TopBar — INVEX-specific changes

- Remove: Kill Switch, Stop All, Start Session (not applicable to INVEX)
- Keep: user welcome, IST clock, account selector
- Add: `INVEX BETA` pill (teal, replaces `PRACTIX` pill)
  ```css
  /* BETA pill — replaces broker badge */
  background: rgba(0,201,167,0.12);
  border: 0.5px solid rgba(0,201,167,0.20);
  color: #00C9A7;
  /* pulse dot: --ix-vivid */
  ```
- No broker/mode badge in INVEX topbar

---

## 5. New Components (INVEX-only, not in STAAX)

### 5a. HoldingsTable
Dense equity table. Columns: Stock | Qty | Avg Price | LTP | P&L | P&L% | Day Chg | Account

```tsx
// file: src/components/portfolio/HoldingsTable.tsx
// Reuses: data-table styles from globals.css
// Delta: 
//   - td.sym  → font-display 13px 700 color: --ix-glow
//   - td.num  → font-mono 11px
//   - positive values → --sem-long
//   - negative values → --sem-short
//   - account column → --ix-glow (teal name badge)
//   - hover row bg: rgba(0,201,167,0.03)   ← teal tint, not orange
```

### 5b. SipCard
Portfolio-style card for each SIP.

```tsx
// file: src/components/sips/SipCard.tsx
// Reuses: GlassCard cloud variant
// Structure:
//   header row: symbol name (--ix-glow 700) + status chip
//   sub: account · broker · frequency
//   data rows: Amount / Invested / Current / XIRR / Next execution
//   XIRR value: --ix-vivid (teal, not orange)
//   Status chips: chip-active uses --ix-vivid, chip-paused uses --sem-warn
```

### 5c. EquityCurve
Area chart showing portfolio value over time.

```tsx
// file: src/components/portfolio/EquityCurve.tsx
// Chart: recharts AreaChart
// Area fill: rgba(0,201,167,0.12) gradient
// Stroke: #00C9A7  stroke-width: 2
// Grid: rgba(255,255,255,0.04)
// Axis labels: font-mono 10px --gs-light
// Time range tabs: 1M / 3M / 1Y / All  (btn-steel + btn-ix active)
```

### 5d. SectorAllocation
Horizontal bar rows with teal progress fills.

```tsx
// file: src/components/portfolio/SectorAllocation.tsx
// Sector colours (teal scale, not orange):
//   Technology:      #00C9A7  (--ix-vivid)
//   Banking:         #007A67  (--ix-deep)
//   Energy:          #5EECD8  (--ix-ultra)
//   FMCG:            #009E84  (--ix-ember)
//   Others:          #5A5A61  (--gs-light)
// Bar fill: 4px height, border-radius 2px
// Percentage: font-mono 11px --ix-glow
```

### 5e. HeroMetricCard  (extends STAAX MetricCard)
Identical to STAAX MetricCard but:
- Sparkline stroke: `#00C9A7` (teal)
- Sparkline fill:  `rgba(0,201,167,0.07)`
- Value color default: `--ix-vivid`
- No change to `.metric-label`, `.metric-sub`, structure

---

## 6. Portfolio Page Layout

```
/portfolio

PageHeader: "Portfolio"  +  [Refresh] [Export] buttons
↓
5-column metric row: Total Portfolio | Total P&L | Day P&L | XIRR | Invested
↓
Tab row: [Equity] [Mutual Funds] [Equity Curve]
Account filter (right-aligned): [All] [Karthik] [Mom] [Wife]
↓
HoldingsTable (full width glass card)
↓
2-column: SectorAllocation | EquityCurve
```

---

## 7. SIP Page Layout (/sips)

```
PageHeader: "SIP Engine" + subtitle "Recurring investment scheduler" + [+ Add SIP]
↓
3-column metric row: Active SIPs | Monthly Commitment | Next Execution
↓
SipCard grid (3-col): one card per SIP + "Add New SIP" dashed add card
↓
Recent Executions table: Date | Stock | Account | Shares | Amount | Status
```

---

## 8. Status Chips — INVEX variants

All inherit STAAX Chip component. Add these variants to Chip.module.css:

```css
/* INVEX active — teal (replaces orange chip-active) */
.chip_ix_active {
  background: rgba(0,201,167,0.15);
  color: #00C9A7;
  border: 0.5px solid rgba(0,201,167,0.40);
}

/* SIP-specific: WATCHING (IPO Bot) */
.chip_watching {
  background: rgba(68,136,255,0.12);
  color: var(--sem-signal);
  border: 0.5px solid rgba(68,136,255,0.30);
}

/* SIP-specific: TRIGGERED */
.chip_triggered {
  background: rgba(0,201,167,0.15);
  color: #00C9A7;
  border: 0.5px solid rgba(0,201,167,0.35);
}

/* SIP-specific: EXITED (50% SL hit) */
.chip_exited {
  background: rgba(255,68,68,0.12);
  color: var(--sem-short);
  border: 0.5px solid rgba(255,68,68,0.30);
}
```

---

## 9. What Does NOT Change from STAAX

These are 100% shared — do not duplicate in INVEX codebase:

| Element | Reuse |
|---------|-------|
| `--bg-void`, `--gs-*` tokens | Identical |
| `--sem-long/short/signal/warn` | Identical |
| `--font-display`, `--font-mono` | Identical |
| `--r-*`, `--ease-*`, `--dur-*` | Identical |
| `GlassCard` component | Reuse, cloud fill override via CSS var |
| `Button` component | Reuse, override `--ox-*` → `--ix-*` |
| `Chip` component | Reuse, add ix variants above |
| `BgOrbs` | Reuse, orb colours update via CSS var |
| `Sidebar` structure | Reuse, different items + teal active |
| `TopBar` structure | Reuse, different right-side content |
| `MetricCard` | Reuse, override sparkline colour |
| `globals.css` base | Reuse, add `--ix-*` block on top |
| Page entry animations | Identical |
| Scrollbar, divider, table base | Identical |

---

## 10. Minimal File Delta for Claude Code

Only create these NEW files in INVEX frontend:

```
invex/frontend/src/
├── styles/
│   └── invex-tokens.css          ← ONLY --ix-* overrides (import after globals.css)
├── components/
│   ├── portfolio/
│   │   ├── HoldingsTable.tsx + .module.css
│   │   ├── MFTable.tsx + .module.css       (similar to HoldingsTable)
│   │   ├── EquityCurve.tsx + .module.css
│   │   └── SectorAllocation.tsx + .module.css
│   └── sips/
│       ├── SipCard.tsx + .module.css
│       └── AddSipModal.tsx + .module.css
└── app/
    ├── portfolio/page.tsx + page.module.css
    ├── sips/page.tsx + page.module.css
    └── ipo/page.tsx + page.module.css      (Phase 3 stub)
```

---

## 11. invex-tokens.css (the only CSS file to add)

```css
/* invex-tokens.css — import this AFTER globals.css in INVEX layout.tsx */
/* This single file is the entire INVEX delta for design tokens */

:root {
  --ix-vivid:    #00C9A7;
  --ix-glow:     #00B396;
  --ix-deep:     #007A67;
  --ix-ultra:    #5EECD8;
  --ix-ember:    #009E84;
  --ix-ghost:    rgba(0,201,167,0.10);
  --ix-border:   rgba(0,201,167,0.20);
  --ix-border-hi:rgba(0,201,167,0.45);

  /* Remap STAAX orange aliases to teal for shared components */
  --ox-radiant:  var(--ix-vivid);
  --ox-glow:     var(--ix-glow);
  --ox-ember:    var(--ix-deep);
  --ox-ultra:    var(--ix-ultra);
  --ox-border:   var(--ix-border);
  --ox-border-hi:var(--ix-border-hi);
  --ox-ghost:    var(--ix-ghost);
}
```

This single trick means ALL STAAX components (GlassCard, Button, Chip, MetricCard,
Sidebar, TopBar) automatically render in teal in INVEX — zero component code changes needed.

---
INVEX Design Delta v1.0 — inherits STAAX Design System v1.0
