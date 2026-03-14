# INVEX — Living Engineering Spec
**Version:** 1.0 | **Last Updated:** 14 March 2026 — Initial spec | **PRD Reference:** v1.0

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
- **Accent:** Glassmorphism selectively on hero metric cards (portfolio value, today gain, XIRR)
- **Tables and lists:** Sharp, high-density — same as STAAX
- **Identity:** Premium portfolio-app feel, distinct from STAAX trading terminal aesthetic
- **Future-ready:** Designed to merge cleanly into FINEX as a module

---

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + Python 3.12 |
| Database | PostgreSQL (asyncpg) + SQLAlchemy async |
| Cache | Redis |
| Frontend | React + Vite + TypeScript |
| Auth | Shared JWT with STAAX (same login, same token, same secret key) |
| Broker APIs | Zerodha KiteConnect (Karthik), Angel One SmartAPI (Mom, Wife) |
| MF Data | Zerodha Coin via KiteConnect API (view only) |
| Market Data | NSE public API + Zerodha instrument dump (daily) |
| AI | Anthropic claude-sonnet-4-6 via API |
| Repo | Monorepo — ~/STAXX/invex/ alongside ~/STAXX/staax/ |
| Ports | Backend: 8001 | Frontend: 3001 |

---

## 2. Accounts & Ownership

| Account | Broker | Equity | MF | Notes |
|---------|--------|--------|----|-------|
| Karthik | Zerodha | ✅ | ✅ (Coin) | Primary account |
| Mom | Angel One | ✅ | ❌ | View only |
| Wife | Angel One | ✅ | ❌ | View only |

---

## 3. Module Map

INVEX has 5 core modules:

| # | Module | Description | Status |
|---|--------|-------------|--------|
| 1 | **Portfolio Viewer** | Equity + MF holdings, invested vs current, XIRR, day P&L | 🔭 Phase 1 |
| 2 | **Fundamental + Tech Dashboard** | Per-stock: financials, ratios, technical indicators, AI flagging | 🔭 Phase 4 |
| 3 | **Stock SIP Engine** | Recurring buy orders — daily/weekly/monthly, set ₹ amount, market order CNC | 🔭 Phase 2 |
| 4 | **IPO Bot (YTR Strategy)** | Auto-detect new mainboard listings, YTR indicator, CNC delivery trade, 50% SL | 🔭 Phase 3 |
| 5 | **AI Rebalancing Assistant** | AI-assisted portfolio analysis, sector allocation, rebalancing suggestions | 🔭 Phase 5 |

---

## 4. Module Specifications

### 4.1 Portfolio Viewer

**Purpose:** Single consolidated view of all equity and MF holdings across all 3 accounts.

**Data sources:**
- Zerodha: GET /portfolio/holdings — equity holdings with avg price, qty, current value
- Zerodha Coin: KiteConnect MF holdings — NAV, units, invested amount
- Angel One: GET /portfolio/allholding — equity for Mom and Wife

**Display:**
- Hero cards (Glassmorphism): Total Portfolio Value | Today's Gain | Total XIRR | Invested Amount
- Holdings table per account: Stock | Qty | Avg Price | LTP | P&L | P&L% | Day Change
- MF section (Karthik only): Fund Name | Units | NAV | Current Value | XIRR
- EOD data refresh — LTP polling every 30s during market hours (09:15–15:30 IST) acceptable
- Consolidated view across all accounts with account filter

**Metrics computed:**
- Absolute P&L = (LTP − Avg Price) × Qty
- P&L% = ((LTP − Avg Price) / Avg Price) × 100
- XIRR = computed from buy transaction history and current value
- Day Change = (LTP − prev_close) × Qty

---

### 4.2 Fundamental + Technical Analysis Dashboard

**Purpose:** Deep dive into any stock — financials, valuation ratios, technical indicators, and AI-generated insights.

**Fundamental data (free/public sources):**
- NSE public API + Screener.in (scrape) for:
  - Revenue, Net Profit, EPS growth (8 quarters)
  - P/E, P/B, ROE, ROCE, D/E ratio
  - Promoter holding %, FII/DII holding %
  - Quarterly results history

**Technical indicators (computed in-engine from EOD OHLC):**
- RSI (14)
- MACD (12/26/9)
- SMA 50 and SMA 200
- Volume trend (above/below 20-day avg)
- 52-week high/low position
- YTR levels (same as IPO Bot — yearly trading range)

**AI Flagging (claude-sonnet-4-6):**
- On-demand: "Analyse this stock for me"
- Input: fundamentals + technicals + whether already holding + portfolio context
- Output: structured analysis with reasoning — BUY / HOLD / WATCH / EXIT with reasoning
- Framed as analysis, not financial advice

