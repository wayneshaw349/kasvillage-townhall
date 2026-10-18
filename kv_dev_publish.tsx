// kv_dev_publish.tsx - developer onboarding for "Publish your game" (Workspace).
// Plain-language fixes for every scan code, auto id from <title>, the chain clock,
// file reading for the picker, the starter template and the in-app guide.
import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity } from 'react-native';

export const KV_CHAIN_HOURS = 30; // measured TN10 retention (~1.1M blocks)

export function looksLikeHtml(t: string): boolean {
  return /<(html|body|script|canvas|div|svg)\b/i.test(String(t || ''));
}

export function cleanId(s: string): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}

/** "Tap Rush" -> tap-rush. Falls back to the file name / link. */
export function slugFromHtml(html: string, fallback: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html || ''));
  let s = cleanId(m ? m[1] : '');
  if (s.length < 3) s = cleanId(String(fallback || '').split('?')[0].split('/').pop()!.replace(/\.html?$/i, ''));
  if (s.length < 3) s = 'my-game';
  return s;
}

const FIX: Record<string, [string, string]> = {
  network_call: ['Your game talks to the internet (XMLHttpRequest / sendBeacon).', 'Remove it. Games run offline inside the wallet; keep data in the game or in localStorage.'],
  external_script: ['Your game loads a script from another site (<script src=...>).', 'Paste that library\'s code inside your .html in a <script> block.'],
  external_ref: ['Your game links to something outside the file (href / src / action).', 'Put everything inside the one .html file. Links to other sites are not allowed.'],
  iframe_not_allowed: ['Your game uses an <iframe>.', 'Remove it. Draw that part directly in your page.'],
  image_tag: ['Your game uses an <img> picture.', 'Draw it in code instead (canvas, SVG or CSS shapes). Photos are not allowed.'],
  embedded_image: ['Your game has a picture pasted inside it (data:image).', 'Draw it in code instead (canvas, SVG or CSS shapes). Photos are not allowed.'],
  embedded_image_b64: ['Your game hides a picture inside a script (PNG/JPEG/GIF/WEBP data).', 'Remove it and draw the art in code. Every image must be generated.'],
  clipboard_write: ['Your game writes to the clipboard.', 'Remove it. Show the text on screen so the player can copy it themselves.'],
  seed_phrase_prompt: ['Your game mentions a seed / recovery phrase.', 'Remove that text. Nothing in a game may ask about wallet secrets.'],
  mnemonic_prompt: ['Your game mentions a mnemonic or "12 / 24 words".', 'Reword it. Those words look like a wallet-secret request.'],
  unlimited_approval: ['Your game contains setApprovalForAll.', 'Remove it. Games cannot ask for wallet approvals.'],
  obfuscated_eval: ['Your game runs hidden code (eval of encoded text).', 'Ship your code as plain JavaScript.'],
  obfuscated_function: ['Your game builds code from encoded text (Function(atob...)).', 'Ship your code as plain JavaScript.'],
  obfuscated_write: ['Your game writes hidden code into the page.', 'Ship your code as plain JavaScript.'],
  too_large: ['Your game is bigger than 8 MB.', 'Shrink it: compress audio, remove unused code, generate art in code.'],
};
const CONTENT: Record<string, string> = {
  child_safety: 'Your game has text that is never allowed.',
  credential_phishing: 'Your game has text that looks like it asks for wallet keys or phrases.',
  threat: 'Your game has threatening text.',
  real_money_gambling: 'Your game mentions real-money betting.',
  gambling: 'Your game uses casino / betting words.',
  mixed_script: 'Some words mix alphabets (like a Cyrillic letter inside an English word).',
  slur: 'Your game has a slur.',
  adult: 'Your game has adult content.',
  weapons: 'Your game mentions selling weapons or conversions.',
  scam: 'Your game has text that reads like a scam (giveaways, doubling, keys).',
  illegal_trade: 'Your game has text about selling drugs or other illegal goods.',
  trafficking: 'Your game has text that is never allowed.',
};

