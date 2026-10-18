// wire_kv_prompt.cjs — Android parity for text prompts + long pickers.
// Creates kv_prompt.tsx:
//   kvPrompt(title, msg, buttons, type, default) - iOS: native Alert.prompt; Android: in-app modal with a TextInput
//   kvChoose(title, msg, buttons)                - iOS / <=3 buttons: Alert.alert; Android >3: in-app list (Android alerts cap at 3)
//   <KvPromptHost/>                              - mounted in VillageMailbox + Workspace
// Then swaps every Alert.prompt in VillageMailbox/Workspace to kvPrompt, drops the "iOS only" guards,
// and routes the flag-reason + mod-reason pickers (5 buttons) through kvChoose.
const fs = require('fs');

const LIB = `// kv_prompt.tsx — cross-platform prompt/chooser (iOS native, Android in-app modal)
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';

type Btn = { text: string; style?: string; onPress?: (v?: any) => void };
const _hosts: Array<(s: any) => void> = [];
const _show = (s: any) => { const h = _hosts[_hosts.length - 1]; if (h) h(s); else console.warn('[kvPrompt] no host mounted'); };

export function kvPrompt(title: string, message: string, buttons: Btn[], type: string = 'plain-text', def: string = '') {
  if (Platform.OS === 'ios' && (Alert as any).prompt) return (Alert as any).prompt(title, message, buttons, type, def);
  _show({ kind: 'prompt', title, message, buttons: buttons || [], secure: type === 'secure-text', value: def || '' });
}
export function kvChoose(title: string, message: string, buttons: Btn[]) {
  if (Platform.OS === 'ios' || (buttons || []).length <= 3) return Alert.alert(title, message, buttons as any);
  _show({ kind: 'choose', title, message, buttons: buttons || [] });
}

export function KvPromptHost() {
  const [st, setSt] = useState<any>(null);
  const [val, setVal] = useState('');
  useEffect(() => {
    const h = (s: any) => { setVal(s.value || ''); setSt(s); };
    _hosts.push(h);
    return () => { const i = _hosts.indexOf(h); if (i >= 0) _hosts.splice(i, 1); };
  }, []);
  if (!st) return null;
  const close = () => setSt(null);
  const press = (b: Btn) => { const v = val; const k = st.kind; close(); if (b && b.onPress) setTimeout(() => b.onPress!(k === 'prompt' ? v : undefined), 60); };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 18, maxHeight: '80%' }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#1c1917', marginBottom: 6 }}>{st.title}</Text>
          {st.message ? <Text style={{ fontSize: 13, color: '#44403c', marginBottom: 10 }}>{st.message}</Text> : null}
          {st.kind === 'prompt' ? (
            <TextInput value={val} onChangeText={setVal} secureTextEntry={!!st.secure} autoCapitalize="none" autoCorrect={false} autoFocus
              style={{ borderWidth: 1, borderColor: '#d6d3d1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, marginBottom: 12, color: '#1c1917' }} />
          ) : null}
          <ScrollView>
            {(st.buttons as Btn[]).map((b: Btn, i: number) => (
              <TouchableOpacity key={i} onPress={() => press(b)} style={{ paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: '#e7e5e4', alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: b.style === 'cancel' ? '400' : '700', color: b.style === 'destructive' ? '#b91c1c' : b.style === 'cancel' ? '#78716c' : '#4f46e5' }}>{b.text}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
`;

const HOST = "{(() => { const { KvPromptHost } = require('./kv_prompt'); return <KvPromptHost />; })()}";
const swaps = [
  ["RN.Platform.OS === 'ios' && (RN.Alert as any).prompt", 'true'],
  ["if (!(RN.Alert as any).prompt) { Alert.alert('iOS only for now'); return; }", ''],
  ["(RN.Alert as any).prompt(", "require('./kv_prompt').kvPrompt("],
  ["Alert.alert('Flag this listing? (0.1 KAS)',", "require('./kv_prompt').kvChoose('Flag this listing? (0.1 KAS)',"],
  ["Alert.alert('Moderator delist',", "require('./kv_prompt').kvChoose('Moderator delist',"],
];

const jobs = [
  { f: 'VillageMailbox.tsx', hostAnchor: '      {/* KV_COLD_SCAN scanner */}', hostAfter: false },
  { f: 'Workspace.tsx', hostAnchor: '<TouchableOpacity onPress={setMyContact}', hostAfter: false },
];

if (!fs.existsSync('kv_prompt.tsx')) { fs.writeFileSync('kv_prompt.tsx', LIB); console.log('kv_prompt.tsx: created'); } else console.log('kv_prompt.tsx: exists');

let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes('KvPromptHost')) { console.log(j.f + ': already patched - skipping'); continue; }
  const c = s.split(j.hostAnchor).length - 1;
  if (c !== 1) { console.error(j.f + ' host ANCHOR count ' + c + ' expected 1 (run wire_cold_scan / wire_board_grants first)'); ok = false; }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s; const counts = [];
  for (const [a, b] of swaps) { const n = s.split(a).length - 1; counts.push(n); s = s.split(a).join(b); }
  s = s.replace(j.hostAnchor, HOST + '\n' + (j.f === 'Workspace.tsx' ? '                ' : '') + j.hostAnchor);
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched (ios-guards ' + counts[0] + ', ios-only ' + counts[1] + ', prompts ' + counts[2] + ', flag picker ' + counts[3] + ', mod picker ' + counts[4] + ')');
}
console.log('DONE - prompts and long pickers work on Android too.');
