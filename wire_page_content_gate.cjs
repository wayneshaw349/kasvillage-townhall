// wire_page_content_gate.cjs - store / dapp / custom HTML pages get the same word filter as games.
//   node wire_page_content_gate.cjs     (project folder; safe to run twice)
// Before: pages were checked for code, links, images and wallet-phishing only - not the words on screen.
const fs = require('fs'); const f = 'html_chunks.ts';
const raw = fs.readFileSync(f, 'utf8'); const CRLF = raw.includes('\r\n'); let s = raw.replace(/\r\n/g, '\n');
if (s.includes('KV_PAGE_CONTENT_GATE')) { console.log('already done'); process.exit(0); }
const a = "    issues.push({ code: 'too_large', detail: utf8ToBytes(html).length + ' bytes' });\n  }\n  return { ok: issues.length === 0, issues };";
if (!s.includes(a)) { console.log('FAIL - anchor not found in ' + f + ' (send me this)'); process.exit(1); }
s = s.replace(a, "    issues.push({ code: 'too_large', detail: utf8ToBytes(html).length + ' bytes' });\n  }\n" +
"  // KV_PAGE_CONTENT_GATE: words on screen, titles/alt text and script strings go through the content filter\n" +
"  try {\n" +
"    const cf = require('./content_filter'); const scan = cf.scanObjectStrict || cf.scanObject;\n" +
"    const visible = html.replace(/<script[\\s\\S]*?<\\/script>/gi, ' ').replace(/<style[\\s\\S]*?<\\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')\n" +
"      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\s+/g, ' ').slice(0, 200000);\n" +
"    const attrs = (html.match(/(?:title|alt|placeholder|aria-label|content)\\s*=\\s*[\"'][^\"']*[\"']/gi) || []).join(' ').slice(0, 50000);\n" +
"    const lits: string[] = []; const _re = /([\"'`])((?:\\\\.|(?!\\1)[^\\\\\\n]){4,300})\\1/g; let _m: any; let _n = 0;\n" +
"    while ((_m = _re.exec(html)) && _n < 20000) { _n++; if (/[a-z]{3,}\\s+[a-z]{2,}/i.test(_m[2])) lits.push(_m[2]); }\n" +
"    const r = scan({ text: visible, attrs, strings: lits });\n" +
"    if (r && r.ok === false) issues.push({ code: 'content', detail: String(r.reason || 'blocked words') });\n" +
"  } catch {}\n" +
"  return { ok: issues.length === 0, issues };");
fs.copyFileSync(f, f + '.bak_pagegate');
fs.writeFileSync(f, CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('ok - pages now run the content filter (stores, dapps, custom HTML, and every game fragment)');
