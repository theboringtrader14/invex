import asyncio
import logging
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger(__name__)

NIFTY_SYMBOL = 'NIFTY50'


async def fetch_symbol_history(symbol: str, days: int = 1825):
    try:
        ticker_sym = '^NSEI' if symbol == NIFTY_SYMBOL else f'{symbol}.NS'
        loop = asyncio.get_event_loop()

        def _fetch():
            import yfinance as yf
            start = (date.today() - timedelta(days=days)).isoformat()
            hist = yf.Ticker(ticker_sym).history(start=start)
            if hist.empty:
                return []
            return [
                {'date': idx.date(), 'close': float(row['Close']),
                 'open': float(row['Open']), 'high': float(row['High']),
                 'low': float(row['Low']), 'volume': int(row['Volume'])}
                for idx, row in hist.iterrows()
            ]

        return await loop.run_in_executor(None, _fetch)
    except Exception as e:
        logger.error(f"fetch_symbol_history {symbol}: {e}")
        return []


async def get_tracked_symbols(db: AsyncSession) -> list[str]:
    result = await db.execute(text(
        "SELECT DISTINCT symbol FROM invex_holdings WHERE symbol NOT LIKE 'INF%'"
    ))
    symbols = [
        row[0].replace('-EQ', '').replace('-BE', '').replace('.NS', '').strip()
        for row in result.fetchall()
    ]
    return list(set(symbols)) + [NIFTY_SYMBOL]


async def backfill_symbol(db: AsyncSession, symbol: str, days: int = 1825):
    history = await fetch_symbol_history(symbol, days)
    if not history:
        logger.warning(f"No history for {symbol}")
        return 0
    count = 0
    for record in history:
        try:
            await db.execute(text('''
                INSERT INTO invex_price_history (symbol, date, open, high, low, close, volume)
                VALUES (:sym, :date, :open, :high, :low, :close, :vol)
                ON CONFLICT (symbol, date) DO NOTHING
            '''), {
                'sym': symbol, 'date': record['date'],
                'open': record.get('open'), 'high': record.get('high'),
                'low': record.get('low'), 'close': record['close'],
                'vol': record.get('volume', 0)
            })
            count += 1
        except Exception:
            pass
    await db.commit()
    logger.info(f"Stored {count} records for {symbol}")
    return count


async def backfill_all(db: AsyncSession):
    symbols = await get_tracked_symbols(db)
    logger.info(f"Backfilling price history for {len(symbols)} symbols")
    for sym in symbols:
        await backfill_symbol(db, sym)
        await asyncio.sleep(1.0)
