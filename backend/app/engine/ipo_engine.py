"""IPO YTR (Yearly Trend Range) Engine."""
import httpx
import logging

logger = logging.getLogger(__name__)

NSE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.nseindia.com',
    'Origin': 'https://www.nseindia.com',
}


async def fetch_nse_quote(symbol: str) -> dict:
    """Fetch equity quote from NSE public API. Returns raw priceInfo dict."""
    async with httpx.AsyncClient(headers=NSE_HEADERS, timeout=15, follow_redirects=True) as client:
        # Warm up session (NSE requires cookie)
        await client.get('https://www.nseindia.com', timeout=10)
        r = await client.get(
            f'https://www.nseindia.com/api/quote-equity?symbol={symbol.upper()}'
        )
        r.raise_for_status()
        return r.json()


def compute_ytr_levels(dopen: float, prev_high: float, prev_low: float, ltp: float) -> dict:
    """Compute all 8 YTR levels and determine signal."""
    PR = prev_high - prev_low
    if PR <= 0:
        return {'error': 'Invalid price range — PR is zero or negative'}

    levels = {
        'dopen': dopen,
        'PR': round(PR, 2),
        'LPP': round(dopen - PR * 0.198, 2),
        'UPP': round(dopen + PR * 0.198, 2),
        'LPP1': round(dopen - PR * 0.396, 2),
        'UPP1': round(dopen + PR * 0.396, 2),
        'PROFITUP': round(dopen + PR * 0.594, 2),
        'PROFITLP': round(dopen - PR * 0.594, 2),
        'PROFITUP1': round(dopen + PR * 0.792, 2),
        'PROFITLP1': round(dopen - PR * 0.792, 2),
        'ltp': ltp,
    }

    if ltp > levels['UPP1']:
        signal = 'STRONG_BULLISH'
    elif ltp > levels['UPP']:
        signal = 'BULLISH'
    elif ltp < levels['LPP1']:
        signal = 'STRONG_BEARISH'
    elif ltp < levels['LPP']:
        signal = 'BEARISH'
    else:
        signal = 'NEUTRAL'

    levels['signal'] = signal
    levels['sl'] = levels['LPP']
    levels['target'] = levels['PROFITUP']
    return levels


async def get_ytr_for_symbol(symbol: str) -> dict:
    """Fetch NSE data and return full YTR analysis for a symbol."""
    try:
        data = await fetch_nse_quote(symbol)
    except Exception as e:
        logger.warning(f"[YTR] NSE fetch failed for {symbol}: {e}")
        return {'error': str(e), 'symbol': symbol}

    price_info = data.get('priceInfo', {})
    week52 = price_info.get('weekHighLow', {})

    dopen = float(price_info.get('open', 0) or 0)
    ltp = float(price_info.get('lastPrice', 0) or 0)
    prev_high = float(week52.get('max', 0) or 0)
    prev_low = float(week52.get('min', 0) or 0)

    if dopen <= 0 or prev_high <= 0 or prev_low <= 0:
        return {
            'error': 'Incomplete price data from NSE',
            'symbol': symbol,
            'raw_open': dopen,
            'raw_52w_high': prev_high,
            'raw_52w_low': prev_low,
        }

    result = compute_ytr_levels(dopen, prev_high, prev_low, ltp)
    result['symbol'] = symbol
    return result
