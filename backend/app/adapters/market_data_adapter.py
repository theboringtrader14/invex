"""
Market data adapter using Yahoo Finance.
All calls are cached in Redis to avoid rate limiting.
Never called inline — always cached first.
"""
import asyncio
import json
import time
import logging
from typing import Optional
import redis.asyncio as aioredis
import yfinance as yf

logger = logging.getLogger(__name__)

FUNDAMENTALS_TTL = 4 * 3600   # 4 hours
HISTORY_TTL = 24 * 3600        # 24 hours
INDEX_TTL = 24 * 3600          # 24 hours


def _nse_ticker(symbol: str) -> str:
    """Convert NSE symbol to Yahoo Finance ticker."""
    clean = symbol.replace('-EQ', '').replace('-BE', '').strip()
    return f"{clean}.NS"


def _index_ticker(index: str) -> str:
    mapping = {
        'NIFTY50': '^NSEI',
        'SENSEX': '^BSESN',
        'NIFTYNEXT50': '^NSMIDCP',
    }
    return mapping.get(index, '^NSEI')


class MarketDataAdapter:
    def __init__(self, redis_url: str = 'redis://localhost:6379'):
        self._redis: Optional[aioredis.Redis] = None
        self._redis_url = redis_url

    async def _get_redis(self) -> aioredis.Redis:
        if not self._redis:
            self._redis = aioredis.from_url(self._redis_url)
        return self._redis

    async def _cache_get(self, key: str) -> Optional[dict]:
        try:
            r = await self._get_redis()
            val = await r.get(f"invex:{key}")
            return json.loads(val) if val else None
        except Exception:
            return None

    async def _cache_set(self, key: str, data: dict, ttl: int):
        try:
            r = await self._get_redis()
            await r.setex(f"invex:{key}", ttl, json.dumps(data))
        except Exception:
            pass

    async def get_fundamentals(self, symbol: str) -> Optional[dict]:
        """
        Returns: {pe, pb, market_cap_cr, beta, week52_high, week52_low,
                  sector, industry, dividend_yield, roe}
        Returns None if data unavailable — never raises.
        """
        cache_key = f"fundamentals:{symbol}"
        cached = await self._cache_get(cache_key)
        if cached:
            return cached

        try:
            ticker = _nse_ticker(symbol)
            loop = asyncio.get_event_loop()
            info = await loop.run_in_executor(
                None, lambda: yf.Ticker(ticker).info
            )

            if not info or info.get('regularMarketPrice') is None:
                logger.warning(f"[MARKET] No data for {symbol} ({ticker})")
                return None

            market_cap = info.get('marketCap', 0)
            data = {
                'pe': round(info.get('trailingPE', 0) or 0, 2),
                'pb': round(info.get('priceToBook', 0) or 0, 2),
                'market_cap_cr': round(market_cap / 1e7, 0) if market_cap else None,
                'beta': round(info.get('beta', 1) or 1, 2),
                'week52_high': info.get('fiftyTwoWeekHigh'),
                'week52_low': info.get('fiftyTwoWeekLow'),
                'sector': info.get('sector', ''),
                'industry': info.get('industry', ''),
                'dividend_yield': round((info.get('dividendYield', 0) or 0) * 100, 2),
                'roe': round((info.get('returnOnEquity', 0) or 0) * 100, 2),
                'fetched_at': int(time.time()),
            }

            if data['market_cap_cr']:
                if data['market_cap_cr'] >= 20000:
                    data['market_cap_category'] = 'Large Cap'
                elif data['market_cap_cr'] >= 5000:
                    data['market_cap_category'] = 'Mid Cap'
                else:
                    data['market_cap_category'] = 'Small Cap'
            else:
                data['market_cap_category'] = None

            await self._cache_set(cache_key, data, FUNDAMENTALS_TTL)
            logger.info(f"[MARKET] Fetched fundamentals for {symbol}: PE={data['pe']}")
            return data

        except Exception as e:
            logger.warning(f"[MARKET] Failed to fetch fundamentals for {symbol}: {e}")
            return None

    async def get_price_history(
        self, symbol: str, days: int = 200
    ) -> Optional[list]:
        """
        Returns list of {date, open, high, low, close, volume}
        Sorted oldest first. Used for DMA and RSI calculations.
        """
        cache_key = f"history:{symbol}:{days}"
        cached = await self._cache_get(cache_key)
        if cached:
            return cached

        try:
            ticker = _nse_ticker(symbol)
            period = f"{days}d"
            loop = asyncio.get_event_loop()
            df = await loop.run_in_executor(
                None,
                lambda: yf.download(ticker, period=period, progress=False, auto_adjust=True)
            )

            if df is None or df.empty:
                return None

            records = []
            for date_idx, row in df.iterrows():
                records.append({
                    'date': str(date_idx.date()),
                    'open': round(float(row['Open'].iloc[0] if hasattr(row['Open'], 'iloc') else row['Open']), 2),
                    'high': round(float(row['High'].iloc[0] if hasattr(row['High'], 'iloc') else row['High']), 2),
                    'low': round(float(row['Low'].iloc[0] if hasattr(row['Low'], 'iloc') else row['Low']), 2),
                    'close': round(float(row['Close'].iloc[0] if hasattr(row['Close'], 'iloc') else row['Close']), 2),
                    'volume': int(row['Volume'].iloc[0] if hasattr(row['Volume'], 'iloc') else row['Volume']),
                })

            await self._cache_set(cache_key, records, HISTORY_TTL)
            return records

        except Exception as e:
            logger.warning(f"[MARKET] Failed history for {symbol}: {e}")
            return None

    async def get_index_history(
        self, index: str = 'NIFTY50', days: int = 365
    ) -> Optional[list]:
        """Nifty 50 or other index history for benchmark comparison."""
        cache_key = f"index:{index}:{days}"
        cached = await self._cache_get(cache_key)
        if cached:
            return cached

        try:
            ticker = _index_ticker(index)
            loop = asyncio.get_event_loop()
            df = await loop.run_in_executor(
                None,
                lambda: yf.download(ticker, period=f"{days}d", progress=False, auto_adjust=True)
            )

            if df is None or df.empty:
                return None

            records = [
                {'date': str(d.date()), 'close': round(float(r['Close']), 2)}
                for d, r in df.iterrows()
            ]

            await self._cache_set(cache_key, records, INDEX_TTL)
            return records

        except Exception as e:
            logger.warning(f"[MARKET] Failed index history for {index}: {e}")
            return None

    async def prefetch_portfolio(self, symbols: list):
        """
        Background prefetch for all portfolio symbols.
        Call after portfolio refresh — warms the fundamentals cache.
        Non-blocking: fire and forget.
        """
        logger.info(f"[MARKET] Prefetching fundamentals for {len(symbols)} symbols")
        for symbol in symbols:
            try:
                await self.get_fundamentals(symbol)
                await asyncio.sleep(0.5)  # Rate limit: ~2 req/sec
            except Exception:
                pass
        logger.info(f"[MARKET] Prefetch complete for {len(symbols)} symbols")

    async def compute_dma(
        self, symbol: str, periods: list = None
    ) -> Optional[dict]:
        """
        Returns {dma_20, dma_50, dma_200, current_price,
                 above_20, above_50, above_200}
        """
        if periods is None:
            periods = [20, 50, 200]
        history = await self.get_price_history(symbol, days=max(periods) + 10)
        if not history or len(history) < max(periods):
            return None

        closes = [h['close'] for h in history]
        current = closes[-1]
        result: dict = {'current_price': current}

        for p in periods:
            if len(closes) >= p:
                dma = round(sum(closes[-p:]) / p, 2)
                result[f'dma_{p}'] = dma
                result[f'above_{p}'] = current > dma

        return result

    async def compute_rsi(
        self, symbol: str, period: int = 14
    ) -> Optional[float]:
        """Standard 14-period RSI."""
        history = await self.get_price_history(symbol, days=period * 3)
        if not history or len(history) < period + 1:
            return None

        closes = [h['close'] for h in history]
        deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]

        gains = [max(d, 0) for d in deltas[-period:]]
        losses = [abs(min(d, 0)) for d in deltas[-period:]]

        avg_gain = sum(gains) / period
        avg_loss = sum(losses) / period

        if avg_loss == 0:
            return 100.0

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return round(rsi, 1)


# Singleton
market_data = MarketDataAdapter()
