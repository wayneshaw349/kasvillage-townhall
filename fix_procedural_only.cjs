// fix_procedural_only.cjs - images are procedural only. No photos anywhere.
// 1) html_chunks.ts: publish scan blocks <img>, embedded data:image, and base64 PNG/JPEG/GIF/WEBP
//    blobs (pages AND every #7 game fragment). data:image is no longer an allowed ref.
// 2) OnChainPageView.tsx: pages img-src 'none'; games get their own lockdown CSP (no network,
//    runtime canvas images only). Our CSP is always injected - a page can no longer ship its own
//    looser CSP to skip ours (browsers enforce both; strictest wins).
// 3) StorefrontViewer.tsx + Workspace.tsx: no photo logos. Store emblem is generated from the
//    brand name + shape + theme color; the Logo URL field is removed and never published.
const fs = require('fs');
const R = String.raw;
const jobs = [
  { f: 'html_chunks.ts', marker: 'KV_PROC_ONLY', edits: [
    ["    if (v.startsWith('kv://') || v.startsWith('#') || v.startsWith('data:image/')) continue;",
     "    if (v.startsWith('kv://') || v.startsWith('#') || v.startsWith('data:audio/') || v.startsWith('data:font/')) continue; // KV_PROC_ONLY: no data:image"],
    [R`  [/<script[^>]*\ssrc\s*=/i,                                 'external_script'],` + '\n',
     R`  [/<script[^>]*\ssrc\s*=/i,                                 'external_script'],
  // KV_PROC_ONLY: images must be procedural - no photos, embedded or linked
  [/<img\b/i,                                                'image_tag'],
  [/data:image\//i,                                          'embedded_image'],
  [/iVBORw0KGgo|\/9j\/4[AQ]|R0lGOD[ld]h|UklGR.{2,6}V0VCUA/,  'embedded_image_b64'],` + '\n'],
  ]},
  { f: 'OnChainPageView.tsx', marker: 'KV_GAME_CSP', edits: [
    [R`img-src data:; media-src data:; font-src data:;">';`,
     R`img-src \'none\'; media-src data:; font-src data:;">';
// KV_GAME_CSP: games run inline JS but get no network and no outside images; canvas/blob images only.
const KV_GAME_CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\'; style-src \'unsafe-inline\'; img-src data: blob:; media-src data: blob:; font-src data:; worker-src blob:; connect-src \'none\';">';`],
    ["function injectCsp(raw: string): string {\n  if (/http-equiv=[\"']Content-Security-Policy[\"']/i.test(raw)) return raw;\n",
     "function injectCsp(raw: string, meta: string = CSP_META): string {\n  // always inject: a page's own CSP can only tighten, never loosen ours\n"],
    ["(mm) => mm + CSP_META);", "(mm) => mm + meta);"],
    ["'<html$1><head>' + CSP_META + '</head>');\n  return CSP_META + raw;", "'<html$1><head>' + meta + '</head>');\n  return meta + raw;"],
    ["if (res.html) setHtml(props.game ? res.html : injectCsp(res.html));",
     "if (res.html) setHtml(props.game ? injectCsp(res.html, KV_GAME_CSP) : injectCsp(res.html));"],
  ]},
  { f: 'StorefrontViewer.tsx', marker: 'KV_PROCEDURAL_LOGO', edits: [
    ["storefront?.logoUrl && isWhitelistedUrl(storefront.logoUrl) ? (", "false /* KV_PROCEDURAL_LOGO: no photo logos */ && storefront?.logoUrl ? (", 2],
    ["              ) : null}\n              <Text style={styles.headerTitle}>",
     "              ) : (\n                <View style={{ width: rs.s(32), height: rs.s(32), borderRadius: storefront?.logoShape === 'square' ? rs.s(8) : rs.s(16), backgroundColor: (theme as any).accent || '#a855f7', alignItems: 'center', justifyContent: 'center', marginRight: rs.s(8) }}>\n                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(14) }}>{String(storefront?.brandName || '?').trim().charAt(0).toUpperCase()}</Text>\n                </View>\n              )}\n              <Text style={styles.headerTitle}>"],
  ]},
  { f: 'Workspace.tsx', marker: 'KV_PROCEDURAL_LOGO', edits: [
    ["        logoUrl,\n", "        logoUrl: '', // KV_PROCEDURAL_LOGO: photo logos are never published\n"],
    ["              <InputField\n                label=\"Logo Image URL\"\n                value={logoUrl}\n                onChangeText={setLogoUrl}\n                placeholder=\"Paste Instagram/Etsy/TikTok image link\"\n                keyboardType=\"url\"\n                note=\"Only moderated platform links allowed for safety.\"\n              />",
     "              <Text style={{ fontSize: rs.font(9), color: '#78716c', marginBottom: rs.s(8) }}>Your store emblem is generated from your brand name, shape and colors. Photo logos are not used.</Text>"],
  ]},
];
let ok = true; const staged = [];
for (const j of jobs) {
  if (!fs.existsSync(j.f)) { console.error(j.f + ': not found'); ok = false; continue; }
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (let i = 0; i < j.edits.length; i++) { const want = j.edits[i][2] || 1; const c = s.split(j.edits[i][0]).length - 1; if (c !== want) { console.error(j.f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected ' + want + '.'); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) { let s = j.s; for (const [a, b] of j.edits) s = s.split(a).join(b); fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s); console.log(j.f + ': patched'); }
console.log('DONE - procedural-only images. Reload the app; republish nothing (on-chain pages are re-checked by the viewer CSP).');
