# INVEX — Living Engineering Spec
**Version:** 1.3 | **Last Updated:** 15 March 2026 — Phase 1 complete — all 3 accounts live (Zerodha + Angel One Mom/Wife) | **PRD Reference:** v1.1

This document is the single engineering source of truth for INVEX. Read this at the start of every session — do not re-read transcripts for context.

---

## 0. North Star — Product Vision

INVEX is Karthikeyan's personal investment intelligence platform. It sits alongside STAAX in the broader financial OS and eventually feeds into FINEX (the master financial layer). Where STAAX manages active F&O trades, INVEX manages the long-term equity and MF portfolio, automates disciplined investing via SIPs, and hunts IPO listing opportunities using a systematic indicator.

### Module Position in Platform Family
```
BUDGEX ──────────────────────────────┐
STAAX  ──→ (P&L, trades, positions)  ├──→ FINEX ──→ Avatar (AI companion)
INVEX  ──→ (portfolio, SIPs, IPO)  ──┘
```

### Design Philosophy
- **Base:** Same design system as STAAX (CSS variables, DM Sans, dark/light mode toggle)
- **Accent:** Glassmorphism selectively on hero metric cards (total portfolio value, today gain, XIRR)
- **Tables and lists:** Sharp, high-density — same as STAAX
- **Identity:** Premium portfolio-app feel, distinct from STAAX trading terminal aesthetic
- **Future-ready:** Designed to merge cleanly into FINEX as a module

---

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + Python 3.12 |
| Database | PostgreSQL (asyncpg) + SQLAlchemy async |
| Cache | Redis (market data cache + session) |
| Frontend | React + Vite + TypeScript |
| Auth | Shared JWT with STAAX (same login, same token, same secret key) |
| Broker APIs | Zerodha KiteConnect (Karthik), Angel One SmartAPI (Mom, Wife) |
| MF Data | Zerodha Coin via KiteConnect (view only) |
| Market Data | NSE public API + Zerodha instrument dump (daily) |
| AI | Anthropic claude-sonnet-4-6 via API |
| Repo | Monorepo — ~/STAAX/invex/ alongside ~/STAAX/staax/ |
| Ports | Backend: 8001 | Frontend: 3001 |

---

## 2. Accounts & Ownership

| Account | Broker | Equity | MF | Notes |
|---------|--------|--------|----|-------|
| Karthik | Zerodha | ✅ | ✅ (Coin) | Primary account |
| Mom | Angel One | ✅ | ❌ | View only |
| Wife | Angel One | ✅ | ❌ | View only |

---

## 3. Architecture Layers

INVEX follows a strict 4-layer architecture, mirroring STAAX:
```
┌─────────────────────────────────────────┐
│  Portfolio Data Layer                   │  Broker API ingestion, normalization
│  data_ingestion/                        │  zerodha_loader, angel_loader, mf_loader
├─────────────────────────────────────────┤
│  Analytics Layer                        │  XIRR, P&L, metrics computation
│  engine/analytics_engine.py             │
│  engine/portfolio_intelligence.py       │  Sector, concentration, momentum
│  engine/risk_engine.py                  │  Beta, VaR, drawdown
├─────────────────────────────────────────┤
│  Investment Intelligence Layer          │  AI analysis, rebalancing, alerts
│  engine/ai_engine.py                    │
├─────────────────────────────────────────┤
│  Execution Layer                        │  SIP orders, IPO Bot orders
│  engine/sip_engine.py                   │
│  engine/ipo_engine.py                   │
│  engine/execution_router.py             │  Routes to Zerodha/Angel One broker
└─────────────────────────────────────────┘
```

