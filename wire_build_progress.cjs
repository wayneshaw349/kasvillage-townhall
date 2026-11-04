// wire_build_progress.cjs — KV_BUILD_PROGRESS: the "checking" step no longer freezes silently.
//  kv_build_chain: same logic as a generator (buildSteps); buildChainBundle runs it straight through (unchanged
//  result), buildChainBundleAsync yields to the UI between fragments and reports progress.
//  Workspace: progress bar + phase lines while checking; "downloading" / "reading" lines for link and clipboard.
const fs = require('fs');
const rep = (F, a, b, n = 1) => { let s = fs.readFileSync(F, 'utf8'); const c = s.split(a).length - 1; if (c !== n) throw new Error(F + ': anchor x' + c + ': ' + a.slice(0, 70)); fs.writeFileSync(F, s.split(a).join(b)); };
const K = 'kv_build_chain.ts', W = 'Workspace.tsx';
if (fs.readFileSync(K, 'utf8').includes('KV_BUILD_PROGRESS')) { console.log('already wired'); process.exit(0); }

// --- builder as a generator ---
rep(K, "export function buildChainBundle(srcHtml: string, game: string): ChainBuild {",
`// KV_BUILD_PROGRESS: one implementation; the sync and async entry points both run these steps.
export type BuildStep = { p: string; d: number; t: number };
export function buildChainBundle(srcHtml: string, game: string): ChainBuild {
  const g = buildSteps(srcHtml, game); let r = g.next(); while (!r.done) r = g.next(); return r.value;
}
export async function buildChainBundleAsync(srcHtml: string, game: string, onStep?: (s: BuildStep) => void): Promise<ChainBuild> {
  const g = buildSteps(srcHtml, game); let r = g.next(); let last = 0;
  while (!r.done) {
    const now = Date.now();
    if (now - last > 120) { last = now; try { onStep && onStep(r.value); } catch {} await new Promise((res) => setTimeout(res, 16)); } // let the screen repaint
    r = g.next();
  }
  return r.value;
}
function* buildSteps(srcHtml: string, game: string): Generator<BuildStep, ChainBuild, void> {`);
rep(K, "    frags.push({ i: frags.length, h: fh, prev, link, bytes: blen(text), chunks: nChunks, text });",
"    frags.push({ i: frags.length, h: fh, prev, link, bytes: blen(text), chunks: nChunks, text });\n    yield { p: 'packing', d: Math.min(frags.length, _estN), t: _estN };");
rep(K, "  const { htmlToChunkData, scanHtmlForPublish } = require('./html_chunks');",
"  const { htmlToChunkData, scanHtmlForPublish } = require('./html_chunks');\n  const _estN = Math.max(1, Math.ceil(blen(html) / (FRAG_MAX * 0.97)));\n  yield { p: 'packing', d: 0, t: _estN };");
rep(K, "  try { const { scanGameForPublish } = require('./game_chunks');",
"  yield { p: 'safety check: whole page', d: 0, t: frags.length };\n  try { const { scanGameForPublish } = require('./game_chunks');");
rep(K, "  for (const f of frags) { try { const r = scanHtmlForPublish(f.text);",
"  for (const f of frags) { yield { p: 'safety check', d: f.i + 1, t: frags.length }; try { const r = scanHtmlForPublish(f.text);");
rep(K, "  try {\n    const cf = require('./content_filter'); const scan = cf.scanObjectStrict || cf.scanObject;\n    // KV_ENTITY_DECODE",
"  yield { p: 'content check', d: frags.length, t: frags.length };\n  try {\n    const cf = require('./content_filter'); const scan = cf.scanObjectStrict || cf.scanObject;\n    // KV_ENTITY_DECODE");
rep(K, "  // solve the puzzle exactly as the wallet will",
"  yield { p: 'verifying the chain', d: frags.length, t: frags.length };\n  // solve the puzzle exactly as the wallet will");

// --- Workspace: progress while checking ---
rep(W, "      gadd('checking ' + id + ' (' + Math.round(html.length / 1024) + ' KB)');\n      const { buildChainBundle, nonceBaseFor } = require('./kv_build_chain');\n      const b: any = buildChainBundle(html, id);",
`      gadd('checking ' + id + ' (' + Math.round(html.length / 1024) + ' KB) - this can take a minute for big games');
      const { buildChainBundleAsync, nonceBaseFor } = require('./kv_build_chain');
      await new Promise((r) => setTimeout(r, 30)); // KV_BUILD_PROGRESS: show the line before the heavy work starts
      let _ph = '';
      const b: any = await buildChainBundleAsync(html, id, (st: any) => {
        setGprog({ done: st.d, total: st.t, label: st.p });
        const ph = st.p === 'packing' ? 'packing into fragments' : st.p; if (ph !== _ph) { _ph = ph; gadd('\\u2026 ' + ph); }
      });
      setGprog(null);`);
rep(W, "          <Text style={{ color: '#9a8f78', fontSize: 10, fontFamily: 'monospace', marginTop: 3 }}>{gprog.done >= gprog.total ? 'uploaded - verifying and listing…' : 'uploading ' + gprog.done + '/' + gprog.total + ' · keep this screen open'}</Text>",
"          <Text style={{ color: '#9a8f78', fontSize: 10, fontFamily: 'monospace', marginTop: 3 }}>{gprog.label ? gprog.label + ' ' + gprog.done + '/' + gprog.total + ' \\u00b7 wallet is working' : gprog.done >= gprog.total ? 'uploaded - verifying and listing…' : 'uploading ' + gprog.done + '/' + gprog.total + ' · keep this screen open'}</Text>");
// link + clipboard: say what is happening
rep(W, "        try { const r = await fetch(url); if (!r.ok) throw new Error('could not fetch the page (' + r.status + ')'); kvIngest(await r.text(), { url }); }\n        catch (e: any) { Alert.alert('Fetch failed', String((e && e.message) || e)); }",
"        setGlog([]); gadd('downloading ' + url.slice(0, 80) + '\\u2026'); setGbusy('link'); // KV_BUILD_PROGRESS\n        try { const r = await fetch(url); if (!r.ok) throw new Error('could not fetch the page (' + r.status + ')'); const _t = await r.text(); gadd('downloaded ' + Math.round(_t.length / 1024) + ' KB'); setGbusy(''); kvIngest(_t, { url }); }\n        catch (e: any) { setGbusy(''); gadd('download failed: ' + String((e && e.message) || e)); Alert.alert('Fetch failed', String((e && e.message) || e)); }");
rep(W, "      const t = await Clipboard.getStringAsync();\n      if (!t) {",
"      setGlog([]); gadd('reading the clipboard\\u2026'); // KV_BUILD_PROGRESS\n      const t = await Clipboard.getStringAsync();\n      if (t) gadd('read ' + Math.round(t.length / 1024) + ' KB');\n      if (!t) {");
console.log('wired KV_BUILD_PROGRESS');
