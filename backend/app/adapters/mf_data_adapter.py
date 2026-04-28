"""
Mutual Fund data adapter using mfapi.in (free, no auth required).
API: https://api.mfapi.in/mf/{scheme_code}
Search: https://api.mfapi.in/mf/search?q={fund_name}
"""
import asyncio
import json
import time
import logging
from typing import Optional
import httpx
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

MF_TTL = 6 * 3600    # 6 hours
NAV_TTL = 24 * 3600  # 24 hours


class MFDataAdapter:
    BASE = "https://api.mfapi.in/mf"

    def __init__(self, redis_url: str = 'redis://localhost:6379'):
        self._redis_url = redis_url
        self._redis: Optional[aioredis.Redis] = None

    async def _get_redis(self) -> aioredis.Redis:
        if not self._redis:
            self._redis = aioredis.from_url(self._redis_url)
        return self._redis

    async def _cache_get(self, key: str):
        try:
            r = await self._get_redis()
            val = await r.get(f"invex:mf:{key}")
            return json.loads(val) if val else None
        except Exception:
            return None

    async def _cache_set(self, key: str, data, ttl: int):
        try:
            r = await self._get_redis()
            await r.setex(f"invex:mf:{key}", ttl, json.dumps(data))
        except Exception:
            pass

    async def search_scheme(self, fund_name: str) -> Optional[dict]:
        """Find scheme code by fund name fragment."""
        cache_key = f"search:{fund_name[:20]}"
        cached = await self._cache_get(cache_key)
        if cached:
            return cached

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    f"{self.BASE}/search",
                    params={'q': fund_name[:30]}
                )
                results = r.json()

            if not results:
                return None

            match = results[0]
            data = {
                'scheme_code': match.get('schemeCode'),
                'scheme_name': match.get('schemeName'),
            }
            await self._cache_set(cache_key, data, MF_TTL)
            return data

        except Exception as e:
            logger.warning(f"[MF] Search failed for '{fund_name}': {e}")
            return None

    async def get_scheme_details(self, scheme_code: int) -> Optional[dict]:
        """
        Returns: {scheme_name, fund_house, category, nav, nav_date}
        """
        cache_key = f"details:{scheme_code}"
        cached = await self._cache_get(cache_key)
        if cached:
            return cached

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(f"{self.BASE}/{scheme_code}")
                data = r.json()

            meta = data.get('meta', {})
            nav_data = data.get('data', [{}])[0]

            result = {
                'scheme_code': scheme_code,
                'scheme_name': meta.get('scheme_name', ''),
                'fund_house': meta.get('fund_house', ''),
                'category': meta.get('scheme_category', ''),
                'scheme_type': meta.get('scheme_type', ''),
                'nav': float(nav_data.get('nav', 0)),
                'nav_date': nav_data.get('date', ''),
                'fetched_at': int(time.time()),
            }

            await self._cache_set(cache_key, result, MF_TTL)
            return result

        except Exception as e:
            logger.warning(f"[MF] Details failed for scheme {scheme_code}: {e}")
            return None

    async def get_nav_history(
        self, scheme_code: int, days: int = 365
    ) -> Optional[list]:
        """Returns [{date, nav}] sorted oldest first, for return calculation."""
        cache_key = f"nav_history:{scheme_code}:{days}"
        cached = await self._cache_get(cache_key)
        if cached:
            return cached

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(f"{self.BASE}/{scheme_code}")
                data = r.json()

            nav_records = data.get('data', [])
            # mfapi returns newest first — reverse it
            records = []
            for item in reversed(nav_records[:days]):
                try:
                    records.append({
                        'date': item['date'],
                        'nav': float(item['nav']),
                    })
                except (KeyError, ValueError):
                    continue

            if not records:
                return None

            await self._cache_set(cache_key, records, NAV_TTL)
            return records

        except Exception as e:
            logger.warning(f"[MF] NAV history failed for {scheme_code}: {e}")
            return None

    async def compute_returns(self, scheme_code: int) -> dict:
        """Returns {return_1y_pct, return_3y_pct} or None values."""
        history = await self.get_nav_history(scheme_code, days=1100)
        if not history or len(history) < 2:
            return {'return_1y_pct': None, 'return_3y_pct': None}

        current_nav = history[-1]['nav']
        result = {}

        if len(history) >= 252:
            nav_1y_ago = history[-252]['nav']
            result['return_1y_pct'] = round(
                (current_nav - nav_1y_ago) / nav_1y_ago * 100, 2
            )
        else:
            result['return_1y_pct'] = None

        if len(history) >= 756:
            nav_3y_ago = history[-756]['nav']
            result['return_3y_pct'] = round(
                ((current_nav / nav_3y_ago) ** (1 / 3) - 1) * 100, 2
            )
        else:
            result['return_3y_pct'] = None

        return result


    async def enrich_mf_holdings(self, mf_holdings: list) -> list:
        """
        Enrich a list of MF holding dicts with category, sub_category, return_1y, return_3y.
        Uses fund_name search to resolve scheme_code, then fetches meta + NAV history.
        Runs concurrently across all holdings.
        """
        async def _resolve_scheme(fund_name: str, isin: str | None) -> dict | None:
            """Resolve scheme code via name search, then ISIN fallback, then short-name fallback."""
            # 1. Full name search ([:30])
            scheme = await self.search_scheme(fund_name)
            if scheme and scheme.get('scheme_code'):
                return scheme

            # 2. ISIN search — mfapi.in indexes by ISIN
            if isin:
                scheme = await self.search_scheme(isin)
                if scheme and scheme.get('scheme_code'):
                    logger.info(f"[MF] Resolved '{fund_name}' via ISIN {isin}")
                    return scheme

            # 3. Truncated name (drop plan/option suffix noise)
            short = fund_name.split(' - ')[0].strip()[:40]
            if short != fund_name[:30]:
                scheme = await self.search_scheme(short)
                if scheme and scheme.get('scheme_code'):
                    logger.info(f"[MF] Resolved '{fund_name}' via short name '{short}'")
                    return scheme

            return None

        async def _enrich_one(mf: dict) -> dict:
            fund_name = mf.get('fund_name', '')
            isin = mf.get('isin')
            if not fund_name:
                return mf
            try:
                scheme = await _resolve_scheme(fund_name, isin)
                if not scheme:
                    logger.debug(f"[MF] No scheme found for '{fund_name}' (isin={isin})")
                    return mf
                scheme_code = scheme.get('scheme_code')
                if not scheme_code:
                    return mf

                details, returns = await asyncio.gather(
                    self.get_scheme_details(scheme_code),
                    self.compute_returns(scheme_code),
                )
                if details:
                    mf['category'] = details.get('category')
                    mf['sub_category'] = None   # mfapi.in has no sub_category field
                if returns:
                    mf['return_1y'] = returns.get('return_1y_pct')
                    mf['return_3y'] = returns.get('return_3y_pct')
            except Exception:
                pass
            return mf

        enriched = await asyncio.gather(*[_enrich_one(mf) for mf in mf_holdings])
        return list(enriched)


# Singleton
mf_data = MFDataAdapter()