### Full engine module structure
```
invex/backend/app/
  data_ingestion/
    zerodha_loader.py      — normalize Zerodha equity + MF responses
    angel_loader.py        — normalize Angel One equity responses
    mf_loader.py           — Zerodha Coin MF holdings
  engine/
    portfolio_loader.py    — orchestrate all loaders, cache to DB
    analytics_engine.py    — XIRR, P&L, day change, metrics
    portfolio_intelligence.py — sector allocation, concentration, momentum
    risk_engine.py         — beta, VaR, drawdown, volatility
    sip_engine.py          — SIP scheduler + order placement
    ipo_engine.py          — YTR signal + IPO bot orchestration
    execution_router.py    — routes orders to correct broker client
    watchlist_monitor.py   — price + technical + earnings alerts
  api/v1/
    portfolio.py
    analysis.py
    sips.py
    ipo_bots.py
    rebalancing.py
    watchlist.py
```

---

## 4. Module Map

| # | Module | Description | Phase |
|---|--------|-------------|-------|
| 1 | **Portfolio Viewer** | Equity + MF holdings, invested vs current, XIRR, day P&L, equity curve | Phase 1 |
| 2 | **Stock SIP Engine** | Recurring buy orders — daily/weekly/monthly, set ₹ amount, market order CNC | Phase 2 |
| 3 | **IPO Bot (YTR Strategy)** | Auto-detect mainboard listings, YTR signal, CNC delivery trade, 50% SL | Phase 3 |
| 4 | **Fundamental + Tech Dashboard** | Financials, ratios, technical indicators, AI flagging per stock | Phase 4 |
| 5 | **AI Rebalancing Assistant** | Sector analysis, concentration risk, rebalancing suggestions | Phase 5 |

---

## 5. Module Specifications

### 5.1 Portfolio Viewer

**Purpose:** Single consolidated view of all equity and MF holdings across all 3 accounts.

**Data sources:**
- Zerodha: GET /portfolio/holdings — equity with avg price, qty, current value
- Zerodha Coin: KiteConnect MF holdings — NAV, units, invested amount
- Angel One: GET /portfolio/allholding — equity for Mom and Wife

**Display:**
- Hero cards (Glassmorphism): Total Portfolio Value | Today's Gain | Total XIRR | Total Invested
- Holdings table per account: Stock | Qty | Avg Price | LTP | P&L | P&L% | Day Change
- MF section (Karthik only): Fund Name | Units | NAV | Current Value | XIRR
- STAAX trading P&L integration: show realized trading profits from STAAX alongside investment returns
- Equity curve chart: portfolio value over time (from daily snapshots)

**Data refresh tiers:**
- Tier 1 (market hours 09:15–15:30): LTP every 30s via Redis cache
- Tier 2 (daily at 15:35): Holdings update, MF NAV update, fundamental data
- Tier 3 (weekly Sunday): Sector classifications, AI analysis cache

**Metrics computed:**
- Absolute P&L = (LTP − Avg Price) × Qty
- P&L% = ((LTP − Avg Price) / Avg Price) × 100
- XIRR = computed from equity_transactions history + current value
- Day Change = (LTP − prev_close) × Qty

---

### 5.2 Stock SIP Engine

**Purpose:** Automated recurring buy orders for equity stocks on a defined schedule.

**SIP Configuration:**

| Field | Options |
|-------|---------|
| Stock | NSE symbol lookup |
| Account | Karthik / Mom / Wife |
| Amount | ₹ per installment (e.g. ₹10,000) |
| Frequency | Daily / Weekly (pick Mon–Fri) / Monthly (pick date 1–28) |
| Order type | Market order, CNC delivery |
| Status | Active / Paused / Archived |
| Start date | User defined |
| End date | Optional |

**SIP is simple — no conditional logic.** Goals will be handled in FINEX.

**Execution logic:**
- Scheduler at 09:20 IST daily — checks SIP triggers for today
- Shares = floor(Amount ÷ LTP), minimum 1
- If Amount < LTP → skip installment, notify
- If market holiday → skip and log
- Place market order via execution_router.py

**Dashboard:** SIP cards with total invested, units, current value, XIRR, next execution, history.

---

### 5.3 IPO Bot (YTR Strategy)

**Purpose:** Auto-detect newly listed mainboard IPO stocks, run YTR indicator, place CNC delivery trade, exit on 50% SL.

**IMPORTANT: Mainboard IPOs only — SME IPOs are excluded.**

