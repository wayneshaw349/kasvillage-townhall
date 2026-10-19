// fix_broken_text.cjs - puts real symbols back where Windows turned emoji into "??" / garbage.
//   node fix_broken_text.cjs           -> PREVIEW only (shows every change, writes nothing)
//   node fix_broken_text.cjs --write   -> applies the changes (UTF-8, line endings kept)
// Only touches on-screen text: "??" right after a quote or ">" (or a whole '??' string), "\U0001F49C"
// escapes, mojibake like "â€¢", and the replacement character. The JS "??" operator is never touched.
const fs = require('fs');
const WRITE = process.argv.includes('--write');
const SKIP = /^(find_broken_text|fix_|wire_|kascity_|patch_|make_|repair_|diag_|test_|verify_)/;
const files = fs.readdirSync('.').filter((f) => /\.(tsx|ts|js)$/.test(f) && !/\.d\.ts$/.test(f) && !SKIP.test(f));
const E = (cp) => String.fromCodePoint(...[].concat(cp));
const VS = E(0xFE0F);

// keyword -> symbol. First match wins, so specific phrases come before general words.
const MAP = [
  ['locks > 0', E(0x26A0) + VS], ['release stale locks', E(0x1F9F9)], ['publish your game', E(0x1F3AE)],
  ['copy delivery', E(0x1F4CB)], ['copy log', E(0x1F4CB)], ['passport', E(0x1F6C2)],
  ['platform does not verify', E(0x26A0) + VS], ['contact method required', E(0x26A0) + VS],
  ['required sdk', E(0x1F9E9)], ['paste dapp code', E(0x1F50E)], ['research shelf', E(0x1F4DA)], ['book shelf', E(0x1F4DA)],
  ['academic research', E(0x1F393)], ['what buyers see', E(0x1F440)], ['mailbox visibility', E(0x1F4EC)],
  ['repository', E(0x1F4C2)], ['video explainer', E(0x1F3AC)], ['video demo', E(0x1F3AC)], ['watch video', E(0x1F3AC)],
  ['first question is free', E(0x1F193)], ["hasn't set a price", E(0x1F193)], ['follow-up', E(0x1F4B0)],
  ['questions via', E(0x1F4AC)], ['questions & answers', E(0x2753)], ['questions', E(0x2753)], ['views', E(0x1F441) + VS],
  ['prove your school', E(0x1F393)], ['paste the proof', E(0x1F4CB)], ['gmail', E(0x2709) + VS], ['outlook', E(0x2709) + VS], ['apple mail', E(0x2709) + VS],
  ['verify dkim', E(0x1F510)], ['dns lookup', E(0x1F510)], ['verified', E(0x2705)], ['how should people reach', E(0x1F4AC)],
  ['kaspa rate', E(0x1F4B0)], ['tutoring', E([0x1F9D1, 0x200D, 0x1F3EB])], ['question pricing', E(0x1F4B0)], ['privacy', E(0x1F512)],
  ['direct post link', E(0x1F517)], ['banner text style', E(0x1F524)], ['graffiti', E(0x1F3A8)], ['banner style', E(0x1F3A8)],
  ['communication channels', E(0x1F4AC)], ['edit item', E(0x270F) + VS], ['edit coupon', E(0x270F) + VS], ['new coupon', E(0x2795)],
  ['coupon', E(0x1F39F) + VS], ['compliance', E(0x2696) + VS],
  ['core engine', E(0x2699) + VS], ['avatar', E(0x1F9D1)], ['rendering', E(0x1F5BC) + VS], ['combat', E(0x1F94A)], ['world', E(0x1F30D)],
  ['audio', E(0x1F3B5)], ['items & economy', E(0x1F48E)], ['multiplayer', E(0x1F465)],
  ['elite', E(0x1F48E)], ['incubator', E(0x1F331)], ['main', E(0x2B50)],
  ['browse', E(0x1F50E)], ['submit', E(0x1F4E4)], ['services', E(0x1F6E0) + VS], ['profile', E(0x1F464)],
  ['paid', E(0x1F4B0)], ['free', E(0x1F193)],
  ['computer science', E(0x1F4BB)], ['mathematics', E(0x1F4D0)], ['physics', E(0x269B) + VS], ['biology', E(0x1F9EC)], ['chemistry', E(0x2697) + VS],
  ['economics', E(0x1F4C8)], ['engineering', E(0x1F6E0) + VS], ['law', E(0x2696) + VS], ['medicine', E(0x1FA7A)], ['psychology', E(0x1F9E0)],
  ['instagram', E(0x1F4F8)], ['pinterest', E(0x1F4CC)], ['etsy', E(0x1F6CD) + VS], ['tiktok', E(0x1F3B5)], ['ebay', E(0x1F3F7) + VS],
  ['facebook', E(0x1F4D8)], ['youtube', E(0x25B6) + VS], ['twitch', E(0x1F3AE)], ['telegram', E(0x2708) + VS], ['signal', E(0x1F510)],
  ['email', E(0x2709) + VS], ['nostr', E(0x1F7E3)], ['messenger', E(0x1F4AC)], ['other', E(0x1F4DA)], ['required', E(0x26A0) + VS],
];
const BULLET = E(0x2022), DOT = E(0xB7), ARROW = E(0x2192), CHECK = E(0x2713), LINK = E(0x1F517), SPARK = E(0x2728);
const run = (t) => String(t || '').split(/["`<]|'(?![a-z])/)[0];
const pick = (...ctx) => { for (const c of ctx) { const t = String(c || '').toLowerCase(); if (!t) continue; for (const [k, v] of MAP) if (t.includes(k)) return v; } return null; };
const SINGLE = (after) => /^\s*back/i.test(after) ? E(0x2039) : /^\s*new\b/i.test(after) ? E(0x1F195) : /^\s*unknown\b/i.test(after) ? E(0x2754)
  : /^\s*line\b/i.test(after) ? E(0x26A0) + VS : /^\s*(block|bubble|wild|stars|arrows|plain)\b/i.test(after) ? '' : CHECK;
const RC = '�';

let changed = 0, filesChanged = 0;
for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8'); const CRLF = raw.includes('\r\n');
  const lines = raw.replace(/\r\n/g, '\n').split('\n'); let fileHits = 0;
  for (let i = 0; i < lines.length; i++) {
    const before = lines[i]; let ln = before;
    const next = lines.slice(i + 1, i + 4).join(' ');
    const isComment = /^\s*(\/\/|\/\*|\*)/.test(ln);
    // 1) "\U0001F49C" style escapes -> real JS escape
    ln = ln.replace(/\\U000([0-9A-Fa-f]{4,5})/g, '\\u{$1}');
    // 2) mojibake + replacement character
    ln = ln.split('â€¢').join(BULLET).split('â€¦').join(E(0x2026)).split('â€”').join(E(0x2014))
           .split('â€“').join(E(0x2013)).split('â€™').join(E(0x2019));
    ln = ln.split(RC + ' OR ' + RC).join(E(0x2014) + ' OR ' + E(0x2014));
    ln = ln.replace(new RegExp('^(\\s*)' + RC + '(\\s)'), '$1' + BULLET + '$2').split(' ' + RC + ' ').join(' ' + DOT + ' ').split(RC).join(DOT);
    if (!isComment) {
      // 3) whole-string icons:  '??'  '???'
      ln = ln.replace(/(['"`])(\?{2,3})\1/g, (m, q, _x, off, s) => {
        const pre = s.slice(0, off), quoted = pre.match(/['"]([^'"]{2,})['"][^'"]*$/);
        if (/return\s*$/.test(pre)) return q + (pick(quoted && quoted[1]) || LINK) + q;
        return q + (pick(quoted && quoted[1], pre.slice(-60)) || pick(next) || BULLET) + q; });
      // 4) "?? Text" right after a quote, '>' or {'   and  "?? Text" opening a JSX text line
      ln = ln.replace(/(['"`>]|\{')(\?{2,3})(?=\s+[A-Za-z0-9{(])/g, (m, p, _x, off, s) => p + (pick(run(s.slice(off + m.length, off + m.length + 90))) || BULLET));
      ln = ln.replace(/^(\s*)(\?{2,3})(?=\s+[A-Z][a-z])/, (m, sp, _x, off, s) => sp + (pick(run(s.slice(m.length, m.length + 90)), next) || BULLET));
      // 5) "Text ??" right before a closing quote or '<'
      ln = ln.replace(/(\s)(\?{2,3})(?=['"`<])/g, (m, sp, _x, off, s) => sp + (pick(s.slice(Math.max(0, off - 50), off)) || SPARK));
      // 6) lone icon between tags  >??<
      ln = ln.replace(/>(\?{2,3})</g, () => '>' + (pick(next) || BULLET) + '<');
      // 7) one lost glyph:  >? Back   '? Selected'
      ln = ln.replace(/(>|['"])\?(?=\s[A-Z])/g, (m, p, off, s) => p + SINGLE(s.slice(off + 2))).replace(/(>|['"])\s(?=(Block|Bubble|Wild|Stars|Arrows|Plain)\b)/g, '$1');
      // 8) lost arrows inside JSX text:  "Confirmed ? Send"
      ln = ln.replace(/>([^<>{}]*)</g, (seg) => seg.replace(/ \? (?=[A-Za-z])/g, ' ' + ARROW + ' '));
    }
    if (ln !== before) { lines[i] = ln; fileHits++; changed++; console.log(f + ':' + (i + 1) + '\n  - ' + before.trim().slice(0, 140) + '\n  + ' + ln.trim().slice(0, 140)); }
  }
  if (fileHits) { filesChanged++; if (WRITE) { const out = lines.join('\n'); fs.writeFileSync(f, CRLF ? out.replace(/\n/g, '\r\n') : out, { encoding: 'utf8' }); } }
}
console.log('\n' + changed + ' line(s) in ' + filesChanged + ' file(s) ' + (WRITE ? 'FIXED.' : 'would change - run with --write to apply.'));
