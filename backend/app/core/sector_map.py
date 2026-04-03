"""
Static sector classification for common NSE symbols.
Used to enrich holdings API response without a live data dependency.
Strips -EQ / -BE broker suffixes before lookup.
"""

SECTOR_MAP: dict[str, str] = {
    # ETFs / Index Funds
    "BANKBEES":    "Banking & Finance",
    "ITBEES":      "Technology",
    "NIFTYBEES":   "Index Fund",
    "CPSEETF":     "Index Fund",
    "JUNIORBEES":  "Index Fund",
    "MAFANG":      "Technology",
    "MON100":      "Index Fund",
    # Energy
    "RELIANCE":    "Energy",
    "ONGC":        "Energy",
    "ADANIENSOL":  "Energy",
    # Banking & Finance
    "HDFCBANK":    "Banking & Finance",
    "HDFCBANKLTD": "Banking & Finance",
    "ICICIBANK":   "Banking & Finance",
    "SBIN":        "Banking & Finance",
    "KOTAKBANK":   "Banking & Finance",
    "AXISBANK":    "Banking & Finance",
    "BAJFINANCE":  "Banking & Finance",
    "BAJAJFINSV":  "Banking & Finance",
    # Insurance
    "ICICIGI":     "Insurance",
    "HDFCLIFE":    "Insurance",
    "SBILIFE":     "Insurance",
    # Technology
    "INFY":        "Technology",
    "TCS":         "Technology",
    "WIPRO":       "Technology",
    "HCLTECH":     "Technology",
    # Telecom
    "BHARTIARTL":  "Telecom",
    # FMCG
    "HINDUNILVR":  "FMCG",
    "ITC":         "FMCG",
    "NESTLEIND":   "FMCG",
    # Consumer Goods
    "ASIANPAINT":  "Consumer Goods",
    "TITAN":       "Consumer Goods",
    "APEX":        "Consumer Goods",
    # Automobile
    "MARUTI":      "Automobile",
    "TATAMOTORS":  "Automobile",
    # Infrastructure
    "LT":          "Infrastructure",
    "ADANIPORTS":  "Infrastructure",
    # Materials
    "ULTRACEMCO":  "Materials",
    "TATASTEEL":   "Materials",
    "JSWSTEEL":    "Materials",
    # Utilities
    "POWERGRID":   "Utilities",
    "NTPC":        "Utilities",
    # Pharma / Healthcare
    "SUNPHARMA":   "Pharma",
    "DRREDDY":     "Pharma",
    "CIPLA":       "Pharma",
    "LAURUSLABS":  "Pharma",
    "JLHL":        "Healthcare",
    # Defence
    "BDL":         "Defence",
    "MAZDOCK":     "Defence",
    # Automobile (additional)
    "ASHOKLEY":    "Automobile",
    "OLECTRA":     "Automobile",
    "SONACOMS":    "Automobile",
    "SUPRAJIT":    "Automobile",
    "TMCV":        "Automobile",
    "TMPV":        "Automobile",
    # Energy (additional)
    "IOC":         "Energy",
    "TATAPOWER":   "Energy",
    # Banking & Finance (additional)
    "BAJAJHFL":    "Banking & Finance",
    "CHOLAFIN":    "Banking & Finance",
    "JIOFIN":      "Banking & Finance",
    "YESBANK":     "Banking & Finance",
    # Consumer Goods (additional)
    "ITCHOTELS":   "Consumer Goods",
    # Index / Commodities ETF
    "GOLDBEES":    "Index Fund",
    "SILVERBEES":  "Commodities",
    # Infrastructure (additional)
    "JSWINFRA":    "Infrastructure",
    "TITAGARH":    "Infrastructure",
    # Materials (additional)
    "WELCORP":     "Materials",
    # Technology (additional)
    "TIMETECHNO":  "Technology",
}

DEFAULT_SECTOR = "Others"

# Broker suffixes to strip before lookup
_SUFFIXES = ("-EQ", "-BE", "-BL", "-IL", "-SM")


def get_sector(symbol: str) -> str:
    clean = symbol.upper().strip()
    for suffix in _SUFFIXES:
        if clean.endswith(suffix):
            clean = clean[: -len(suffix)]
            break
    return SECTOR_MAP.get(clean, DEFAULT_SECTOR)