**YTR Strategy:**
```
yearly_range = prev_year_high − prev_year_low
yearly_open  = first trading day open of current year

UPP1 = yearly_open + (yearly_range × 0.5589)
LPP1 = yearly_open − (yearly_range × 0.5589)

Entry:  close crosses above UPP1 → BUY CNC delivery
SL:     price drops 50% from entry → SELL
Target: none — hold until SL or manual exit
```

**For stocks < 1 year old:**
- yearly_open = listing day open price
- prev_year_high/low = all-time high/low since listing

**IPO Auto-Detection (07:00 IST daily):**
- Fetch new mainboard listings from NSE API (/api/initial-offer-detail)
- Filter: exchange = NSE/BSE, listing type = mainboard only (exclude SME)
- Cross-reference Zerodha instrument dump for token
- Auto-create IPO Bot entry with status WATCHING
- Compute YTR levels, subscribe to LTP feed

**Bot lifecycle:** WATCHING → ACTIVE → CLOSED

**Risk controls:**
- Max concurrent positions: configurable (default 5)
- Trade amount: configurable per bot (default ₹10,000)
- PRACTIX / LIVE mode same as STAAX
- All security layers from STAAX apply

---

### 5.4 Fundamental + Technical Analysis Dashboard

**Purpose:** Deep dive into any stock — financials, technical indicators, and AI insights.

**Fundamental data:**
- NSE public API + Screener.in scrape:
  - Revenue, Net Profit, EPS (8 quarters)
  - P/E, P/B, ROE, ROCE, D/E ratio
  - Promoter %, FII/DII %
  - Quarterly results history

**Technical indicators (computed from EOD OHLC):**
- RSI (14), MACD (12/26/9)
- SMA 50, SMA 200
- Volume trend (vs 20-day avg)
- 52-week high/low position
- YTR levels

**AI Analysis (claude-sonnet-4-6) — expanded inputs:**
- Holdings context (already owned or not)
- Price momentum (1M, 3M, 6M returns)
- Earnings growth trend (last 4 quarters)
- Relative performance vs Nifty 50
- Portfolio diversification score impact
- Sector concentration impact
- Output: BUY / HOLD / WATCH / EXIT with full reasoning

**UI:** Stock search, TradingView chart, fundamentals panel, technicals panel, AI insight panel (collapsible, streaming).

---

### 5.5 AI Rebalancing Assistant

**Purpose:** AI-assisted portfolio analysis — concentration risk, underperformers, rebalancing suggestions.

**Inputs (expanded):**
- Current holdings across all accounts
- Sector allocation breakdown (from sector classification table)
- Price momentum per holding
- Earnings growth trends
- SIP schedule (what currently being accumulated)
- Relative performance vs Nifty 50
- Portfolio diversification score
- User's target allocation (optional, configurable)

**Output:**
- Sector overweight/underweight analysis
- Stocks to trim (high allocation + weak fundamentals + poor momentum)
- Stocks to add (low allocation + strong signals + good fundamentals)
- SIP adjustments
- All framed as analysis — user decides

**UI:** Run Analysis button, sector pie, suggestion cards with reasoning, act links (create SIP / add to watchlist / dismiss).

---

### 5.6 Watchlist (Enhanced)

Watchlist is an active monitoring and research tool, not just a static list.

**Features:**
- Price alerts (above/below threshold)
- Technical alerts (RSI threshold, breakout above 52W high, etc.)
- Earnings announcement alerts
- Per-stock notes (research journal)
- YTR levels displayed per stock
- Link to full analysis dashboard per stock

---

