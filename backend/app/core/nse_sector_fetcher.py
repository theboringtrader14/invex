"""
Fetches symbol→sector mapping from NSE's public equity-master API.
Cached in app.state.sector_map at startup; static SECTOR_MAP is the fallback.
"""
import logging
import httpx

logger = logging.getLogger(__name__)

NSE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/",
}

# Suffix variants that brokers append to base symbols
_SUFFIXES = ("-EQ", "-BE", "-BL", "-IL", "-SM")


def _clean(symbol: str) -> str:
    s = symbol.upper().strip()
    for suf in _SUFFIXES:
        if s.endswith(suf):
            return s[: -len(suf)]
    return s


async def fetch_nse_sectors() -> dict[str, str]:
    """
    Fetch symbol→sector from NSE equity-master.
    NSE returns:  { "Industry Name": ["SYM1", "SYM2", ...], ... }
    We invert to: { "SYM1": "Industry Name", ... }
    """
    try:
        async with httpx.AsyncClient(
            headers=NSE_HEADERS,
            timeout=20,
            follow_redirects=True,
        ) as client:
            # Seed cookies by hitting the homepage first
            await client.get("https://www.nseindia.com")
            r = await client.get("https://www.nseindia.com/api/equity-master")
            if r.status_code == 200:
                data = r.json()
                mapping: dict[str, str] = {}
                for industry, symbols in data.items():
                    if isinstance(symbols, list):
                        for sym in symbols:
                            mapping[_clean(str(sym))] = industry
                logger.info(f"[NSE] Sector map loaded: {len(mapping)} symbols")
                return mapping
            else:
                logger.warning(f"[NSE] equity-master returned {r.status_code}")
    except Exception as e:
        logger.warning(f"[NSE] Sector fetch failed: {e}")
    return {}


# Module-level cache — populated once at startup
_sector_cache: dict[str, str] = {}


async def get_sector_map() -> dict[str, str]:
    """Return cached NSE sector map, fetching if not yet loaded."""
    global _sector_cache
    if not _sector_cache:
        _sector_cache = await fetch_nse_sectors()
    return _sector_cache


def get_sector_from_map(symbol: str, sector_map: dict[str, str]) -> str:
    """Resolve sector from the NSE map, falling back to static SECTOR_MAP."""
    clean = _clean(symbol)
    if sector_map:
        result = sector_map.get(clean)
        if result:
            return result
    # Static fallback
    from app.core.sector_map import SECTOR_MAP, DEFAULT_SECTOR
    return SECTOR_MAP.get(clean, DEFAULT_SECTOR)
