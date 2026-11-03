// ============================================================================
// kv_fx.ts — KV_FX: local currencies for Compare prices / purchasing power
// ============================================================================
// The phone's region picks a default currency (changeable). The KAS price is fetched directly in
// that currency (CoinGecko simple/price), so no separate exchange rate is needed. Purchasing power
// is a ratio (outside price ÷ village price, same currency), so checks from different countries
// can be averaged into one global figure.
// Russian ruble and other sanctioned-country currencies are deliberately not offered (owner decision).
// ============================================================================
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Ccy { code: string; sym: string; name: string; gl: string; dec: number; }

// CoinGecko-supported fiat currencies (minus sanctioned-country ones). gl = Google country code.
export const CURRENCIES: Ccy[] = [
  { code: 'USD', sym: '$', name: 'US dollar', gl: 'us', dec: 2 },
  { code: 'EUR', sym: '€', name: 'Euro', gl: 'de', dec: 2 },
  { code: 'GBP', sym: '£', name: 'British pound', gl: 'gb', dec: 2 },
  { code: 'CAD', sym: 'C$', name: 'Canadian dollar', gl: 'ca', dec: 2 },
  { code: 'AUD', sym: 'A$', name: 'Australian dollar', gl: 'au', dec: 2 },
  { code: 'NZD', sym: 'NZ$', name: 'New Zealand dollar', gl: 'nz', dec: 2 },
  { code: 'MXN', sym: 'MX$', name: 'Mexican peso', gl: 'mx', dec: 2 },
  { code: 'BRL', sym: 'R$', name: 'Brazilian real', gl: 'br', dec: 2 },
  { code: 'ARS', sym: 'AR$', name: 'Argentine peso', gl: 'ar', dec: 2 },
  { code: 'CLP', sym: 'CL$', name: 'Chilean peso', gl: 'cl', dec: 0 },
  { code: 'NGN', sym: '₦', name: 'Nigerian naira', gl: 'ng', dec: 2 },
  { code: 'ZAR', sym: 'R', name: 'South African rand', gl: 'za', dec: 2 },
  { code: 'INR', sym: '₹', name: 'Indian rupee', gl: 'in', dec: 2 },
  { code: 'PKR', sym: 'Rs', name: 'Pakistani rupee', gl: 'pk', dec: 2 },
  { code: 'BDT', sym: '৳', name: 'Bangladeshi taka', gl: 'bd', dec: 2 },
  { code: 'LKR', sym: 'Rs', name: 'Sri Lankan rupee', gl: 'lk', dec: 2 },
  { code: 'PHP', sym: '₱', name: 'Philippine peso', gl: 'ph', dec: 2 },
  { code: 'IDR', sym: 'Rp', name: 'Indonesian rupiah', gl: 'id', dec: 0 },
  { code: 'MYR', sym: 'RM', name: 'Malaysian ringgit', gl: 'my', dec: 2 },
  { code: 'SGD', sym: 'S$', name: 'Singapore dollar', gl: 'sg', dec: 2 },
  { code: 'THB', sym: '฿', name: 'Thai baht', gl: 'th', dec: 2 },
  { code: 'VND', sym: '₫', name: 'Vietnamese dong', gl: 'vn', dec: 0 },
  { code: 'JPY', sym: '¥', name: 'Japanese yen', gl: 'jp', dec: 0 },
  { code: 'KRW', sym: '₩', name: 'South Korean won', gl: 'kr', dec: 0 },
  { code: 'CNY', sym: 'CN¥', name: 'Chinese yuan', gl: 'cn', dec: 2 },
  { code: 'HKD', sym: 'HK$', name: 'Hong Kong dollar', gl: 'hk', dec: 2 },
  { code: 'TWD', sym: 'NT$', name: 'New Taiwan dollar', gl: 'tw', dec: 0 },
  { code: 'AED', sym: 'AED', name: 'UAE dirham', gl: 'ae', dec: 2 },
  { code: 'SAR', sym: 'SAR', name: 'Saudi riyal', gl: 'sa', dec: 2 },
  { code: 'KWD', sym: 'KWD', name: 'Kuwaiti dinar', gl: 'kw', dec: 3 },
  { code: 'BHD', sym: 'BHD', name: 'Bahraini dinar', gl: 'bh', dec: 3 },
  { code: 'ILS', sym: '₪', name: 'Israeli shekel', gl: 'il', dec: 2 },
  { code: 'TRY', sym: '₺', name: 'Turkish lira', gl: 'tr', dec: 2 },
  { code: 'CHF', sym: 'CHF', name: 'Swiss franc', gl: 'ch', dec: 2 },
  { code: 'SEK', sym: 'kr', name: 'Swedish krona', gl: 'se', dec: 2 },
  { code: 'NOK', sym: 'kr', name: 'Norwegian krone', gl: 'no', dec: 2 },
  { code: 'DKK', sym: 'kr', name: 'Danish krone', gl: 'dk', dec: 2 },
  { code: 'PLN', sym: 'zł', name: 'Polish złoty', gl: 'pl', dec: 2 },
  { code: 'CZK', sym: 'Kč', name: 'Czech koruna', gl: 'cz', dec: 2 },
  { code: 'HUF', sym: 'Ft', name: 'Hungarian forint', gl: 'hu', dec: 0 },
  { code: 'UAH', sym: '₴', name: 'Ukrainian hryvnia', gl: 'ua', dec: 2 },
  { code: 'GEL', sym: '₾', name: 'Georgian lari', gl: 'ge', dec: 2 },
];
const BY_CODE: Record<string, Ccy> = Object.fromEntries(CURRENCIES.map((c) => [c.code, c]));
export const ccyOf = (code?: string): Ccy => BY_CODE[String(code || '').toUpperCase()] || BY_CODE.USD;

