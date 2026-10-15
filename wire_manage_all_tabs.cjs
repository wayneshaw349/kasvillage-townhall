// wire_manage_all_tabs.cjs — every lane reaches the manage modal
// (Repost / Delist / keepers):
//  - services items carry record/repostedBy/keepers and TAP into the same
//    chain-config modal storefronts/academics use (replaces the dead-end
//    alert; the modal renders their config, links and manage buttons).
//  - dapps (non-game) get a "Manage Listing" option in their alert, opening
//    the modal with the right registry kind ('dapp').
//  - the modal's Repost/Delist calls become kind-aware (_kvKind || 'store').
//  Games keep their own rail (Workspace DELIST + tip); coupons ride their
//  parent store.
const fs = require('fs');

const jobs = [
  {
    f: 'mailbox_kaspa_api.ts',
    marker: 'KV_REPOST_ITEM svc',
    edits: [
      [
`        coords: (e.record && e.record.d && e.record.d.coords) || null,
        configHash: e.configHash || '',
      } as any));`,
`        coords: (e.record && e.record.d && e.record.d.coords) || null,
        configHash: e.configHash || '',
        record: e.record, repostedBy: e.repostedBy || '', keepers: e.keepers || [], // KV_REPOST_ITEM svc
      } as any));`,
      ],
    ],
  },
  {
    f: 'VillageMailbox.tsx',
    marker: 'KV_MANAGE_TABS',
    edits: [
      // 1. services share the modal route
      [
`      if (section === 'storefronts' || section === 'academics') { // KV_ACAD_VIEW: abstracts open the same chain-config modal`,
`      if (section === 'storefronts' || section === 'academics' || section === 'services') { // KV_ACAD_VIEW + KV_MANAGE_TABS: store-rail listings share the chain-config modal`,
      ],
      // 2. dapp alerts gain Manage Listing
      [
`        const appLink = item.gameUrl || item.primaryLink || '';
        if (videoLink && appLink) {`,
`        const appLink = item.gameUrl || item.primaryLink || '';
        // KV_MANAGE_TABS: dapp listings manageable from the same modal
        const _openManage = () => setStoreView({ entry: { ...item, _kvKind: 'dapp' } as any, config: null, loading: false });
        if (videoLink && appLink) {`,
      ],
      [
`          Alert.alert(item.name || 'App', 'Watch the demo or open the app?', [
            { text: 'Cancel', style: 'cancel' },`,
`          Alert.alert(item.name || 'App', 'Watch the demo or open the app?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Manage Listing', onPress: _openManage },`,
      ],
      [
`          const link = videoLink || appLink;
          if (link) Linking.openURL(link.startsWith('http') ? link : 'https://' + link);
          else Alert.alert('No Link', 'No demo or app URL set.');
        }`,
`          const link = videoLink || appLink;
          Alert.alert(item.name || 'App', link ? 'Open the app or manage the listing?' : 'No demo or app URL set.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Manage Listing', onPress: _openManage },
            ...(link ? [{ text: 'Open App', onPress: () => Linking.openURL(link.startsWith('http') ? link : 'https://' + link) }] : []),
          ]);
        }`,
      ],
    ],
    editsAll: [
      // 3. kind-aware repost/delist (2x runRepost + 2x runDelistOwner)
      [
`(storeView.entry as any, 'store')`,
`(storeView.entry as any, ((storeView.entry as any)._kvKind || 'store'))`,
        4,
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
  for (const [a, , want] of (j.editsAll || [])) {
    const c = s.split(a).length - 1;
    if (c !== want) { console.error(j.f + ' ALL-ANCHOR count = ' + c + ' - expected ' + want + '.'); ok = false; }
  }
  for (let i = 0; i < (j.edits || []).length; i++) {
    const c = s.split(j.edits[i][0]).length - 1;
    if (c !== 1) { console.error(j.f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
  }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  for (const [a, b] of (j.edits || [])) s = s.split(a).join(b);
  for (const [a, b] of (j.editsAll || [])) s = s.split(a).join(b);
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched');
}
console.log('DONE - manage (repost/delist/keepers) reachable from every lane.');
