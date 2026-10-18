// kv_prompt.tsx — cross-platform prompt/chooser (iOS native, Android in-app modal)
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
