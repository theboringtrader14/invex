import pdfplumber
import re
from datetime import datetime
from typing import Optional

DATE_PATTERN = re.compile(r'\b(\d{2}-[A-Za-z]{3}-\d{4})\b')
AMOUNT_PATTERN = re.compile(r'[\d,]+\.\d+')

def parse_cams_cas(file_path: str, password: str = '') -> dict:
    """
    Parse CAMS CAS TXN PDF. Password = investor's PAN (e.g. 'ABCDE1234F').
    Returns structured dict with mf_holdings and mf_transactions.
    """
    result = {
        'account_holder': None,
        'pan': None,
        'period': {},
        'mf_holdings': [],      # [{folio, fund_name, isin, units, nav, value, account_id}]
        'mf_transactions': [],  # [{date, folio, fund_name, isin, txn_type, units, nav, amount}]
        'errors': []
    }

    try:
        open_kwargs = {'password': password} if password else {}
        with pdfplumber.open(file_path, **open_kwargs) as pdf:
            full_text = '\n'.join(
                (page.extract_text() or '') for page in pdf.pages
            )

        # Extract account holder
        m = re.search(r'Name\s*:\s*(.+)', full_text, re.I)
        if m: result['account_holder'] = m.group(1).strip()

        # Extract PAN
        m = re.search(r'PAN\s*:\s*([A-Z]{5}\d{4}[A-Z])', full_text)
        if m: result['pan'] = m.group(1)

        # Extract period
        m = re.search(r'(\d{2}-[A-Za-z]{3}-\d{4})\s+to\s+(\d{2}-[A-Za-z]{3}-\d{4})', full_text)
        if m:
            result['period'] = {'from': m.group(1), 'to': m.group(2)}

        # Parse MF sections — each folio block
        # Split by "Folio No:" sections
        folio_blocks = re.split(r'(?=Folio\s+No\s*[:\.])', full_text, flags=re.I)

        for block in folio_blocks:
            if not re.search(r'Folio\s+No\s*[:\.]', block, re.I):
                continue

            # Extract folio
            folio_m = re.search(r'Folio\s+No\s*[:\.]?\s*(\S+)', block, re.I)
            folio = folio_m.group(1).rstrip('/') if folio_m else 'UNKNOWN'

            # Extract fund name (first non-empty line after folio)
            fund_name = None
            isin = None
            lines = block.split('\n')
            for i, line in enumerate(lines[:10]):
                if re.search(r'Folio', line, re.I): continue
                if re.search(r'Fund\s*:', line, re.I):
                    fund_name = re.sub(r'^Fund\s*:\s*', '', line, flags=re.I).strip()
                    break
                # Fund name may be on the next line after folio
                clean = line.strip()
                if clean and not re.match(r'^(PAN|ISIN|Opening|Closing|Date)', clean, re.I):
                    if not fund_name and len(clean) > 10:
                        fund_name = clean

            # Extract ISIN
            isin_m = re.search(r'ISIN\s*[:\.]?\s*([A-Z]{2}[A-Z0-9]{10})', block, re.I)
            if isin_m: isin = isin_m.group(1)

            # Parse transactions — look for date lines
            # Format: DD-Mon-YYYY Description Amount(units) NAV Balance
            txn_pattern = re.compile(
                r'(\d{2}-[A-Za-z]{3}-\d{4})\s+'  # date
                r'(.+?)\s+'                          # description
                r'([\d,]+\.\d+)\s+'                 # amount or units
                r'([\d,]+\.\d+)\s+'                 # nav
                r'([\d,]+\.\d+)',                    # balance
                re.MULTILINE
            )

            closing_units = None
            closing_nav = None
            closing_value = None

            # Closing balance
            cb_m = re.search(r'Closing\s+Balance.*?([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)', block, re.I | re.S)
            if cb_m:
                closing_units = float(cb_m.group(1).replace(',', ''))
                closing_nav   = float(cb_m.group(2).replace(',', ''))
                closing_value = float(cb_m.group(3).replace(',', ''))

            if fund_name and closing_units is not None:
                result['mf_holdings'].append({
                    'folio': folio,
                    'fund_name': fund_name,
                    'isin': isin,
                    'units': closing_units,
                    'nav': closing_nav,
                    'value': closing_value,
                })

            # Transactions
            for m in txn_pattern.finditer(block):
                date_str, desc, col3, col4, col5 = m.groups()
                desc = desc.strip()
                if re.search(r'closing|opening|balance', desc, re.I):
                    continue

                # Determine buy/sell from description
                txn_type = 'PURCHASE'
                if re.search(r'redeem|redemption|switch.?out|withdrawal', desc, re.I):
                    txn_type = 'REDEMPTION'
                elif re.search(r'switch.?in', desc, re.I):
                    txn_type = 'SWITCH_IN'
                elif re.search(r'switch.?out', desc, re.I):
                    txn_type = 'SWITCH_OUT'
                elif re.search(r'dividend', desc, re.I):
                    txn_type = 'DIVIDEND'
                elif re.search(r'sip|systematic', desc, re.I):
                    txn_type = 'SIP'

                try:
                    dt = datetime.strptime(date_str, '%d-%b-%Y').date()
                    units_val = float(col3.replace(',', ''))
                    nav_val   = float(col4.replace(',', ''))

                    result['mf_transactions'].append({
                        'date': str(dt),
                        'folio': folio,
                        'fund_name': fund_name,
                        'isin': isin,
                        'txn_type': txn_type,
                        'units': units_val,
                        'nav': nav_val,
                        'description': desc,
                    })
                except (ValueError, AttributeError):
                    pass

    except Exception as e:
        result['errors'].append(f'Parse error: {e}')

    return result


if __name__ == '__main__':
    import json, sys
    path = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else ''
    r = parse_cams_cas(path, password)
    print(json.dumps(r, indent=2, default=str))
