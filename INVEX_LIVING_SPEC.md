# INVEX Living Spec

## Current Version: v1.6
## Last Updated: 2026-04-09

### Architecture
INVEX reads Zerodha token from staax_db (same PostgreSQL host, separate DB).
Angel One accounts use direct SmartAPI login with TOTP.
Redis cache: 5min TTL on holdings data.

### Status
- Portfolio: ✅ Live — ₹46.8L across 37 stocks
- Analysis tab: ✅ Phase 1 scaffold with real data
- SIP Engine: ✅ UI built, backend wiring pending
- Watchlist: ✅ UI built, live prices pending
- IPO Bot: ✅ YTR engine built
- Redis cache: ✅ 5min TTL on holdings

### Known Issues
- Angel One API keys expired for all 3 accounts (Karthik AO, Mom, Wife)
  Error: "Invalid API Key or App not found"
  Fix: Regenerate API keys from Angel One SmartAPI developer portal
- INVEX reads Zerodha token from staax_db.accounts table (fixed 2026-04-09)
  Previously was trying to read from invex_db which has no accounts table

### Start Commands
cd ~/STAXX/invex/backend && uvicorn app.main:app --host 0.0.0.0 --port 8001
cd ~/STAXX/invex/frontend && npm run dev

### Pending
- Angel One API keys regeneration (portal action required)
- Analysis Phase 2: Screener.in integration (P/E, promoter holding, FCF, revenue 5Y)
- SIP backend wiring (scheduler at 09:20, order execution via Angel/Zerodha)
- Watchlist live prices
- XIRR calculation
- alembic upgrade head on server (pending)

### Commits
- aa27c8c: Security fixes, wrong DB engine fix
- c273e9c: localhost → prod URLs audit fixes
- e14fd52: IPO bots engine + UI updates
- Latest: zerodha_loader reads from staax_db
