# INVEX Living Spec

## Current Version: v1.5
## Last Updated: 2026-04-09

### Status
- Portfolio: ✅ Live — ₹46.8L across 37 stocks
- Analysis tab: ✅ Phase 1 scaffold with real data
- SIP Engine: ✅ UI built, backend pending wiring
- Watchlist: ✅ UI built, live prices pending
- IPO Bot: ✅ YTR engine built
- Redis cache: ✅ 5min TTL on holdings

### Pending
- Angel One API keys (expired — needs portal regeneration)
- Analysis Phase 2: Screener.in integration
  (P/E, promoter holding, FCF, revenue 5Y)
- SIP backend wiring
- Watchlist live prices
- XIRR calculation
- alembic upgrade head on server (pending)

### Commits
- aa27c8c: Security fixes, wrong DB engine fix
- c273e9c: localhost → prod URLs audit fixes
- e14fd52: IPO bots engine + UI updates
