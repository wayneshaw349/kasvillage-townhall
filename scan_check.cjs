// scan_check.cjs - offline mirror of KasVillage's publish gates, for AI-assisted development.
//   node scan_check.cjs game  mygame.html     (chain GAME gate - what Workspace game publish enforces)
//   node scan_check.cjs dapp  mydapp.js       (DAPP registration scan - SDK import + sandbox rules)
// Exit 0 = would pass. The wallet's own scan is ALWAYS authoritative; this mirrors its rules so an
// AI (or you) can iterate locally. A human still publishes: Face ID + staked pledge sign every post.
const fs = require('fs');
const [, , lane, file] = process.argv;
if (!lane || !file || !fs.existsSync(file)) { console.log('usage: node scan_check.cjs game|dapp <file>'); process.exit(2); }
const src = fs.readFileSync(file, 'utf8');
const hits = [];

if (lane === 'game') {
  // mirror of html_chunks.ts BLOCKED_PATTERNS (publish-time safety gate)
  const P = [
    [/(seed|recovery|secret)\s*phrase/i, 'seed_phrase_prompt'],
    [/\b(mnemonic|12\s*[- ]?words?|24\s*[- ]?words?)\b/i, 'mnemonic_prompt'],
    [/setApprovalForAll/i, 'unlimited_approval'],
    [/eval\s*\(\s*(atob|unescape|String\.fromCharCode)/i, 'obfuscated_eval'],
    [/Function\s*\(\s*atob/i, 'obfuscated_function'],
    [/document\.write\s*\(\s*(atob|unescape)/i, 'obfuscated_write'],
    [/<iframe/i, 'iframe_not_allowed'],
    [/clipboard(Data)?\.(setData|writeText)/i, 'clipboard_write'],
    [/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/i, 'network_call'],
    [/<script[^>]*\ssrc\s*=/i, 'external_script'],
    [/<img\b/i, 'image_tag'],
    [/data:image\//i, 'embedded_image'],
    [/iVBORw0KGgo|\/9j\/4[AQ]|R0lGOD[ld]h|UklGR.{2,6}V0VCUA/, 'embedded_image_b64'],
  ];
  for (const [re, code] of P) if (re.test(src)) hits.push(code);
  const refRe = /(?:href|src|action)\s*=\s*["']([^"']+)["']/gi; let m;
  while ((m = refRe.exec(src)) !== null) {
    const v = m[1].trim();
    if (v.startsWith('kv://') || v.startsWith('#') || v.startsWith('data:audio/') || v.startsWith('data:font/')) continue;
    hits.push('external_ref: ' + v.slice(0, 70));
  }
} else if (lane === 'dapp') {
  const REQUIRED = ['procedural_sdk','kasvillage_avatar_engine','kasvillage_canvas_renderer','kasvillage_audio_ui','kasvillage_game_v1','kasvillage_game_input_paint','kasvillage_environments','kasvillage_particles','kasvillage_item_library','kasvillage_shape_dictionary','kasvillage_detail_engine','kasvillage_skia_adapter','kasvillage_wallet_bridge','kasvillage_vscode_sdk'];
  const hasSDK = REQUIRED.some(mod => src.includes("from './" + mod + "'") || src.includes("from '" + mod + "'") || src.includes('from "./' + mod + '"') || src.includes('from "' + mod + '"') || src.includes("from '@kasvillage/") || src.includes("require('./" + mod + "')"));
  if (!hasSDK) hits.push('missing_sdk_import (import at least one KasVillage SDK module)');
  const lines = src.split('\n');
  const C = [
    [/<img\s/i, '<img src>'], [/getUserMedia|navigator\.camera/i, 'camera_access'], [/<iframe|createElement\(.*iframe/i, 'iframe'],
    [/fetch\(.*\.(jpg|jpeg|png|gif|webp|bmp|tiff|ico)/i, 'fetch_image_file'], [/uploadPhoto|uploadImage|uploadFace|uploadSelfie/i, 'upload_real_image'],
    [/innerHTML\s*=/, 'innerHTML'], [/outerHTML\s*=/, 'outerHTML'], [/document\.write\s*\(/, 'document_write'], [/insertAdjacentHTML/, 'insertAdjacentHTML'],
    [/[^a-zA-Z]eval\s*\(/, 'eval'],
  ];
  lines.forEach((ln, i) => { const l = ln.trim(); if (!l || l.startsWith('//') || l.startsWith('*')) return;
    for (const [re, code] of C) if (re.test(l)) { hits.push(code + ' @ line ' + (i + 1)); break; } });
  if (/\bfetch\s*\(/.test(src)) console.log('note: fetch() found - use kvFetch() and only whitelisted domains (see RULES_AND_PRICES.md); the in-app scan checks domains.');
} else { console.log('lane must be game or dapp'); process.exit(2); }

if (hits.length) { console.log('WOULD FAIL (' + hits.length + '):'); hits.slice(0, 30).forEach(h => console.log('  - ' + h)); process.exit(1); }
console.log('WOULD PASS the ' + lane + ' gate. The in-wallet scan is authoritative - publish from Workspace (Face ID + pledge).');
