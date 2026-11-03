// wire_tip_crew.cjs — KV_TIP_CREW: "Archived by" + "Tip everyone involved" on store fronts and game cards
const fs = require('fs'); const F = 'VillageMailbox.tsx'; let s = fs.readFileSync(F, 'utf8');
if (s.includes('KV_TIP_CREW')) { console.log('already wired'); process.exit(0); }
const anchor = "{(storeView.entry as any)?.coords?.tip_addr ? ( /* KV_STORE_TIP_SHEET: tip moved off the envelope */";
const n = s.split(anchor).length - 1; if (n !== 2) throw new Error('store anchor count ' + n);
const crewStore = (c) => "<KvTipCrew /* KV_TIP_CREW */ id={'store:' + String((storeView.entry as any).arweaveTx || (storeView.entry as any).id || '')} name={String((storeView.entry as any).name || (storeView.entry as any).storeName || 'store')} owner={(storeView.entry as any)?.coords?.tip_addr || null} keepers={((storeView.entry as any).keepers || []) as string[]}" + (c ? ' compact' : '') + " />\n                    ";
let i = 0; s = s.split(anchor).map((p, k) => k === 0 ? p : p).reduce((acc, p, k) => k === 0 ? p : acc + crewStore(i++ === 1) + anchor + p, '');
const gAnchor = "                    <Text style={{ color: '#d97706', fontSize: 10, fontWeight: '700' }}>{ka.slice(10, 26) + '… — Tip this keeper'}</Text>\n                  </TouchableOpacity>\n                ))}\n              </View>\n            ) : null}\n";
if (s.split(gAnchor).length !== 2) throw new Error('game anchor');
s = s.replace(gAnchor, gAnchor + "            {item.quad ? <KvTipCrew /* KV_TIP_CREW */ id={'game:' + String(item.quad.head || '')} name={String(item.name || item.quad.game || 'game')} owner={item.quad.tip_addr || null} keepers={Array.isArray(item.keepers) ? item.keepers : []} compact /> : null}\n");
const imp = "import React"; const at = s.indexOf(imp); if (at < 0) throw new Error('import anchor');
const eol = s.indexOf('\n', at);
s = s.slice(0, eol + 1) + "import { KvTipCrew } from './kv_tip_crew'; // KV_TIP_CREW\n" + s.slice(eol + 1);
fs.writeFileSync(F, s); console.log('wired: 2 store views + game card');
