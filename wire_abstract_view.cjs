// wire_abstract_view.cjs — tapping an Academic card opens the abstract from
// the CHAIN, same mechanism as stores:
//  1. fetchAcademics entries carry configHash + coords + repositoryUrl so the
//     chunks are fetchable.
//  2. The academics section routes through the same onPress branch as
//     storefronts (fetchStoreConfig -> scan -> modal).
//  3. The store modal gets an abstract branch: configs with .text render as
//     a paper (title, institution, abstract, keywords, repo link, Q&A
//     contact) instead of a storefront.
const fs = require('fs');

const jobs = [
  {
    f: 'mailbox_kaspa_api.ts',
    marker: 'KV_ACAD_VIEW',
    edits: [
      [
        "          dkimDomain: String((e.record && e.record.d && e.record.d.dkimDomain) || '') || undefined,\n          createdAt: e.announcedAt * 1000,\n          townhall: { verified: dkim, verifiedAt: e.announcedAt, verificationTx: e.storeAddress },",
        "          dkimDomain: String((e.record && e.record.d && e.record.d.dkimDomain) || '') || undefined,\n          configHash: e.configHash || '', coords: (e.record && e.record.d && e.record.d.coords) || null, repositoryUrl: e.primaryLink || '', // KV_ACAD_VIEW: chunks fetchable from the card\n          createdAt: e.announcedAt * 1000,\n          townhall: { verified: dkim, verifiedAt: e.announcedAt, verificationTx: e.storeAddress },"
      ],
    ],
  },
  {
    f: 'VillageMailbox.tsx',
    marker: 'KV_ACAD_VIEW',
    edits: [
      // 2. academics route into the store-config modal flow
      [
        "      if (section === 'storefronts') {\n        setStoreView({ entry: item, config: null, loading: true });",
        "      if (section === 'storefronts' || section === 'academics') { // KV_ACAD_VIEW: abstracts open the same chain-config modal\n        setStoreView({ entry: item, config: null, loading: true });"
      ],
      // 3. modal: abstract branch after the display-side scan gate
      [
        "              } catch {}\n              const items: any[] = cfg?.stash || [];",
        "              } catch {}\n              // KV_ACAD_VIEW: abstract configs (title/text) render as a paper, not a store\n              if (cfg && (cfg.text || cfg.abstractText) && !cfg.stash) {\n                const _qa = [cfg.qaChannel, cfg.qaHandle].filter(Boolean).join(': ');\n                return (\n                  <ScrollView contentContainerStyle={{ padding: rs.s(18) }}>\n                    <Text style={{ fontSize: rs.font(16), fontWeight: '900', color: '#292524' }}>{cfg.title || (storeView.entry as any).title || (storeView.entry as any).storeName || 'Abstract'}</Text>\n                    <Text style={{ fontSize: rs.font(10), color: '#4f46e5', marginTop: rs.s(2) }}>{String(cfg.institutionDomain || '') + (cfg.researcherId ? '  \\u00b7  ' + cfg.researcherId : '')}</Text>\n                    <Text style={{ fontSize: rs.font(12), color: '#44403c', marginTop: rs.s(12), lineHeight: rs.font(18) }}>{cfg.text || cfg.abstractText}</Text>\n                    {Array.isArray(cfg.keywords) && cfg.keywords.length > 0 ? <Text style={{ fontSize: rs.font(10), color: '#78716c', marginTop: rs.s(10) }}>{cfg.keywords.join(' \\u00b7 ')}</Text> : null}\n                    {cfg.repositoryUrl ? <TouchableOpacity onPress={() => { try { require('react-native').Linking.openURL(String(cfg.repositoryUrl)); } catch {} }} style={{ marginTop: rs.s(12) }}><Text style={{ fontSize: rs.font(11), color: '#4f46e5' }}>{cfg.repositoryUrl}</Text></TouchableOpacity> : null}\n                    {_qa ? <Text style={{ fontSize: rs.font(10), color: '#57534e', marginTop: rs.s(10) }}>Questions: {_qa}</Text> : null}\n                    <View style={{ height: rs.s(24) }} />\n                  </ScrollView>\n                );\n              }\n              const items: any[] = cfg?.stash || [];"
      ],
    ],
  },
];

let ok = true;
const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8');
  const CRLF = s.includes('\r\n');
  if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (let i = 0; i < j.edits.length; i++) {
    const c = s.split(j.edits[i][0]).length - 1;
    if (c !== 1) { console.error(j.f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
  }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  for (const [a, b] of j.edits) s = s.split(a).join(b);
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched');
}
console.log('DONE - academic cards open the abstract from the chain.');
