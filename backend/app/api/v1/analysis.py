"""Analysis API — fundamental, technical, scorecard views of the portfolio."""
import asyncio
import json
import logging
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.redis_client import redis_client
from app.models.holdings import Holdings, MFHoldings
from app.models.invex_account import InvexAccount
from app.models.user import User
from app.core.auth import get_current_user
from app.core.nse_sector_fetcher import get_sector_from_map
from app.api.v1.portfolio import _build_holding

logger = logging.getLogger(__name__)

router = APIRouter()


async def _get_account_map(db: AsyncSession, user_id: str) -> dict:
    """Returns {account_id_str: nickname} for the current user's accounts."""
    result = await db.execute(
        select(InvexAccount).where(InvexAccount.user_id == user_id)
    )
    return {str(a.id): a.nickname for a in result.scalars().all()}


def _clean_sym(s: str) -> str:
    for sfx in ('-EQ', '-BE', '.NS', '.BO'):
        s = s.replace(sfx, '')
    return s.strip()


async def _get_holdings(request: Request, db: AsyncSession, user_id: str) -> list:
    """Return holdings for the current user, preferring Redis cache."""
    cache_key = f"invex:holdings:{user_id}"
    cached = await redis_client.get(cache_key)
    if cached:
        data = json.loads(cached)
        for h in data:
            if "gain_pct" not in h:
                h["gain_pct"] = h.get("pnl_pct") or 0
            if "current_price" not in h:
                h["current_price"] = h.get("ltp") or 0
        return data

    sector_map: dict = getattr(request.app.state, "sector_map", {})
    result = await db.execute(
        select(Holdings)
        .where(Holdings.user_id == user_id)
        .order_by(Holdings.account_id, Holdings.symbol)
    )
    rows = result.scalars().all()
    data = [_build_holding(r, sector_map) for r in rows]
    for h in data:
        if "gain_pct" not in h:
            h["gain_pct"] = h.get("pnl_pct") or 0
        if "current_price" not in h:
            h["current_price"] = h.get("ltp") or 0
    return data


