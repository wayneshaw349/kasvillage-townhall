// ============================================================================
// kv_savings_note.ts — KV_SAVINGS_QR printed slip, drawn as a banknote-style voucher
// ============================================================================
// Original design (ornate border, guilloche waves, rosette, corner numerals) in five
// earth-tone palettes; each slip picks one at random. Deliberately NOT a copy of any
// real currency: no portrait, no government seals or wording, and it says "not legal tender".
// The centre medallion is an original village emblem. To use an image you have the rights to
// instead, set KV_NOTE_EMBLEM to a data: URI (PNG/SVG).
// ============================================================================

export const KV_NOTE_EMBLEM = ''; // optional data:image/... URI for the centre medallion

export interface NotePalette { name: string; paper: string; tint: string; ink: string; line: string; accent: string; }
export const NOTE_PALETTES: NotePalette[] = [
  { name: 'Terracotta', paper: '#F6E7DA', tint: '#EBCDB6', ink: '#5A2A17', line: '#B8613D', accent: '#C9733F' },
  { name: 'Ochre',      paper: '#F8EFD6', tint: '#EBD9A6', ink: '#4F3A12', line: '#B08A2E', accent: '#C99A2E' },
  { name: 'Umber',      paper: '#F1E8DF', tint: '#D9C6B4', ink: '#3B2A1E', line: '#7A5A43', accent: '#8C6648' },
  { name: 'Sienna',     paper: '#F7E4D8', tint: '#E6BFA6', ink: '#55220F', line: '#A0522D', accent: '#B5633A' },
  { name: 'Slate',      paper: '#ECEBE6', tint: '#CFCBC1', ink: '#2F2E2B', line: '#6E6A60', accent: '#8A7F6C' },
];

const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
const f2 = (x: number) => x.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function wavePath(x0: number, x1: number, y: number, amp: number, period: number, phase: number): string {
  let d = ''; for (let x = x0; x <= x1; x += 4) d += (x === x0 ? 'M' : 'L') + x.toFixed(1) + ' ' + (y + amp * Math.sin((x / period) * 2 * Math.PI + phase)).toFixed(1);
  return d;
}
function rosettePath(cx: number, cy: number, R: number, k: number, rot: number): string {
  let d = ''; const steps = 360;
  for (let i = 0; i <= steps; i++) { const t = (i / steps) * 2 * Math.PI; const r = R * (0.62 + 0.38 * Math.cos(k * t));
    d += (i ? 'L' : 'M') + (cx + r * Math.cos(t + rot)).toFixed(1) + ' ' + (cy + r * Math.sin(t + rot)).toFixed(1); }
  return d + 'Z';
}
/** Original emblem: a village roof over a stylised K, inside a beaded ring. */
function emblem(cx: number, cy: number, p: NotePalette): string {
  if (KV_NOTE_EMBLEM) return '<image href="' + KV_NOTE_EMBLEM + '" x="' + (cx - 62) + '" y="' + (cy - 62) + '" width="124" height="124" preserveAspectRatio="xMidYMid meet"/>';
  let beads = ''; for (let i = 0; i < 36; i++) { const a = (i / 36) * 2 * Math.PI; beads += '<circle cx="' + (cx + 70 * Math.cos(a)).toFixed(1) + '" cy="' + (cy + 70 * Math.sin(a)).toFixed(1) + '" r="2.6" fill="' + p.ink + '"/>'; }
  return '<circle cx="' + cx + '" cy="' + cy + '" r="78" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="3"/>' + beads +
    '<circle cx="' + cx + '" cy="' + cy + '" r="60" fill="' + p.tint + '" stroke="' + p.line + '" stroke-width="2"/>' +
    '<path d="M' + (cx - 44) + ' ' + (cy - 6) + ' L' + cx + ' ' + (cy - 44) + ' L' + (cx + 44) + ' ' + (cy - 6) + '" fill="none" stroke="' + p.ink + '" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<path d="M' + (cx - 16) + ' ' + (cy - 14) + ' V' + (cy + 38) + ' M' + (cx + 22) + ' ' + (cy - 12) + ' L' + (cx - 14) + ' ' + (cy + 12) + ' L' + (cx + 24) + ' ' + (cy + 38) + '" fill="none" stroke="' + p.ink + '" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>';
}