// Region -> currency (eurozone and the rest). Unknown or sanctioned regions fall back to USD.
const EURO = ['AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES'];
const REGION: Record<string, string> = {
  US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', NG: 'NGN', ZA: 'ZAR',
  IN: 'INR', PK: 'PKR', BD: 'BDT', LK: 'LKR', PH: 'PHP', ID: 'IDR', MY: 'MYR', SG: 'SGD', TH: 'THB', VN: 'VND', JP: 'JPY',
  KR: 'KRW', CN: 'CNY', HK: 'HKD', TW: 'TWD', AE: 'AED', SA: 'SAR', KW: 'KWD', BH: 'BHD', IL: 'ILS', TR: 'TRY', CH: 'CHF',
  SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', UA: 'UAH', GE: 'GEL',
};
EURO.forEach((r) => { REGION[r] = 'EUR'; });

/** Region from the phone's locale, e.g. "en-NG" -> "NG". */
export function phoneRegion(): string {
  let loc = '';
  try { loc = Intl.DateTimeFormat().resolvedOptions().locale || ''; } catch {}
  if (!loc) {
    try {
      const RN = require('react-native');
      loc = RN.Platform.OS === 'ios'
        ? (RN.NativeModules.SettingsManager?.settings?.AppleLocale || RN.NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] || '')
        : (RN.NativeModules.I18nManager?.localeIdentifier || '');
    } catch {}
  }
  const m = String(loc).replace('_', '-').match(/-([A-Za-z]{2})(\b|-|$)/);
  return m ? m[1].toUpperCase() : '';
}

const PREF_KEY = 'kv_fx_ccy';
export async function getCcy(): Promise<Ccy> {
  try { const s = await AsyncStorage.getItem(PREF_KEY); if (s && BY_CODE[s]) return BY_CODE[s]; } catch {}
  return ccyOf(REGION[phoneRegion()] || 'USD');
}
export async function setCcy(code: string): Promise<void> { if (BY_CODE[code]) { try { await AsyncStorage.setItem(PREF_KEY, code); } catch {} } }

// KAS price in a currency, cached 10 minutes per currency.
const _px: Record<string, { v: number; at: number }> = {};
export async function kasPriceIn(code: string): Promise<number> {
  const c = ccyOf(code).code.toLowerCase();
  const hit = _px[c]; if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.v;
  if (c === 'usd') { try { const p: any = require('./kas_price_feed').getKasPrice(); if (p && !p.isStale && Number(p.usdPerKas) > 0) { _px[c] = { v: Number(p.usdPerKas), at: Date.now() }; return _px[c].v; } } catch {} }
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=kaspa&vs_currencies=' + c, { signal: ctl.signal });
    clearTimeout(t);
    if (r.ok) { const j: any = await r.json(); const v = Number(j?.kaspa?.[c]); if (isFinite(v) && v > 0) { _px[c] = { v, at: Date.now() }; return v; } }
  } catch {}
  return hit ? hit.v : 0; // a price older than 10 min is still shown only if we already had one this session
}

/** Parse a typed price in any common format: "1,299.50", "1.299,50", "49,99", "45 000", "₦45,000", "¥12000". */
export function parseMoney(text: string, dec = 2): number {
  let t = String(text || '').replace(/[^\d.,]/g, '');
  if (!t) return NaN;
  const lastDot = t.lastIndexOf('.'), lastCom = t.lastIndexOf(',');
  if (lastDot >= 0 && lastCom >= 0) {
    const dec = lastDot > lastCom ? '.' : ',';
    t = t.split(dec === '.' ? ',' : '.').join('').replace(dec, '.');
  } else {
    const sep = lastDot >= 0 ? '.' : lastCom >= 0 ? ',' : '';
    if (sep) {
      const parts = t.split(sep);
      // one separator followed by exactly 3 digits, or several separators = thousands; otherwise decimal
      const thousands = parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length > 0 && !/^0+$/.test(parts[0]) && dec !== 3);
      t = thousands ? parts.join('') : parts[0] + '.' + parts[1];
    }
  }
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') return NaN;
  const n = parseFloat(t);
  return isFinite(n) ? n : NaN;
}

export function fmtMoney(v: number, c: Ccy): string {
  if (!isFinite(v)) return c.sym + '—';
  const s = v.toFixed(c.dec);
  const [w, f] = s.split('.');
  return c.sym + w.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : '');
}