**UI:**
- Stock search with NSE symbol autocomplete
- TradingView Advanced Chart widget (same as STAAX ticker modal)
- Fundamentals panel: key ratios in cards
- Technical panel: indicator readings, color-coded (bullish/bearish/neutral)
- AI insight panel: collapsible, on-demand, streaming response

---

### 4.3 Stock SIP Engine

**Purpose:** Automated recurring buy orders for equity stocks on a defined schedule.

**SIP Configuration:**

| Field | Options |
|-------|---------|
| Stock | NSE symbol lookup |
| Account | Karthik / Mom / Wife |
| Amount | ₹ per installment (e.g. ₹10,000) |
| Frequency | Daily / Weekly (Mon–Fri pick day) / Monthly (pick date 1–28) |
| Order type | Market order, CNC (delivery) |
| Status | Active / Paused / Archived |
| Start date | User defined |
| End date | Optional |

**Execution logic:**
- Scheduler at 09:20 IST daily — checks if any SIP triggers today
- Shares to buy = floor(Amount ÷ LTP) — minimum 1 share
- If Amount < LTP → skip this installment, notify user
- If market holiday → skip and log
- Place market order via broker API (same ExecutionManager pattern as STAAX)

**Dashboard:**
- SIP cards: stock, amount, frequency, next execution, total invested, total units, current value, XIRR
- Execution history: date, shares bought, price, amount, order status
- Pause / Edit / Archive controls per SIP

---

### 4.4 IPO Bot (YTR Strategy)

**Purpose:** Auto-detect newly listed mainboard IPO stocks, run YTR indicator, place CNC delivery trade when signal fires, exit on 50% SL.

**YTR Strategy (Yearly Trading Range) — Pine Script translation:**
```
yearly_range = prev_year_high - prev_year_low
yearly_open  = first trading day open of current year

UPP1 = yearly_open + (yearly_range × 0.5589)
LPP1 = yearly_open - (yearly_range × 0.5589)

Entry signal:  close crosses above UPP1 → BUY (CNC delivery)
Stop loss:     price drops 50% from entry price → SELL
Profit target: none — hold until SL or manual exit
Direction:     LONG only (no shorting)
```

**Special case for newly listed stocks (< 1 year old):**
- Use listing-day open as yearly_open
- Use highest high and lowest low since listing as prev_year_high/low
- Compute UPP1/LPP1 from these values

**IPO Auto-Detection (daily job at 07:00 IST):**
- Fetch new listings from NSE API: /api/initial-offer-detail
- Cross-reference with Zerodha daily instrument dump to get exchange token
- If new listing found → auto-create IPO Bot with status WATCHING
- Compute YTR levels and subscribe to LTP feed

**Bot lifecycle:**
```
WATCHING → (crossover signal) → ACTIVE (position open) → CLOSED (SL hit / manual exit)
```

**Config:**
- Trade amount: configurable per bot (default ₹10,000)
- Max concurrent positions: configurable (default 5)
- Account: any mapped account (Karthik default)

**Dashboard:**
- Bot cards: stock, listing date, YTR levels, current price vs UPP1, status, distance to SL
- Active trades: entry, current P&L, % from SL
- Closed trades: outcome, P&L, hold duration

**Risk controls:**
- All security layers from STAAX apply (kill switch, account-level limits)
- PRACTIX / LIVE mode same as STAAX

---

### 4.5 AI Rebalancing Assistant

**Purpose:** AI-assisted portfolio analysis — identify concentration risk, suggest rebalancing, flag underperformers.