/** One slip as SVG. qrPath is an SVG path of unit modules (size qrN incl. quiet zone). */
export function noteSvg(o: {
  qrPath: string; qrN: number; kas: number; usd: number; usdPerKas: number; idx: number; total: number;
  net: string; hotLast6: string; date: string; palette: NotePalette; copy?: 'ORIGINAL' | 'BACKUP COPY'; bearer?: boolean;
}): string {
  const p = o.palette, W = 1000, H = 430;
  const amt = o.kas >= 1000 ? String(Math.round(o.kas)) : o.kas >= 100 ? o.kas.toFixed(0) : o.kas.toFixed(2);
  let waves = '';
  for (let k = 0; k < 6; k++) {
    waves += '<path d="' + wavePath(40, 960, 40, 5, 46, k * 0.9) + '" />'; // top band only: the footer text sits at the bottom
  }
  let ros = ''; for (let k = 0; k < 7; k++) ros += '<path d="' + rosettePath(388, 205, 112 - k * 3, 12, k * 0.045) + '" />';
  const qx = 700, qy = 72, qs = 266; // QR panel (keeps a big quiet zone on light paper)
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="7in" height="3.01in">' +
    '<rect x="4" y="4" width="' + (W - 8) + '" height="' + (H - 8) + '" rx="14" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="6"/>' +
    '<rect x="22" y="22" width="' + (W - 44) + '" height="' + (H - 44) + '" rx="8" fill="none" stroke="' + p.line + '" stroke-width="2"/>' +
    '<rect x="30" y="30" width="' + (W - 60) + '" height="' + (H - 60) + '" rx="6" fill="none" stroke="' + p.ink + '" stroke-width="1.2"/>' +
    '<g fill="none" stroke="' + p.line + '" stroke-width="1" opacity="0.55">' + waves + '</g>' +
    '<g fill="none" stroke="' + p.accent + '" stroke-width="0.9" opacity="0.55">' + ros + '</g>' +
    // corner numerals
    '<g fill="' + p.ink + '" font-family="Georgia, \'Times New Roman\', serif" font-weight="700">' +
      '<text x="60" y="120" font-size="58">' + esc(amt) + '</text><text x="62" y="146" font-size="18" letter-spacing="3">KAS</text>' +
      '<text x="60" y="' + (H - 66) + '" font-size="40">' + esc(amt) + '</text>' +
    '</g>' +
    // title + footer banners
    '<text x="388" y="66" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="700" letter-spacing="4" fill="' + p.ink + '">' + (o.bearer ? 'KASVILLAGE CASH NOTE' : 'KASVILLAGE SAVINGS') + '</text>' +
    '<line x1="40" y1="' + (H - 58) + '" x2="960" y2="' + (H - 58) + '" stroke="' + p.line + '" stroke-width="1" opacity="0.6"/>' +
    (o.bearer ? '<text x="500" y="' + (H - 40) + '" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="12.5" letter-spacing="1.5" fill="' + p.ink + '">BEARER NOTE · ANYONE HOLDING THIS QR CAN SPEND IT · TREAT LIKE CASH · NOT LEGAL TENDER</text>' :
    '<text x="500" y="' + (H - 40) + '" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="12.5" letter-spacing="1.5" fill="' + p.ink + '">NOT LEGAL TENDER · PRE-SIGNED KASPA TRANSFER · PAYS ONLY HOT WALLET …' + esc(o.hotLast6) + '</text>') +
    emblem(388, 205, p) +
    // value block
    '<g font-family="Helvetica, Arial, sans-serif" fill="' + p.ink + '" text-anchor="middle">' +
      '<text x="388" y="318" font-size="30" font-weight="700">' + esc(o.kas.toFixed(4)) + ' KAS</text>' +
      (o.usd > 0 ? '<text x="388" y="346" font-size="18">≈ $' + esc(f2(o.usd)) + ' USD on ' + esc(o.date) + '</text>' +
        '<text x="388" y="366" font-size="11.5">1 KAS = $' + esc(o.usdPerKas.toFixed(4)) + ' · dollar value changes, KAS amount does not</text>' : '') +
    '</g>' +
    (o.bearer ? '<g transform="rotate(-8 165 ' + (H - 150) + ')"><rect x="44" y="' + (H - 176) + '" width="246" height="44" rx="5" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="4"/>' +
      '<text x="167" y="' + (H - 143) + '" text-anchor="middle" textLength="222" lengthAdjust="spacingAndGlyphs" font-family="Helvetica, Arial, sans-serif" font-size="25" font-weight="900" letter-spacing="2" fill="' + p.ink + '">TRANSFERABLE</text></g>' : '') +
    (!o.bearer && o.copy ? '<g transform="rotate(-8 128 ' + (H - 146) + ')"><rect x="54" y="' + (H - 166) + '" width="' + (o.copy === 'ORIGINAL' ? 132 : 162) + '" height="30" rx="4" fill="none" stroke="' + p.accent + '" stroke-width="2.5"/>' +
      '<text x="' + (o.copy === 'ORIGINAL' ? 120 : 135) + '" y="' + (H - 145) + '" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="2" fill="' + p.accent + '">' + o.copy + '</text></g>' : '') +
    '<text x="60" y="' + (H - 104) + '" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="' + p.ink + '">' + esc(o.idx + ' of ' + o.total + ' · ' + o.net) + '</text>' +
    // QR panel
    '<rect x="' + (qx - 12) + '" y="' + (qy - 12) + '" width="' + (qs + 24) + '" height="' + (qs + 24) + '" rx="10" fill="#FFFFFF" stroke="' + p.ink + '" stroke-width="2"/>' +
    '<svg x="' + qx + '" y="' + qy + '" width="' + qs + '" height="' + qs + '" viewBox="0 0 ' + o.qrN + ' ' + o.qrN + '" shape-rendering="crispEdges"><path d="' + o.qrPath + '" fill="#111111"/></svg>' +
    '<text x="' + (qx + qs / 2) + '" y="' + (qy + qs + 34) + '" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="' + p.ink + '">' + (o.bearer ? 'Scan in KasVillage → Send → Redeem note' : 'Scan in KasVillage → Savings QR → Spend') + '</text>' +
    '</svg>';
}