/** Turns build issues ('page: image_tag ...', 'fragment 2: network_call', 'content: adult') into plain fixes. */
export function friendlyIssues(issues: string[]): string[] {
  const out: string[] = []; const seen = new Set<string>();
  for (const raw of issues || []) {
    const s = String(raw || '');
    let key = '', line = '';
    const c = /^content:\s*(\w+)/.exec(s);
    if (c) { key = 'content:' + c[1]; line = '• ' + (CONTENT[c[1]] || 'Some text did not pass review.') + '\n  Fix: remove or reword that text.'; }
    else {
      const m = /^(?:page|fragment \d+):\s*(\w+)(?:\s+(.*))?$/.exec(s);
      if (m) { key = m[1]; const f = FIX[m[1]]; line = f ? '• ' + f[0] + (m[2] ? '\n  (' + m[2].slice(0, 50) + ')' : '') + '\n  Fix: ' + f[1] : '• Blocked: ' + m[1] + '\n  Fix: remove that part and try again.'; }
      else if (/too many address slots/.test(s)) { key = 'slots'; line = '• Your game is too large to publish.\n  Fix: make the file smaller (under ~8 MB).'; }
      else if (/game id/.test(s)) { key = 'id'; line = '• The name must be 3-48 letters, numbers or dashes.'; }
      else if (/empty page/.test(s)) { key = 'empty'; line = '• The file is empty.'; }
      else { key = s; line = '• ' + s; }
    }
    if (!seen.has(key)) { seen.add(key); out.push(line); }
  }
  return out;
}

/** Repost clock for a listing. */
export function expiryInfo(publishedAt?: number): { label: string; color: string; hoursLeft: number } {
  if (!publishedAt) return { label: 'not on chain yet - PUBLISH & LIST to go live', color: '#9a8f78', hoursLeft: -1 };
  const left = KV_CHAIN_HOURS - (Date.now() - publishedAt) / 3600000;
  if (left <= 0) return { label: 'expired from chain - installed players keep it; PUBLISH & LIST to make it downloadable again', color: '#e06c5a', hoursLeft: 0 };
  const h = Math.max(1, Math.round(left));
  if (left < 6) return { label: 'expires in ~' + h + 'h - refresh soon with PUBLISH & LIST', color: '#f59e0b', hoursLeft: left };
  return { label: 'live - downloadable for ~' + h + 'h more', color: '#4ade80', hoursLeft: left };
}

/** Reads a picked file (expo-file-system new API, legacy API, then fetch). */
export async function readPickedText(uri: string): Promise<string> {
  try { const FS: any = require('expo-file-system'); if (FS && FS.File) return await new FS.File(uri).text(); } catch {}
  try { const L: any = require('expo-file-system/legacy'); if (L && L.readAsStringAsync) return await L.readAsStringAsync(uri); } catch {}
  const r = await fetch(uri); return await r.text();
}