**Inputs to AI (claude-sonnet-4-6):**
- Current holdings across all accounts (symbol, qty, value, P&L%)
- Sector allocation breakdown (computed from holdings)
- SIP schedule (what you're currently accumulating)
- User's target allocation (optional — configurable)
- Performance vs Nifty 50 (last 1M, 3M, 1Y)

**Output:**
- Sector overweight / underweight analysis
- Stocks to consider trimming (high allocation + weak fundamentals + poor momentum)
- Stocks to consider adding (low allocation + strong signals + good fundamentals)
- SIP adjustments (pause underperforming SIPs, add to strong ones)
- All framed as analysis — user makes final call

**UI:**
- "Run Analysis" button — triggers AI call
- Results: sector pie chart, suggestion cards, full reasoning
- Each suggestion links to the stock's analysis dashboard
- Option to act: create SIP, add to watchlist, or dismiss

---

## 5. DB Schema
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

-- SIPs
CREATE TABLE sips (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  exchange VARCHAR(10) NOT NULL,
  amount FLOAT NOT NULL,
  frequency VARCHAR(20) NOT NULL,   -- daily/weekly/monthly
  frequency_day INTEGER,             -- 0=Mon..4=Fri for weekly
  frequency_date INTEGER,            -- 1-28 for monthly
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
  notes TEXT
);
```

---

## 6. API Endpoints (planned)
```
Portfolio
GET  /api/v1/portfolio/holdings         — all equity holdings across accounts
GET  /api/v1/portfolio/mf               — MF holdings (Zerodha Coin)
GET  /api/v1/portfolio/summary          — consolidated hero metrics
POST /api/v1/portfolio/refresh          — trigger EOD refresh

Analysis
GET  /api/v1/analysis/:symbol           — fundamentals + technicals
POST /api/v1/analysis/:symbol/ai        — AI stock analysis (streaming)

SIPs
GET    /api/v1/sips/                    — list all SIPs
POST   /api/v1/sips/                    — create SIP
PATCH  /api/v1/sips/:id                 — update/pause SIP
DELETE /api/v1/sips/:id                 — delete SIP
GET    /api/v1/sips/:id/executions      — execution history

IPO Bots
GET    /api/v1/ipo-bots/                — list all IPO bots
POST   /api/v1/ipo-bots/               — manually add stock to IPO watch
PATCH  /api/v1/ipo-bots/:id            — update bot (amount, account, status)
GET    /api/v1/ipo-bots/:id/orders     — order history

Rebalancing
POST /api/v1/rebalancing/analyze       — run AI rebalancing (streaming)

Watchlist
GET    /api/v1/watchlist/              — get watchlist
POST   /api/v1/watchlist/             — add to watchlist
DELETE /api/v1/watchlist/:id          — remove from watchlist
```

---

## 7. Auth & Security

- Shared JWT with STAAX — same login endpoint, same token, same secret key
- INVEX backend: separate FastAPI app on port 8001, validates JWT with shared secret
- All order placement goes through the same broker clients already built in STAAX
- PRACTIX / LIVE mode applies to all SIP and IPO Bot orders
- Kill switch from STAAX applies platform-wide

---

## 8. Build Phases

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 1** | Project setup + Portfolio Viewer (equity + MF holdings, hero metrics) | 🔭 Next |
| **Phase 2** | Stock SIP Engine — create, schedule, execute, history | 🔭 Planned |
| **Phase 3** | IPO Bot — YTR strategy, NSE auto-detection, CNC trading, 50% SL | 🔭 Planned |
| **Phase 4** | Fundamental + Technical Dashboard + AI stock analysis | 🔭 Planned |
| **Phase 5** | AI Rebalancing Assistant | 🔭 Planned |

---

## 9. Open Questions / Decisions Pending

| # | Question | Decision |
|---|----------|----------|
| 1 | Fundamental data — Screener.in scrape vs paid API (e.g. Trendlyne, Ticker Tape)? | TBD — start with NSE public + screener scrape |
| 2 | XIRR — needs full transaction history. Source from Zerodha P&L report CSV or API? | TBD — verify during Phase 1 |
| 3 | MF via Coin — does KiteConnect API expose Coin MF holdings endpoint? | TBD — verify during Phase 1 |
| 4 | IPO yearly OHLC — stock < 1 year old: use listing-day open as yearly_open, all-time high/low as range | Decided |
| 5 | AI rebalancing — user sets target allocation or AI infers from current portfolio? | TBD — make it configurable |
| 6 | Shared accounts DB — read accounts from STAAX DB or INVEX maintains its own account table? | TBD — likely read from STAAX DB |

---

## 10. Credentials & Config
```
Backend:  http://localhost:8001
Frontend: http://localhost:3001
DB:       Same PostgreSQL as STAAX (new schema/tables, same DB instance)
Auth:     POST http://localhost:8000/api/v1/login (STAAX login endpoint, shared JWT)
```

---

## 11. Session Notes

### Session 1 — 14 March 2026
- Full module spec designed and Living Spec created
- Confirmed: monorepo at ~/STAXX/invex/
- Confirmed: shared auth with STAAX (same JWT, same secret)
- Confirmed: same tech stack — FastAPI + React + PostgreSQL
- Design: STAAX base + Glassmorphism on hero cards only
- MF: Zerodha Coin only, view only, feeds FINEX goals later
- SIP: market order CNC, daily/weekly/monthly frequencies
- IPO Bot: YTR strategy, auto-detection from NSE API, CNC delivery, 50% SL
- Fundamental + Tech: NSE + Screener.in, RSI/MACD/SMA/YTR, AI via claude-sonnet-4-6
- AI Rebalancing: sector allocation, suggestions, streaming output
- Build sequence: Phase 1 → 2 → 3 → 4 → 5
- STAAX Phase 1F fully complete before INVEX Phase 1 starts