/** Full print page: one note per QR, random palette each, plus the safety line under each. */
export function notePrintHtml(o: { qrs: string[]; outs: string[]; hotLast6: string; net: string; usdPerKas: number; pick?: () => number; single?: boolean }): string {
  const QR = require('qrcode');
  const date = new Date().toISOString().slice(0, 10);
  const pick = o.pick || Math.random;
  // Each QR is printed twice: the ORIGINAL and a BACKUP COPY (same coins). Count originals only.
  const palettes = o.qrs.map(() => NOTE_PALETTES[Math.floor(pick() * NOTE_PALETTES.length) % NOTE_PALETTES.length]);
  const one = (t: string, i: number, copy: 'ORIGINAL' | 'BACKUP COPY') => {
    const q = QR.create(t, { errorCorrectionLevel: 'M' }); const n = q.modules.size; const d = q.modules.data; const m = 2;
    let path = ''; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (d[y * n + x]) path += 'M' + (x + m) + ' ' + (y + m) + 'h1v1h-1z';
    const kas = Number(o.outs[i]) / 1e8;
    const palette = palettes[i];
    return '<div class="n">' + noteSvg({ qrPath: path, qrN: n + 2 * m, kas, usd: o.usdPerKas > 0 ? kas * o.usdPerKas : 0, usdPerKas: o.usdPerKas, idx: i + 1, total: o.qrs.length, net: o.net, hotLast6: o.hotLast6, date, palette, copy }) +
      '<p class="s">' + (copy === 'BACKUP COPY' ? '<b>BACKUP COPY of slip ' + (i + 1) + ' of ' + o.qrs.length + ': the SAME coins as its ORIGINAL - do not count it twice.</b> Store it apart from the original. ' : '') +
      'Whoever scans this can only move these coins into wallet …' + esc(o.hotLast6) + '. Losing every copy loses these coins.</p></div>';
  };
  if (o.single) {
    // One page per slip for screenshots: white screen, slip rotated to fill a portrait phone, no caption.
    const page = (div: string) => '<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/><style>html,body{margin:0;height:100%;background:#fff;overflow:hidden}' +
      '.n{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}.n svg{width:94vh;max-width:none;height:auto;transform:rotate(90deg);flex:none}.s{display:none}' +
      '@media (orientation:landscape){.n svg{width:94vw;transform:none}}</style></head><body>' + div + '</body></html>';
    return JSON.stringify([...o.qrs.map((t, i) => page(one(t, i, 'ORIGINAL'))), ...o.qrs.map((t, i) => page(one(t, i, 'BACKUP COPY')))]);
  }
  const notes = o.qrs.map((t, i) => one(t, i, 'ORIGINAL')).join('') + '<div style="page-break-before:always"></div>' + o.qrs.map((t, i) => one(t, i, 'BACKUP COPY')).join('');
  return '<html><head><meta name="viewport" content="width=device-width"/><style>body{margin:0.3in;font-family:Helvetica,Arial,sans-serif}.n{page-break-inside:avoid;margin:0 0 0.25in}.n svg{display:block}.s{font-size:10px;margin:4px 0 0;color:#333}</style></head><body>' + notes + '</body></html>';
}