export const KV_GAME_TEMPLATE = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>Moo Catch</title>
<style>html,body{margin:0;height:100%;background:#10182a;overflow:hidden;font-family:system-ui;color:#fff}
canvas{display:block;width:100vw;height:100vh;touch-action:none}#hud{position:fixed;top:10px;left:12px;font-weight:800}</style></head>
<body><div id="hud">0</div><canvas id="c"></canvas>
<script>
// KasVillage starter: one file, art drawn in code, no network, no pictures.
var c=document.getElementById('c'),x=c.getContext('2d'),W,H;
function fit(){W=c.width=innerWidth;H=c.height=innerHeight;}addEventListener('resize',fit);fit();
var cow={x:W/2},stars=[],score=0,best=+(localStorage.getItem('moo_best')||0);
// Boards a player received from you (SEND BOARD) show up here:
var boards=((window.KV_GRANTS||{})['moo-catch'])||[];var gold=boards.indexOf('gold-cow')>=0;
function move(e){var t=e.touches?e.touches[0]:e;cow.x=t.clientX;}
c.addEventListener('touchmove',function(e){e.preventDefault();move(e);},{passive:false});c.addEventListener('mousemove',move);c.addEventListener('touchstart',move);
function drawCow(px,py){x.fillStyle=gold?'#f5c542':'#f4f1ea';x.beginPath();x.ellipse(px,py,34,22,0,0,7);x.fill();
x.fillStyle='#2b2b2b';x.beginPath();x.arc(px-12,py-4,7,0,7);x.arc(px+14,py+6,6,0,7);x.fill();
x.fillStyle='#f4b6c2';x.beginPath();x.ellipse(px+30,py-8,12,9,0,0,7);x.fill();
x.fillStyle='#2b2b2b';x.fillRect(px-24,py+16,6,12);x.fillRect(px+16,py+16,6,12);}
function drawStar(s){x.fillStyle='#ffd84d';x.beginPath();for(var i=0;i<10;i++){var r=i%2?5:12,a=i*Math.PI/5-Math.PI/2;x.lineTo(s.x+r*Math.cos(a),s.y+r*Math.sin(a));}x.fill();}
function tick(){x.fillStyle='#10182a';x.fillRect(0,0,W,H);
if(Math.random()<0.03)stars.push({x:20+Math.random()*(W-40),y:-10,v:2+Math.random()*3});
var cy=H-60;for(var i=stars.length-1;i>=0;i--){var s=stars[i];s.y+=s.v;drawStar(s);
if(Math.abs(s.x-cow.x)<40&&Math.abs(s.y-cy)<26){stars.splice(i,1);score++;if(score>best){best=score;localStorage.setItem('moo_best',best);}}
else if(s.y>H+20)stars.splice(i,1);}
drawCow(cow.x,cy);document.getElementById('hud').textContent=score+' stars  (best '+best+')'+(gold?'  GOLD COW':'');
requestAnimationFrame(tick);}tick();
</script></body></html>`;

const GUIDE: Array<[string, string]> = [
  ['1. One file', 'Your whole game is ONE .html file: HTML, CSS and JavaScript inside it. No other files, no links to other sites.'],
  ['2. Draw your art in code', 'Use <canvas>, SVG or CSS shapes. Pictures (<img>, pasted image data, photos) are not allowed. Every image in KasVillage is generated, so nothing harmful can be uploaded.'],
  ['3. No internet', 'Games run offline inside the wallet. No fetch / XMLHttpRequest / outside scripts. Save progress with localStorage.'],
  ['4. Clean text', 'No adult content, gambling, weapons or drug sales, scams, slurs, or anything asking for wallet keys or phrases. The wallet checks every word before upload.'],
  ['5. Name it', 'Set a <title>. "Moo Catch" becomes the id moo-catch automatically.'],
  ['6. Publish', 'Workspace → DApps → PUBLISH YOUR GAME. Pick the file (or paste it / give a link). The wallet checks it, you TEST RUN it in the real player, then PUBLISH & LIST.'],
  ['7. Cost', 'About 0.2 KAS per chunk of your game, parked in your own addresses (reclaimable), plus ~1 KAS to list it. The exact amount shows before you pay.'],
  ['8. Keep it fresh', 'The chain keeps data about 30 hours. Players who installed it keep it forever; for NEW players, refresh with PUBLISH & LIST before the clock on your row runs out.'],
  ['9. Extra boards', 'First board free. Sell more outside the app (Contact dev), then deliver with SEND BOARD. Your game reads window.KV_GRANTS["your-id"] to see which boards a player received.'],
];

export function KvDevGuide(props: { visible: boolean; onClose: () => void; onTemplate?: () => void }) {
  if (!props.visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={props.onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#141210', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 18, maxHeight: '88%', borderWidth: 1, borderColor: '#6a5a34' }}>
          <Text style={{ color: '#f0c860', fontWeight: '900', fontSize: 17, marginBottom: 10 }}>Make a KasVillage game</Text>
          <ScrollView>
            {GUIDE.map(([h, b]) => (
              <View key={h} style={{ marginBottom: 12 }}>
                <Text style={{ color: '#f0e6d0', fontWeight: '800', fontSize: 14 }}>{h}</Text>
                <Text style={{ color: '#c8bca4', fontSize: 13, lineHeight: 19, marginTop: 2 }}>{b}</Text>
              </View>
            ))}
          </ScrollView>
          {props.onTemplate ? (
            <TouchableOpacity onPress={() => { props.onClose(); setTimeout(() => props.onTemplate && props.onTemplate(), 350); }} style={{ backgroundColor: '#13261f', borderWidth: 1, borderColor: '#16a34a', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: '#4ade80', fontWeight: '800' }}>Start from the template</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={props.onClose} style={{ padding: 12, alignItems: 'center', marginTop: 4 }}>
            <Text style={{ color: '#9a8f78', fontWeight: '700' }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