@router.get("/fundamental")
async def get_fundamental(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    holdings, account_map = await asyncio.gather(
        _get_holdings(request, db, str(current_user.id)),
        _get_account_map(db, str(current_user.id)),
    )

    if not holdings:
        return {
            'total_holdings': 0, 'total_value': 0,
            'health_score': None,
            'sector_allocation': [], 'gain_distribution': [],
            'top_holdings': [], 'red_flags': [], 'empty': True,
            'message': 'Connect a broker account to see your portfolio analysis'
        }

    # Sector allocation
    sector_map = {}
    for h in holdings:
        sector = h.get('sector', 'Others') or 'Others'
        if sector not in sector_map:
            sector_map[sector] = {'sector': sector, 'value': 0, 'count': 0}
        sector_map[sector]['value'] += h.get('current_value', 0) or 0
        sector_map[sector]['count'] += 1

    total = sum(s['value'] for s in sector_map.values())
    sector_allocation = sorted([
        {**s, 'pct': round(s['value'] / total * 100, 1) if total else 0}
        for s in sector_map.values()
    ], key=lambda x: -x['value'])

    # Gain distribution
    buckets = {
        'lt_minus20': {'label': '< -20%', 'count': 0, 'stocks': []},
        'minus20_0':  {'label': '-20–0%', 'count': 0, 'stocks': []},
        'zero_20':    {'label': '0–20%',  'count': 0, 'stocks': []},
        'twenty_50':  {'label': '20–50%', 'count': 0, 'stocks': []},
        'gt_50':      {'label': '> 50%',  'count': 0, 'stocks': []},
    }
    for h in holdings:
        pct = h.get('gain_pct', 0) or 0
        symbol = h.get('symbol', '')
        if pct < -20:
            buckets['lt_minus20']['count'] += 1; buckets['lt_minus20']['stocks'].append(symbol)
        elif pct < 0:
            buckets['minus20_0']['count'] += 1; buckets['minus20_0']['stocks'].append(symbol)
        elif pct < 20:
            buckets['zero_20']['count'] += 1; buckets['zero_20']['stocks'].append(symbol)
        elif pct < 50:
            buckets['twenty_50']['count'] += 1; buckets['twenty_50']['stocks'].append(symbol)
        else:
            buckets['gt_50']['count'] += 1; buckets['gt_50']['stocks'].append(symbol)

    # Portfolio health score
    total_holdings = len(holdings)
    sectors_count = len(sector_map)
    div_score = min(sectors_count * 8, 40)
    top3_val = sum(h.get('current_value', 0) or 0
                   for h in sorted(holdings, key=lambda x: -(x.get('current_value') or 0))[:3])
    conc_pct = (top3_val / total * 100) if total else 100
    conc_score = 30 if conc_pct < 20 else 20 if conc_pct < 30 else 10
    winners = sum(1 for h in holdings if (h.get('gain_pct') or 0) > 0)
    win_rate = winners / total_holdings if total_holdings else 0
    gl_score = round(win_rate * 30)

    health_score = {
        'total': div_score + conc_score + gl_score,
        'diversification': div_score,
        'concentration': conc_score,
        'gain_loss_balance': gl_score,
        'sectors_count': sectors_count,
        'top3_concentration_pct': round(conc_pct, 1),
        'winners_pct': round(win_rate * 100, 1),
    }

    # ── Red Flags ──────────────────────────────────────────────────────
    red_flags: list[dict] = []

    for s in sector_allocation:
        if s['pct'] > 30:
            red_flags.append({
                'severity': 'warn',
                'msg': f"Overweight in {s['sector']} — {s['pct']}% of portfolio",
            })

    if conc_pct > 50:
        red_flags.append({
            'severity': 'warn',
            'msg': f"High concentration — top 3 holdings = {round(conc_pct, 1)}%",
        })

    for h in holdings:
        pct = h.get('gain_pct', 0) or 0
        if pct < -25:
            red_flags.append({
                'severity': 'danger',
                'msg': f"{_clean_sym(h.get('symbol', ''))} down {abs(round(pct, 1))}% — review position",
            })

    bear_count = sum(1 for h in holdings if (h.get('gain_pct', 0) or 0) < -20)
    if total_holdings and bear_count > total_holdings * 0.3:
        bear_pct = round(bear_count / total_holdings * 100)
        red_flags.append({
            'severity': 'danger',
            'msg': f"{bear_count} holdings ({bear_pct}%) down more than 20%",
        })

    if win_rate < 0.5:
        red_flags.append({
            'severity': 'warn',
            'msg': f"Less than half your holdings are profitable ({round(win_rate * 100)}% win rate)",
        })

    red_flags = red_flags[:5]  # cap at 5

    # All holdings by value
    top_holdings = sorted(holdings, key=lambda x: -(x.get('current_value') or 0))
    top_holdings_out = []
    for h in top_holdings:
        val = h.get('current_value', 0) or 0
        acct_id = h.get('account_id', '')
        top_holdings_out.append({
            'symbol':           _clean_sym(h.get('symbol', '')),
            'sector':           h.get('sector', 'Others') or 'Others',
            'current_value':    val,
            'weight_pct':       round(val / total * 100, 1) if total else 0,
            'gain_pct':         h.get('gain_pct', 0) or 0,
            'account_id':       acct_id,
            'account_nickname': account_map.get(acct_id, ''),
        })

    return {
        'sector_allocation': sector_allocation,
        'gain_distribution': list(buckets.values()),
        'health_score':      health_score,
        'total_holdings':    total_holdings,
        'total_value':       total,
        'top_holdings':      top_holdings_out,
        'red_flags':         red_flags,
    }


def _signal_from_dma(dma: dict | None, gain_pct: float) -> str:
    """Derive signal from DMA data; fall back to gain_pct if not available."""
    if dma:
        above_200 = dma.get('above_200', False)
        above_50  = dma.get('above_50',  False)
        above_20  = dma.get('above_20',  False)
        if above_200 and above_50 and above_20 and gain_pct > 20:
            return 'STRONG_BULL'
        if above_200 and above_50:
            return 'BULL'
        if not above_200 and not above_50:
            return 'BEAR'
        if not above_50:
            return 'WEAK'
        return 'NEUTRAL'
    # Fallback
    if gain_pct > 30:   return 'STRONG_BULL'
    if gain_pct > 10:   return 'BULL'
    if gain_pct < -20:  return 'BEAR'
    if gain_pct < -5:   return 'WEAK'
    return 'NEUTRAL'


@router.get("/technical")
async def get_technical(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.adapters.market_data_adapter import market_data

    holdings, account_map = await asyncio.gather(
        _get_holdings(request, db, str(current_user.id)),
        _get_account_map(db, str(current_user.id)),
    )

    if not holdings:
        return {
            'holdings': [], 'signal_summary': {
                'STRONG_BULL': {'count':0,'value':0,'value_pct':0},
                'BULL': {'count':0,'value':0,'value_pct':0},
                'NEUTRAL': {'count':0,'value':0,'value_pct':0},
                'WEAK': {'count':0,'value':0,'value_pct':0},
                'BEAR': {'count':0,'value':0,'value_pct':0},
            }, 'empty': True
        }

    # Fetch DMA + RSI for all symbols concurrently (uses 24h price-history cache)
    symbols_clean = [h.get('symbol', '').replace('-EQ', '').replace('-BE', '') for h in holdings]

    async def _fetch_tech(sym: str):
        try:
            dma, rsi = await asyncio.gather(
                market_data.compute_dma(sym),
                market_data.compute_rsi(sym),
            )
            return sym, dma, rsi
        except Exception:
            return sym, None, None

    results = await asyncio.gather(*[_fetch_tech(s) for s in symbols_clean])
    tech_map: dict = {sym: (dma, rsi) for sym, dma, rsi in results}

    technical = []
    for h, sym in zip(holdings, symbols_clean):
        gain_pct   = h.get('gain_pct', 0) or 0
        price      = h.get('ltp') or h.get('current_price', 0) or 0
        avg_price  = h.get('avg_price', price) or price
        dma, rsi   = tech_map.get(sym, (None, None))
        signal     = _signal_from_dma(dma, gain_pct)

        acct_id = h.get('account_id', '')
        technical.append({
            'symbol':           _clean_sym(h.get('symbol', '')),
            'sector':           h.get('sector', 'Others') or 'Others',
            'account_id':       acct_id,
            'account_nickname': account_map.get(acct_id, ''),
            'price':            price,
            'avg_price':        avg_price,
            'gain_pct':         gain_pct,
            'current_value':    h.get('current_value', 0) or 0,
            'signal':           signal,
            'rsi':              rsi,
            'ma50':             dma.get('dma_50')    if dma else None,
            'ma200':            dma.get('dma_200')   if dma else None,
            'above_50':         dma.get('above_50')  if dma else None,
            'above_200':        dma.get('above_200') if dma else None,
            'week52_low':       None,
            'week52_high':      None,
        })

    # Signal summary
    signal_summary = {}
    total_value = sum(t['current_value'] for t in technical)
    for sig in ['STRONG_BULL', 'BULL', 'NEUTRAL', 'WEAK', 'BEAR']:
        group   = [t for t in technical if t['signal'] == sig]
        grp_val = sum(t['current_value'] for t in group)
        signal_summary[sig] = {
            'count':     len(group),
            'value':     grp_val,
            'value_pct': round(grp_val / total_value * 100, 1) if total_value else 0,
        }

    return {'holdings': technical, 'signal_summary': signal_summary}


@router.get("/scorecard")
async def get_scorecard(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.adapters.market_data_adapter import market_data

    holdings, account_map = await asyncio.gather(
        _get_holdings(request, db, str(current_user.id)),
        _get_account_map(db, str(current_user.id)),
    )

    if not holdings:
        return {
            'portfolio': {
                'overall_score': 0, 'fundamental_score': 0, 'technical_score': 0,
                'buy_count': 0, 'hold_count': 0, 'watch_count': 0,
                'top_3': [], 'bottom_3': [],
            },
            'holdings': [],
            'benchmark': {'nifty_1y_return': None, 'portfolio_absolute_return': None,
                          'has_1y_data': False, 'outperforming': None, 'alpha': None,
                          'note': 'No holdings'},
            'empty': True
        }

    symbols_clean = [h.get('symbol', '').replace('-EQ', '').replace('-BE', '') for h in holdings]

    # Fetch fundamentals + DMA/RSI concurrently
    async def _fetch_all(sym: str):
        try:
            fund, dma, rsi = await asyncio.gather(
                market_data.get_fundamentals(sym),
                market_data.compute_dma(sym),
                market_data.compute_rsi(sym),
            )
            return sym, fund, dma, rsi
        except Exception:
            return sym, None, None, None

    results, nifty_history = await asyncio.gather(
        asyncio.gather(*[_fetch_all(s) for s in symbols_clean]),
        market_data.get_index_history('NIFTY50', days=365),
    )
    data_map: dict = {sym: (fund, dma, rsi) for sym, fund, dma, rsi in results}

    scored = []
    for h, sym in zip(holdings, symbols_clean):
        gain_pct      = h.get('gain_pct', 0) or 0
        current_value = h.get('current_value', 0) or 0
        fund, dma, rsi = data_map.get(sym, (None, None, None))

        pe              = fund.get('pe') if fund else None
        market_cap_cat  = fund.get('market_cap_category') if fund else None

        # ── Fundamental score ─────────────────────────────────────
        fs = 50
        if gain_pct > 100:   fs += 25
        elif gain_pct > 50:  fs += 20
        elif gain_pct > 20:  fs += 15
        elif gain_pct > 0:   fs += 10
        elif gain_pct < -20: fs -= 10

        if pe and pe > 0:
            if pe < 15:    fs += 15
            elif pe < 25:  fs += 10
            elif pe < 40:  fs +=  5
            elif pe > 50:  fs -=  5

        if market_cap_cat == 'Large Cap':  fs += 10
        elif market_cap_cat == 'Mid Cap':  fs +=  5

        fund_score = max(0, min(100, fs))

        # ── Technical score from DMA + RSI ───────────────────────
        ts = 50
        if dma:
            if dma.get('above_200'): ts += 20
            if dma.get('above_50'):  ts += 15
            if dma.get('above_20'):  ts += 10
        if rsi is not None:
            if 40 <= rsi <= 65: ts += 10    # healthy range
            elif rsi > 70:      ts -=  5    # overbought
            elif rsi < 30:      ts +=  5    # oversold — potential reversal

        tech_score = max(0, min(100, ts))

        overall = round(fund_score * 0.5 + tech_score * 0.5)

        if overall >= 75: recommendation = 'BUY'
        elif overall >= 55: recommendation = 'HOLD'
        else: recommendation = 'WATCH'

        grade = 'A' if overall >= 80 else 'B' if overall >= 65 else 'C' if overall >= 50 else 'D'
        signal = _signal_from_dma(dma, gain_pct)

        acct_id = h.get('account_id', '')
        scored.append({
            'symbol':              _clean_sym(h.get('symbol', '')),
            'sector':              h.get('sector', 'Others') or 'Others',
            'account_id':          acct_id,
            'account_nickname':    account_map.get(acct_id, ''),
            'current_value':       current_value,
            'gain_pct':            gain_pct,
            'fundamental_score':   fund_score,
            'technical_score':     tech_score,
            'overall_score':       overall,
            'recommendation':      recommendation,
            'grade':               grade,
            'signal':              signal,
            'pe':                  pe,
            'market_cap_category': market_cap_cat,
            'rsi':                 rsi,
        })

    scored.sort(key=lambda x: -x['overall_score'])

    if scored:
        avg_fund    = round(sum(s['fundamental_score'] for s in scored) / len(scored))
        avg_tech    = round(sum(s['technical_score']   for s in scored) / len(scored))
        avg_overall = round(avg_fund * 0.5 + avg_tech * 0.5)
    else:
        avg_fund = avg_tech = avg_overall = 0

    buys    = [s for s in scored if s['recommendation'] == 'BUY']
    holds   = [s for s in scored if s['recommendation'] == 'HOLD']
    watches = [s for s in scored if s['recommendation'] == 'WATCH']

    # ── Benchmark comparison ──────────────────────────────────────────
    # portfolio_absolute_return = unrealised gain from avg buy price (not 1Y)
    # Snapshots exist but are < 30 days old and have zero values — no 1Y data yet.
    # We show absolute return clearly labeled; alpha is suppressed (incomparable).
    total_value    = sum(h.get('current_value', 0) or 0 for h in holdings)
    total_invested = sum(h.get('invested_value', 0) or 0 for h in holdings)

    portfolio_absolute_return = (
        round((total_value - total_invested) / total_invested * 100, 2)
        if total_invested else None
    )

    nifty_1y_return = None
    if nifty_history and len(nifty_history) >= 2:
        first = nifty_history[0]['close']
        last  = nifty_history[-1]['close']
        if first:
            nifty_1y_return = round((last - first) / first * 100, 2)

    benchmark = {
        'nifty_1y_return':          nifty_1y_return,
        'portfolio_absolute_return': portfolio_absolute_return,
        'has_1y_data':              False,   # need ≥365 days of snapshots
        'outperforming':            None,    # suppressed — returns not comparable
        'alpha':                    None,    # suppressed — returns not comparable
        'note':                     'Portfolio return is absolute gain from avg buy price, not 1-year return',
    }

    return {
        'portfolio': {
            'overall_score':     avg_overall,
            'fundamental_score': avg_fund,
            'technical_score':   avg_tech,
            'buy_count':         len(buys),
            'hold_count':        len(holds),
            'watch_count':       len(watches),
            'top_3':             scored[:3],
            'bottom_3':          scored[-3:],
        },
        'holdings':  scored,
        'benchmark': benchmark,
    }


@router.get("/mutual-funds")
async def get_mutual_funds(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """MF holdings with computed P&L, grade, and enriched category/returns from mfapi.in."""
    from app.adapters.mf_data_adapter import mf_data
    mf_rows, account_map = await asyncio.gather(
        db.execute(
            select(MFHoldings)
            .where(MFHoldings.user_id == current_user.id)
            .order_by(MFHoldings.account_id, MFHoldings.fund_name)
        ),
        _get_account_map(db, str(current_user.id)),
    )
    mf_list = mf_rows.scalars().all()

    if not mf_list:
        return {'total_invested':0,'total_current':0,'total_pnl':0,'total_pnl_pct':0,'funds':[],'empty':True}

    funds = []
    for m in mf_list:
        invested  = m.invested_amount or 0
        current   = m.current_value   or 0
        pnl       = current - invested
        pnl_pct   = round(pnl / invested * 100, 2) if invested else 0
        acct_id   = str(m.account_id)

        if pnl_pct >= 30:   grade = 'A'
        elif pnl_pct >= 15: grade = 'B'
        elif pnl_pct >= 0:  grade = 'C'
        else:               grade = 'D'

        name = m.fund_name or ''
        funds.append({
            'id':               str(m.id),
            'fund_name':        name,
            'fund_name_short':  name[:40] + ('…' if len(name) > 40 else ''),
            'account_id':       acct_id,
            'account_nickname': account_map.get(acct_id, ''),
            'units':            m.units,
            'nav':              m.nav,
            'invested_amount':  invested,
            'current_value':    current,
            'pnl':              round(pnl, 2),
            'pnl_pct':          pnl_pct,
            'grade':            grade,
            'category':         None,
            'sub_category':     None,
            'expense_ratio':    None,
            'return_1y':        None,
            'return_3y':        None,
        })

    # Phase 2 enrichment: category + 1Y/3Y returns from mfapi.in (concurrent)
    funds = await mf_data.enrich_mf_holdings(funds)

    funds.sort(key=lambda x: -x['pnl_pct'])

    total_invested = sum(f['invested_amount'] for f in funds)
    total_current  = sum(f['current_value']   for f in funds)
    total_pnl      = round(total_current - total_invested, 2)
    total_pnl_pct  = round(total_pnl / total_invested * 100, 2) if total_invested else 0

    return {
        'total_invested': total_invested,
        'total_current':  total_current,
        'total_pnl':      total_pnl,
        'total_pnl_pct':  total_pnl_pct,
        'funds':          funds,
    }


@router.get("/holdings-enriched")
async def get_holdings_enriched(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Each holding enriched with Yahoo Finance fundamentals from cache.
    Fundamentals are populated by background prefetch after /refresh.
    Returns immediately even if cache is cold (fundamentals will be None).
    """
    from app.adapters.market_data_adapter import market_data

    holdings = await _get_holdings(request, db, str(current_user.id))

    if not holdings:
        return []

    total_value = sum(h.get('current_value', 0) or 0 for h in holdings)

    result = []
    for h in holdings:
        symbol_clean = _clean_sym(h.get('symbol', ''))
        pnl_pct = h.get('gain_pct', 0) or 0
        current_value = h.get('current_value', 0) or 0
        weight_pct = round(current_value / total_value * 100, 1) if total_value else 0

        # Fetch fundamentals — hits cache if warm, fetches from Yahoo Finance if cold
        fund = await market_data.get_fundamentals(symbol_clean)

        pe = fund.get('pe') if fund else None
        pb = fund.get('pb') if fund else None
        market_cap_cat = fund.get('market_cap_category') if fund else None
        market_cap_cr = fund.get('market_cap_cr') if fund else None
        week52_high = fund.get('week52_high') if fund else None
        week52_low = fund.get('week52_low') if fund else None
        roe = fund.get('roe') if fund else None
        beta = fund.get('beta') if fund else None
        div_yield = fund.get('dividend_yield') if fund else None

        # Grade scoring
        score = 0
        if pnl_pct > 30:
            score += 3
        elif pnl_pct > 0:
            score += 1
        if pe and pe < 20:
            score += 2
        elif pe and pe < 35:
            score += 1
        if market_cap_cat == 'Large Cap':
            score += 1

        grade = 'A' if score >= 5 else 'B' if score >= 3 else 'C' if score >= 1 else 'D'

        # Signal label
        if pnl_pct > 100:
            signal = 'Multibagger'
        elif pnl_pct > 30 and pe and pe < 20:
            signal = 'Strong Compounder'
        elif pnl_pct > 30:
            signal = 'Momentum Leader'
        elif pnl_pct < -20:
            signal = 'Under Watch'
        elif pnl_pct < 0:
            signal = 'Laggard'
        else:
            signal = 'Steady'

        result.append({
            'symbol': symbol_clean,
            'symbol_raw': h.get('symbol', ''),
            'sector': h.get('sector', 'Others') or 'Others',
            'account_id': h.get('account_id', ''),
            'qty': h.get('qty', 0),
            'avg_price': h.get('avg_price', 0),
            'ltp': h.get('ltp'),
            'current_value': current_value,
            'invested_value': h.get('invested_value', 0),
            'weight_pct': weight_pct,
            'pnl': h.get('pnl'),
            'pnl_pct': pnl_pct,
            # Fundamentals (None if not yet cached)
            'pe': pe,
            'pb': pb,
            'roe': roe,
            'beta': beta,
            'dividend_yield': div_yield,
            'market_cap_cr': market_cap_cr,
            'market_cap_category': market_cap_cat,
            'week52_high': week52_high,
            'week52_low': week52_low,
            # Computed
            'grade': grade,
            'signal': signal,
            'fundamentals_cached': fund is not None,
        })

    result.sort(key=lambda x: -(x['current_value'] or 0))
    return result
