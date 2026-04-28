import pdfplumber
import re
from datetime import datetime
from typing import Optional

DATE_PATTERN = re.compile(r'\b(\d{2}-[A-Za-z]{3}-\d{4})\b')
AMOUNT_PATTERN = re.compile(r'[\d,]+\.\d+')

def _parse_date(s: str) -> Optional[str]:
    for fmt in ('%d-%b-%Y', '%d/%m/%Y', '%d-%m-%Y'):
        try:
            return str(datetime.strptime(s.strip(), fmt).date())
        except ValueError:
            continue
    return None


def parse_cams_cas(file_path: str, password: str = '') -> dict:
    """
    Parse CAMS CAS / TXN PDF. Password = investor's PAN (e.g. 'ABCDE1234F').
    Returns structured dict with mf_holdings and mf_transactions.
    """
    result = {
        'account_holder': None,
        'pan': None,
        'period': {},
        'mf_holdings': [],      # [{folio, fund_name, isin, units, nav, value}]
        'mf_transactions': [],  # [{date, folio, fund_name, isin, txn_type, units, nav, amount}]
        'errors': []
    }

    try:
        open_kwargs = {'password': password} if password else {}
        with pdfplumber.open(file_path, **open_kwargs) as pdf:
            # Try text extraction with bbox grouping for columnar PDFs
            pages_text = []
            for page in pdf.pages:
                text = page.extract_text(x_tolerance=3, y_tolerance=3)
                if not text:
                    # Fallback: extract words and reconstruct lines sorted by y-position
                    words = page.extract_words(x_tolerance=5, y_tolerance=3)
                    if words:
                        lines: dict[int, list] = {}
                        for w in words:
                            y = round(float(w['top']), 0)
                            lines.setdefault(y, []).append(w['text'])
                        text = '\n'.join(' '.join(lines[y]) for y in sorted(lines))
                pages_text.append(text or '')
            full_text = '\n'.join(pages_text)

    except Exception as e:
        result['errors'].append(f'PDF open error: {e}')
        return result

    if not full_text.strip():
        result['errors'].append('PDF produced no text — check password/PAN or PDF format')
        return result

    # Extract account holder
    for pat in [r'Name\s*:\s*(.+)', r'Investor\s+Name\s*:\s*(.+)']:
        m = re.search(pat, full_text, re.I)
        if m:
            result['account_holder'] = m.group(1).strip()
            break

    # Extract PAN
    m = re.search(r'PAN\s*[:\-]?\s*([A-Z]{5}\d{4}[A-Z])', full_text)
    if m:
        result['pan'] = m.group(1)

    # Extract period
    m = re.search(r'(\d{2}[-/][A-Za-z]{3}[-/]\d{4})\s+to\s+(\d{2}[-/][A-Za-z]{3}[-/]\d{4})', full_text)
    if m:
        result['period'] = {'from': m.group(1), 'to': m.group(2)}

    # ── Parse folio blocks ──────────────────────────────────────────────────
    # Handle: "Folio No:", "Folio No.", "Folio:", "Folio Number:"
    folio_blocks = re.split(r'(?=Folio\s+(?:No\.?|Number)\s*[:\.]?\s*\S)', full_text, flags=re.I)

    for block in folio_blocks:
        if not re.search(r'Folio\s+(?:No\.?|Number)', block, re.I):
            continue

        # Extract folio number
        folio_m = re.search(r'Folio\s+(?:No\.?|Number)\s*[:\.]?\s*(\S+)', block, re.I)
        folio = folio_m.group(1).rstrip('/.') if folio_m else 'UNKNOWN'

        # Extract fund name — first meaningful line after folio line
        fund_name = None
        isin = None
        lines = [l.strip() for l in block.split('\n') if l.strip()]
        folio_line_seen = False
        for line in lines[:15]:
            if re.search(r'Folio\s+(?:No\.?|Number)', line, re.I):
                folio_line_seen = True
                continue
            if not folio_line_seen:
                continue
            if re.match(r'^(PAN|ISIN|Opening|Closing|Date|Registrar|Advisor|Sr\.?\s*No)', line, re.I):
                continue
            if re.search(r'ISIN\s*[:\-]', line, re.I):
                isin_m = re.search(r'([A-Z]{2}[A-Z0-9]{10})', line)
                if isin_m:
                    isin = isin_m.group(1)
                continue
            if len(line) > 8 and not fund_name:
                fund_name = line
                break

        # Fallback: look for "Fund:" label
        m = re.search(r'Fund\s*:\s*(.+)', block, re.I)
        if m and not fund_name:
            fund_name = m.group(1).strip()

        # Extract ISIN
        if not isin:
            isin_m = re.search(r'ISIN\s*[:\-]?\s*([A-Z]{2}[A-Z0-9]{10})', block, re.I)
            if isin_m:
                isin = isin_m.group(1)

        # ── Closing balance → holdings ──────────────────────────────────────
        closing_units = closing_nav = closing_value = None

        cb_pats = [
            r'Closing\s+Balance\D{0,20}?([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)',
            r'Closing\s+Balance\D{0,60}?([\d,]+\.\d+)\s+Units?',
        ]
        for pat in cb_pats:
            cb_m = re.search(pat, block, re.I | re.S)
            if cb_m:
                closing_units = float(cb_m.group(1).replace(',', ''))
                if cb_m.lastindex >= 3:
                    closing_nav   = float(cb_m.group(2).replace(',', ''))
                    closing_value = float(cb_m.group(3).replace(',', ''))
                break

        if fund_name and closing_units is not None:
            result['mf_holdings'].append({
                'folio': folio,
                'fund_name': fund_name,
                'isin': isin,
                'units': closing_units,
                'nav': closing_nav,
                'value': closing_value,
            })

        # ── Transactions ────────────────────────────────────────────────────
        # CAMS TXN statement line format variants:
        #   01-Apr-2025  SIP - Growth  5,000.00  172.12  29.073  345.67
        #   01-Apr-2025  Purchase      5,000.00  172.12  345.67
        txn_patterns = [
            # 6-col: date desc amount nav units balance
            re.compile(
                r'(\d{2}-[A-Za-z]{3}-\d{4})\s+'
                r'(.+?)\s+'
                r'([\d,]+\.\d+)\s+'
                r'([\d,]+\.\d+)\s+'
                r'([\d,]+\.\d+)\s+'
                r'([\d,]+\.\d+)',
                re.MULTILINE
            ),
            # 5-col: date desc nav units balance
            re.compile(
                r'(\d{2}-[A-Za-z]{3}-\d{4})\s+'
                r'(.+?)\s+'
                r'([\d,]+\.\d+)\s+'
                r'([\d,]+\.\d+)\s+'
                r'([\d,]+\.\d+)',
                re.MULTILINE
            ),
        ]

        txns_found = False
        for pattern in txn_patterns:
            for m in pattern.finditer(block):
                groups = m.groups()
                date_str = groups[0]
                desc = groups[1].strip()

                if re.search(r'closing|opening|unit\s*balance', desc, re.I):
                    continue

                txn_type = 'PURCHASE'
                if re.search(r'redeem|redemption', desc, re.I):
                    txn_type = 'REDEMPTION'
                elif re.search(r'switch[\s-]?out', desc, re.I):
                    txn_type = 'SWITCH_OUT'
                elif re.search(r'switch[\s-]?in', desc, re.I):
                    txn_type = 'SWITCH_IN'
                elif re.search(r'dividend', desc, re.I):
                    txn_type = 'DIVIDEND'
                elif re.search(r'\bsip\b|systematic\s+investment', desc, re.I):
                    txn_type = 'SIP'

                parsed_date = _parse_date(date_str)
                if not parsed_date:
                    continue

                try:
                    nums = [float(g.replace(',', '')) for g in groups[2:]]
                    # nav is third-to-last, units is second-to-last
                    if len(nums) >= 3:
                        nav_val   = nums[-3]
                        units_val = nums[-2]
                    elif len(nums) == 2:
                        nav_val   = nums[0]
                        units_val = nums[1]
                    else:
                        continue

                    result['mf_transactions'].append({
                        'date': parsed_date,
                        'folio': folio,
                        'fund_name': fund_name,
                        'isin': isin,
                        'txn_type': txn_type,
                        'units': units_val,
                        'nav': nav_val,
                        'description': desc,
                    })
                    txns_found = True
                except (ValueError, IndexError):
                    continue

            if txns_found:
                break

    if not result['mf_transactions'] and not result['mf_holdings']:
        snippet = full_text[:800].replace('\n', ' | ')
        result['errors'].append(
            f'No data parsed. Extracted text (first 800 chars): "{snippet}"'
        )

    return result


if __name__ == '__main__':
    import json, sys
    path = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else ''
    r = parse_cams_cas(path, password)
    print(json.dumps(r, indent=2, default=str))