## 6. DB Schema
```sql
-- Holdings cache (EOD refresh)
CREATE TABLE holdings (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  exchange VARCHAR(10) NOT NULL,
  isin VARCHAR(20),
  qty INTEGER NOT NULL,
  avg_price FLOAT NOT NULL,
  ltp FLOAT,
  day_change FLOAT,
  updated_at TIMESTAMPTZ
);

-- MF holdings cache (EOD)
CREATE TABLE mf_holdings (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL,
  fund_name VARCHAR(200) NOT NULL,
  isin VARCHAR(20),
  units FLOAT NOT NULL,
  nav FLOAT,
  invested_amount FLOAT,
  current_value FLOAT,
  updated_at TIMESTAMPTZ
);

-- Equity transaction history (CRITICAL for XIRR)
CREATE TABLE equity_transactions (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  trade_date DATE NOT NULL,
  direction VARCHAR(5) NOT NULL,   -- BUY/SELL
  qty INTEGER NOT NULL,
  price FLOAT NOT NULL,
  broker_order_id VARCHAR(50),
  source VARCHAR(20),              -- manual/sip/ipo_bot/import
  created_at TIMESTAMPTZ
);

-- Daily portfolio snapshots (equity curve)
CREATE TABLE portfolio_snapshots (
  id UUID PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  account_id UUID NOT NULL,
  portfolio_value FLOAT NOT NULL,
  invested_value FLOAT NOT NULL,
  cash_balance FLOAT,
  day_pnl FLOAT,
  total_pnl FLOAT
);

-- Sector classification
CREATE TABLE sectors (
  symbol VARCHAR(20) PRIMARY KEY,
  sector VARCHAR(50) NOT NULL,
  industry VARCHAR(50),
  updated_at TIMESTAMPTZ
);

-- SIPs
CREATE TABLE sips (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  exchange VARCHAR(10) NOT NULL,
  amount FLOAT NOT NULL,
  frequency VARCHAR(20) NOT NULL,
  frequency_day INTEGER,           -- 0=Mon..4=Fri for weekly
  frequency_date INTEGER,          -- 1-28 for monthly
  status VARCHAR(20) DEFAULT 'active',
  start_date DATE NOT NULL,
  end_date DATE,
  total_invested FLOAT DEFAULT 0,
  total_units FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ
);

CREATE TABLE sip_executions (
  id UUID PRIMARY KEY,
  sip_id UUID NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL,
  shares INTEGER NOT NULL,
  price FLOAT NOT NULL,
  amount FLOAT NOT NULL,
  broker_order_id VARCHAR(50),
  status VARCHAR(20) DEFAULT 'placed'
);

-- IPO Bots
CREATE TABLE ipo_bots (
  id UUID PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  exchange VARCHAR(10) NOT NULL,
  token INTEGER,
  listing_date DATE,
  yearly_open FLOAT,
  prev_year_high FLOAT,
  prev_year_low FLOAT,
  upp1 FLOAT,
  lpp1 FLOAT,
  trade_amount FLOAT DEFAULT 10000,
  account_id UUID NOT NULL,
  status VARCHAR(20) DEFAULT 'watching',
  is_practix BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ
);

CREATE TABLE ipo_orders (
  id UUID PRIMARY KEY,
  bot_id UUID NOT NULL,
  account_id UUID NOT NULL,
  direction VARCHAR(5) NOT NULL,
  qty INTEGER NOT NULL,
  entry_price FLOAT,
  exit_price FLOAT,
  entry_time TIMESTAMPTZ,
  exit_time TIMESTAMPTZ,
  pnl FLOAT,
  status VARCHAR(20) DEFAULT 'open',
  broker_order_id VARCHAR(50),
  signal_type VARCHAR(20)
);

-- Watchlist
CREATE TABLE watchlist (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  exchange VARCHAR(10) NOT NULL,
  added_at TIMESTAMPTZ,
  notes TEXT,
  price_alert_above FLOAT,
  price_alert_below FLOAT,
  rsi_alert_threshold INTEGER,
  earnings_alert BOOLEAN DEFAULT FALSE
);
```

---