/** Cash note (bearer): one full-screen page + one print page. The QR holds the note's own key. */
export function bearerNotePages(o: { qr: string; kas: number; usdPerKas: number; net: string; pick?: () => number }): { screen: string; print: string } {
  const QR = require('qrcode');
  const q = QR.create(o.qr, { errorCorrectionLevel: 'M' }); const n = q.modules.size; const d = q.modules.data; const m = 2;
  let path = ''; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (d[y * n + x]) path += 'M' + (x + m) + ' ' + (y + m) + 'h1v1h-1z';
  const palette = NOTE_PALETTES[Math.floor((o.pick || Math.random)() * NOTE_PALETTES.length) % NOTE_PALETTES.length];
  const svg = noteSvg({ qrPath: path, qrN: n + 2 * m, kas: o.kas, usd: o.usdPerKas > 0 ? o.kas * o.usdPerKas : 0, usdPerKas: o.usdPerKas, idx: 1, total: 1, net: o.net, hotLast6: '', date: new Date().toISOString().slice(0, 10), palette, bearer: true });
  const screen = '<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/><style>html,body{margin:0;height:100%;background:#fff;overflow:hidden}' +
    '.n{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}.n svg{width:94vh;max-width:none;height:auto;transform:rotate(90deg);flex:none}' +
    '@media (orientation:landscape){.n svg{width:94vw;transform:none}}</style></head><body><div class="n">' + svg + '</div></body></html>';
  const print = '<html><head><style>body{margin:0.3in;font-family:Helvetica,Arial,sans-serif}.n svg{display:block}</style></head><body><div class="n">' + svg + '</div><p style="font-size:10px">TRANSFERABLE bearer note: anyone holding this QR can spend it. Treat it like cash.</p></body></html>';
  return { screen, print };
}