## 7. API Endpoints (planned)
```
Portfolio
GET  /api/v1/portfolio/holdings         — all equity holdings
GET  /api/v1/portfolio/mf               — MF holdings (Coin)
GET  /api/v1/portfolio/summary          — hero metrics + STAAX P&L integration
GET  /api/v1/portfolio/snapshots        — equity curve data
POST /api/v1/portfolio/refresh          — trigger EOD refresh

Analysis
GET  /api/v1/analysis/:symbol           — fundamentals + technicals
POST /api/v1/analysis/:symbol/ai        — AI analysis (streaming)

SIPs
GET    /api/v1/sips/
POST   /api/v1/sips/
PATCH  /api/v1/sips/:id
DELETE /api/v1/sips/:id
GET    /api/v1/sips/:id/executions

IPO Bots
GET    /api/v1/ipo-bots/
POST   /api/v1/ipo-bots/
PATCH  /api/v1/ipo-bots/:id
GET    /api/v1/ipo-bots/:id/orders

Rebalancing
POST /api/v1/rebalancing/analyze        — AI rebalancing (streaming)

Watchlist
GET    /api/v1/watchlist/
POST   /api/v1/watchlist/
PATCH  /api/v1/watchlist/:id
DELETE /api/v1/watchlist/:id
```

---

## 8. Auth & Security

- Shared JWT with STAAX — same login, same secret key
- INVEX backend: FastAPI on port 8001, validates same JWT
- PRACTIX / LIVE mode applies to all SIP and IPO Bot orders
- Kill switch from STAAX applies platform-wide
- SME IPOs hard-filtered out of IPO Bot

---

## 9. Build Phases

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 1** | Project scaffold + Portfolio Viewer (equity + MF, hero metrics, equity curve) | 🔄 Next |
| **Phase 2** | Stock SIP Engine — create, schedule, execute, history | 🔭 Planned |
| **Phase 3** | IPO Bot — YTR, NSE auto-detect, mainboard filter, 50% SL | 🔭 Planned |
| **Phase 4** | Fundamental + Technical Dashboard + AI stock analysis | 🔭 Planned |
| **Phase 5** | AI Rebalancing + Portfolio Intelligence + Risk Engine | 🔭 Planned |

---

## 10. Credentials & Config
```
Backend:  http://localhost:8001
Frontend: http://localhost:3001
DB:       Same PostgreSQL instance as STAAX (new tables, same DB)
Redis:    Same Redis instance as STAAX
Auth:     POST http://localhost:8000/api/v1/login (shared STAAX endpoint)
```

---

## 11. Open Questions

| # | Question | Decision |
|---|----------|----------|
| 1 | Fundamental data — NSE public + Screener.in scrape or paid API? | Start with NSE + scrape, upgrade later |
| 2 | XIRR — need full transaction history from Zerodha P&L report CSV or API? | TBD Phase 1 |
| 3 | MF via Coin — KiteConnect exposes Coin holdings endpoint? | TBD Phase 1 |
| 4 | IPO yearly OHLC < 1 year old — use listing-day open + all-time H/L | Decided |
| 5 | Shared accounts — read from STAAX DB or own account table? | Read from STAAX DB |
| 6 | STAAX P&L integration — read from STAAX DB directly or via API? | TBD Phase 1 |
| 7 | MF transaction history — needed for FINEX goals, not Phase 1 | Future item (Phase 4/5) |

---

## 12. Session Notes

### Session 1 — 14 March 2026
- Full module spec designed, Living Spec v1.0 created
- Monorepo at ~/STAAX/invex/, shared auth, same tech stack confirmed

### Session 2 — 15 March 2026
- Architecture improvements document reviewed and incorporated (v1.1)
- Added: 4-layer architecture, equity_transactions table, portfolio_snapshots table
- Added: unified broker ingestion layer (data_ingestion/)
- Added: Redis market data cache (Tier 1/2/3 refresh strategy)
- Added: portfolio_intelligence.py, risk_engine.py
- Added: sector classification table + watchlist enhancements
- Added: SME IPO filter (mainboard only)
- Added: STAAX P&L integration in portfolio summary
- Added: expanded AI context (momentum, earnings growth, diversification score)
- SIP confirmed simple — no conditional logic, goals handled in FINEX
- MF transaction history deferred to Phase 4/5 (FINEX goals)


## Design Principles

### SVG Icons
Always use proper SVG icons throughout INVEX — never Unicode characters or emoji for functional UI elements.
All icons should be consistent size (18px default), use `stroke="currentColor"`, `strokeWidth="1.8"`,
`strokeLinecap="round"`, `strokeLinejoin="round"`. This matches STAAX icon standards.
