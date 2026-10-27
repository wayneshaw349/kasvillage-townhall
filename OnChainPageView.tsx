// OnChainPageView.tsx - sandboxed renderer for hash-pinned on-chain HTML pages.
//
// SANDBOX RULES (all enforced, none optional):
//   1. Page bytes come only from Kaspa L1, hash-verified in fetchHtmlPage.
//   2. originWhitelist=[] + onShouldStartLoadWithRequest blocks ALL navigation.
//      Nothing leaves the WebView. External http(s) taps show a refusal notice.
//   3. kv:// pseudo-links are intercepted and handled natively (DM, product,
//      page jump). They never reach the network layer.
//   4. No cookies, no file access, no third-party content, no cache.
//
// The page cannot phone home: publish-time and fetch-time scans strip fetch/
// XHR/sendBeacon/external script/iframe, and navigation is hard-blocked here
// as defence in depth.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { fetchHtmlPage } from './html_chunks';
import { fetchGamePuzzle, TRUSTED_GAMES, GameManifest } from './game_chunks';

// KV_HEAD_SUPERSEDE: launch the pinned build even when an installed record carries a superseded head.
const KV_HEAD_SUPERSEDE: Record<string, string> = {
  '976b8c49712ee5fd1e00a33e1042f6fd5ac24f3c135b4e1fca3a80010e476805':
    'ef0c3a6ff34488044747589b3ee301c238879f496f60bf7bfb6c9fa7292ff63a',
};
import { KV_WNET_INJECT, handleKvNetMessage, kvDevRelayAllow, kvDevRelayHost } from './kv_net_bridge';
import { useRef } from 'react';

export interface OnChainPageViewProps {
  storeAddress: string;
  pageHash: string;
  network?: string;
  ownerPubkey?: string;
  /** kv://dm -> open a mailbox thread with the page owner. */
  onDirectMessage?: (ownerPubkey: string) => void;
  /** kv://product/<id> -> open the product detail sheet. */
  onProduct?: (productId: string) => void;
  /** kv://page/<hash> -> navigate to another on-chain page at same address. */
  onPage?: (hash: string) => void;
  onClose?: () => void;
  /** Chain GAME mode: solve the hash-chained puzzle instead of a single page. */
  game?: { manifestAddress: string; manifestHash: string; head: string; relay?: string };
  /** KV_PREVIEW: test-run local HTML in the locked game player (nothing is fetched). */
  previewHtml?: string;
}

// Injected before page scripts run. Belt-and-braces: even if a link slipped the
// scanners, this converts taps into postMessage instead of navigation.
const CONSOLE_TAP = `
(function(){
  function post(kind, args){ try { window.ReactNativeWebView.postMessage(JSON.stringify({ kvlog: kind + ': ' + args.map(function(a){ try { return typeof a === 'string' ? a : JSON.stringify(a); } catch(e){ return String(a); } }).join(' ') })); } catch(e){} }
  ['log','warn','error'].forEach(function(k){ var o = console[k]; console[k] = function(){ post(k, Array.prototype.slice.call(arguments)); o && o.apply(console, arguments); }; });
  window.addEventListener('error', function(e){ post('onerror', [String(e.message || e), String(e.filename || '') + ':' + String(e.lineno || '')]); });
  window.addEventListener('unhandledrejection', function(e){ post('unhandledrejection', [String((e.reason && e.reason.message) || e.reason)]); });
})();
`;

const BRIDGE = `
(function(){
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('kv://') === 0) {
      e.preventDefault();
      window.ReactNativeWebView.postMessage(JSON.stringify({ kv: href }));
    } else if (href && href.charAt(0) !== '#') {
      e.preventDefault();
      window.ReactNativeWebView.postMessage(JSON.stringify({ blocked: href }));
    }
  }, true);
  true;
})();
`;

// [CSP-LEAK-FIX] Subresource fetches (<img src>, CSS url()/@import, fonts) are
// NOT routed through onShouldStartLoadWithRequest on either platform — a remote
// tracking pixel leaks the viewer's IP to the page author. A restrictive CSP in
// <head> closes the channel entirely: no network, inline style + data: only.
const CSP_META = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src \'none\'; media-src data:; font-src data:;">';
// KV_GAME_CSP: games run inline JS but get no network and no outside images; canvas/blob images only.
const KV_GAME_CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\'; style-src \'unsafe-inline\'; img-src data: blob:; media-src data: blob:; font-src data:; worker-src blob:; connect-src \'none\';">';
// Landscape without a native dependency. The body is laid out at swapped
// dimensions and rotated into the portrait viewport, so the game reflows as if
// the phone turned - no expo-screen-orientation, no dev-client rebuild. Touch
// coordinates map through a real CSS transform, so input keeps working.
// KV_ROLL_PROBE (dev builds only): every 2 s while a game runs, one Metro line with
// the real viewport, the landscape class, whether a Roll choice exists / is
// visible, and where the big ROLL button sits. Diagnoses the Android-tablet
// "ROLL hidden in landscape" report without guessing. Read-only; changes nothing.
const KV_ROLL_PROBE = "(function(){try{var buf=[];var t0=Date.now();var last='';setInterval(function(){try{var d=document,b=d.getElementById('kvbigroll'),dl=d.getElementById('kvx_dlg');var ch=Array.prototype.slice.call(d.querySelectorAll('div[data-i]')).map(function(e){return (e.textContent||'').trim().slice(0,12)+(e.offsetParent?'@vis':'#hidden');});var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};var t=((f.turn||0)%4)+1;var M=window.KV_MP2||{};var ow='?';try{ow=M.owns?(M.owns(t)?1:0):'?';}catch(e){}var sce='none';try{var os=Array.prototype.slice.call(d.querySelectorAll('div')).filter(function(e){return e.style&&/z-index:\\s*76/.test(e.getAttribute('style')||'');});if(os.length){var o=os[os.length-1];sce=getComputedStyle(o).display+' btns='+o.querySelectorAll('button,div[data-i]').length+' txt='+((o.textContent||'').trim().slice(0,36).replace(/\\s+/g,'_'));}}catch(e){sce='err';}var sg='';try{var els=Array.prototype.slice.call(d.querySelectorAll('div')).filter(function(e){return /^scn: /.test(e.textContent||'')&&e.children.length===0;});sg=els.length?els[els.length-1].textContent.slice(0,36):'';}catch(e){}if(window.KV_LOG&&!window.__kvNLW){window.__kvNLW=1;window.__kvNL=[];var t00=t0;var ol=window.KV_LOG;window.KV_LOG=function(m,c){try{if(/node|relay|append|discover|chain|poll|fail|drop|reach|seal|refus|fan|stor|diverg|pin|adopt|expect|block|silent|YOUR/i.test(String(m))){window.__kvNL.push('+'+Math.round((Date.now()-t00)/1000)+'s '+String(m).slice(0,90));if(window.__kvNL.length>40)window.__kvNL.shift();}}catch(e){}return ol.apply(this,arguments);};}var rxs='-';try{var rsec=(M.__lastLogAt?Math.round((Date.now()-M.__lastLogAt)/1000):-1);rxs=(rsec<0?'-':(rsec<=8?'ok':(Math.min(990,Math.round(rsec/10)*10)+'s')));}catch(e){}var nuls=0;try{var mvq=window.KV_MOVES||[];for(var q=1;q<mvq.length;q++)if(!mvq[q])nuls++;}catch(e){}var rb=d.getElementById('kv_rescue');if(rb&&!rb.__kvPW){rb.__kvPW=1;window.__kvPT=window.__kvPT||0;rb.addEventListener('pointerup',function(){window.__kvPT=(window.__kvPT||0)+1;},true);}var nd='-';try{if(window.KV_RELAY&&window.KV_RELAY.nodes){var ns=window.KV_RELAY.nodes();nd=ns.filter(function(n){return n.ok;}).length+'/'+ns.length+'f'+ns.reduce(function(a,n){return a+(n.fails||0);},0);}}catch(e){}var rsc=(rb?(rb.style.display||'?'):'-')+'/'+(window.__kvPT||0);var s='vp='+innerWidth+'x'+innerHeight+' turn=P'+t+' mine='+ow+' head='+(M.head!=null?M.head:'-')+' logN='+(M.logN||0)+' rx='+rxs+' nul='+nuls+' nd='+nd+' rsc='+rsc+' fl='+[f.seat,f.humans,f.asked,f.go,f.phase,f.moved].map(function(x){return x==null?'-':x;}).join(',')+' big='+(b?getComputedStyle(b).display:'none')+' dlg='+(dl?getComputedStyle(dl).display:'none')+' scn=['+sce+'] gate=['+sg+'] ch='+JSON.stringify(ch);if(s!==last){last=s;var line='+'+Math.round((Date.now()-t0)/1000)+'s '+s;buf.push(line);if(buf.length>60)buf.shift();console.log('[KV_ROLL] '+line);}if(window.KV_WNET&&window.KV_WNET.copy&&!window.KV_WNET.__kvRollWrap){window.KV_WNET.__kvRollWrap=1;var oc=window.KV_WNET.copy.bind(window.KV_WNET);window.KV_WNET.copy=function(x){try{if(typeof x==='string'&&x.indexOf('\"moves\"')>0){x=x+'\\n\\n[KV_ROLL_HISTORY]\\n'+buf.join('\\n')+'\\n\\n[KV_NET_LOG]\\n'+((window.__kvNL||[]).join('\\n')||'(empty)');}}catch(e){}return oc(x);};}}catch(e){console.log('[KV_ROLL] err '+e);}},2000);}catch(e){}})();";


// KV_LAND_SHIM: self-landscape for games (see wire_game_landscape.cjs)
const KV_LAND_SHIM = "(function(){try{\nif(window.__kvLandInit)return;window.__kvLandInit=1;\nvar RW=function(){return window.__kvRealW||window.screen.width;};\nvar RH=function(){return window.__kvRealH||window.screen.height;};\nif(!(RW()<RH()))return;\nwindow.__kvSelfLandscape=1;\ntry{Object.defineProperty(window,'innerWidth',{configurable:true,get:function(){return RH();}});}catch(e){}\ntry{Object.defineProperty(window,'innerHeight',{configurable:true,get:function(){return RW();}});}catch(e){}\ntry{if(window.visualViewport){Object.defineProperty(window.visualViewport,'width',{configurable:true,get:function(){return RH();}});Object.defineProperty(window.visualViewport,'height',{configurable:true,get:function(){return RW();}});}}catch(e){}\nvar st=document.createElement('style');st.textContent='html{background:#000;overflow:hidden;margin:0;padding:0;width:100%;height:100%;}';\nvar apply=function(){var b=document.body;if(!b)return false;var w=RW(),h=RH();\n if(!st.parentNode){var hd=document.head||document.documentElement;if(hd)hd.appendChild(st);}\n b.style.setProperty('position','fixed','important');b.style.setProperty('margin','0','important');\n b.style.top='0';b.style.left='0';b.style.width=h+'px';b.style.height=w+'px';b.style.overflow='hidden';\n b.style.transformOrigin='0 0';b.style.transform='translateX('+w+'px) rotate(90deg)';return true;};\nvar nat=Element.prototype.getBoundingClientRect;\nElement.prototype.getBoundingClientRect=function(){var r=nat.call(this);var w=RW();var L=r.top,T=w-r.right,W=r.height,H=r.width;\n return {left:L,top:T,right:L+W,bottom:T+H,width:W,height:H,x:L,y:T,toJSON:function(){return {left:L,top:T,width:W,height:H};}};};\nvar map=function(o){if(!o||o.__kvL)return;var sx=o.clientX,sy=o.clientY;if(typeof sx!=='number')return;var vx=sy,vy=RW()-sx;\n try{['clientX','pageX','x'].forEach(function(k){Object.defineProperty(o,k,{configurable:true,value:vx});});\n ['clientY','pageY','y'].forEach(function(k){Object.defineProperty(o,k,{configurable:true,value:vy});});\n Object.defineProperty(o,'__kvL',{value:1});}catch(e){}};\nvar tl=function(L){var a=[];if(L)for(var i=0;i<L.length;i++){var t=L[i],vx=t.clientY,vy=RW()-t.clientX;a.push({identifier:t.identifier,target:t.target,clientX:vx,clientY:vy,pageX:vx,pageY:vy,screenX:t.screenX,screenY:t.screenY,radiusX:t.radiusX,radiusY:t.radiusY,rotationAngle:t.rotationAngle,force:t.force});}a.item=function(i){return a[i]||null;};return a;};\nvar fix=function(e){if(e.__kvL)return;if(typeof TouchEvent!=='undefined'&&e instanceof TouchEvent){try{var T=tl(e.touches),C=tl(e.changedTouches),G=tl(e.targetTouches);Object.defineProperty(e,'touches',{configurable:true,value:T});Object.defineProperty(e,'changedTouches',{configurable:true,value:C});Object.defineProperty(e,'targetTouches',{configurable:true,value:G});Object.defineProperty(e,'__kvL',{value:1});}catch(x){}}else map(e);};\n['click','dblclick','contextmenu','mousedown','mouseup','mousemove','pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend','touchcancel','wheel'].forEach(function(t){window.addEventListener(t,fix,{capture:true,passive:true});});\nif(!apply()){var mo=new MutationObserver(function(){if(apply()){mo.disconnect();try{window.dispatchEvent(new Event('resize'));}catch(e){}}});mo.observe(document,{childList:true,subtree:true});}\ndocument.addEventListener('DOMContentLoaded',function(){apply();try{window.dispatchEvent(new Event('resize'));}catch(e){}});\n}catch(e){window.__kvLandErr=String(e);}})();";
const KV_ROT_JS = "(function(){try{if(window.__kvSelfLandscape)return;var r=__R__,s=__S__;var b=document.body;if(!b)return;if(!window.__kvVInit){window.__kvVInit=1;var st=document.createElement('style');st.textContent='html{background:#000;}html,body{margin:0;padding:0;overflow:hidden;}';document.head.appendChild(st);window.addEventListener('resize',function(){try{window.__kvView(window.__kvR||0,window.__kvS||0);}catch(e){}});}window.__kvNat=function(){var t=b.style.transform;b.style.transform='none';var w=1,h=1,i,c=b.children;for(i=0;i<c.length;i++){var q=c[i].getBoundingClientRect();if(q.width>w)w=q.width;if(q.bottom>h)h=q.bottom;}w=Math.max(w,b.scrollWidth,1);h=Math.max(h,b.scrollHeight,1);b.style.transform=t;return{w:w,h:h};};window.__kvView=function(rr,ss){b.style.transformOrigin='0 0';var vw=window.innerWidth,vh=window.innerHeight;var n=window.__kvNat();if(!ss){var tw=rr?vh:vw,th=rr?vw:vh;ss=Math.min(tw/n.w,th/n.h)*0.88;if(!isFinite(ss)||ss<=0)ss=1;ss=Math.round(ss*100)/100;}var x,y;if(rr){x=(vw+ss*n.h)/2;y=(vh-ss*n.w)/2;b.style.transform='translate('+x+'px,'+y+'px) rotate(90deg) scale('+ss+')';}else{x=(vw-ss*n.w)/2;if(x<0)x=0;y=(vh-ss*n.h)/2;if(y<0)y=0;b.style.transform='translate('+x+'px,'+y+'px) scale('+ss+')';}window.__kvR=rr;window.__kvS=ss;try{window.ReactNativeWebView.postMessage(JSON.stringify({kvview:1,scale:ss,w:n.w,h:n.h}));}catch(e){}};window.__kvView(r,s);}catch(e){}})();true;";

// iOS suspends a Web Audio AudioContext during inactivity. The game's
// sequencer loops correctly (step % 64, driven by setInterval) - but it
// schedules against ctx.currentTime, and a suspended context's clock STOPS.
// So `while (nt < ctx.currentTime + .12)` schedules nothing, the music goes
// silent with no error, and only a gesture plus resume() revives it. Which is
// why it always died while waiting on someone else's turn: that is exactly
// when nobody is touching the screen.
//
// The context is a closure local, so we wrap the constructor BEFORE the page
// loads, keep every instance, and resume any that fall asleep. The game is on
// chain and immutable; this fixes it from outside without a republish.
// KV_END_GUARD: never let an automatic closer end a turn under a player who is choosing.
// KasCity's three auto-closers (stall failsafe, half-open-turn healer after 8 s of
// quiet, closer guarantee) all post `end` with value 0 and none checks for an open
// Buy/Pass dialog or scenario card - so a player thinking for 8 s lost the turn.
// While a choice is open on THIS device, an `end` with value 0 is dropped (never
// queued, never replaced); the closers retry on their own once the choice closes.
// The game's own Roll prompt and the roll-for-first screen are not choices here.
// Human ends carry the turn number, rescue/bot ends carry the seat - untouched.
// Prevention only: it never posts or changes anything.
const KV_END_GUARD = "(function(){try{var vis=function(e){try{if(!e||!document.body.contains(e))return false;var cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')return false;return e.getClientRects().length>0;}catch(x){return false;}};var choiceOpen=function(){try{var ds=document.querySelectorAll('div[data-i]');for(var i=0;i<ds.length;i++)if(vis(ds[i])&&!/\\broll\\b/i.test(ds[i].textContent||''))return true;var ms=document.querySelectorAll('[data-kvmodal]');for(var k=0;k<ms.length;k++)if(vis(ms[k])&&!/roll for first/i.test(ms[k].textContent||''))return true;var os=document.querySelectorAll('div');for(var j=0;j<os.length;j++){var st=os[j].getAttribute&&os[j].getAttribute('style');if(st&&/z-index:\\s*76/.test(st)&&vis(os[j]))return true;}}catch(e){}return false;};var lastLog=0;var mk=function(fn){var w=function(seat,action,value,fx){try{if(String(action)==='end'&&(+value===0)&&choiceOpen()){var n=Date.now();if(n-lastLog>5000){lastLog=n;try{if(window.KV_LOG)window.KV_LOG('held an automatic end for P'+seat+' — a choice is open','#7fd87f');}catch(e){}}try{console.log('[KV_END_GUARD] held auto-end P'+seat);}catch(e){}return;}}catch(e){}return fn.apply(this,arguments);};try{for(var k in fn)if(Object.prototype.hasOwnProperty.call(fn,k))w[k]=fn[k];}catch(e){}w.__kvEG=1;w.__kvInner=fn;return w;};var cur=window.KV_MOVE;if(typeof cur==='function'&&!cur.__kvEG)cur=mk(cur);Object.defineProperty(window,'KV_MOVE',{configurable:true,enumerable:true,get:function(){return cur;},set:function(v){cur=(typeof v==='function'&&!v.__kvEG)?mk(v):v;}});}catch(e){}})();true;";

// KV_DLG_WATCH: clear a ghost engine dialog that froze the turn logic.
// Confirmed in-browser (room kcc40ea2ce): the engine pauses ALL turn logic while
// one of its own dialogs is open, and a guest's boot-time prompt (the game boots
// as single-player seat 1 before the multiplayer join re-seats it) can be hidden
// by the MP machinery without the engine dialog state being cleared - dialogueOpen()
// stayed true for 10 minutes with nothing on screen, so no Roll was ever offered.
// Rule: in a started relay game, if the dialog state is set but its window is not
// actually visible for 2 consecutive checks (~4s), clear it and reset the asked
// flag; the revived turn logic then re-opens the correct prompt by itself (verified
// in Chromium: ghost cleared -> fresh visible Roll prompt; legit open dialogs and
// single-player untouched).
const KV_DLG_WATCH = "(function(){try{var LOG=function(m){try{if(window.KV_LOG)window.KV_LOG(m,'#7fd87f');}catch(e){}try{console.log('[KV_DLG_WATCH] '+m);}catch(e){}};var strikes=0;setInterval(function(){try{var M=window.KV_MP2;if(!M||!M.room||!M.started){strikes=0;return;}var d=window.DLG;if(!d){strikes=0;return;}var el=null;try{el=(typeof dlgEl!=='undefined')?dlgEl:null;}catch(e){}var vis=!!(el&&el.offsetParent);if(vis){strikes=0;return;}strikes++;if(strikes<2)return;strikes=0;window.DLG=null;try{if(typeof hideDialogue==='function')hideDialogue();}catch(e){}try{if(el)el.style.display='none';}catch(e){}try{if(window.KV_SETSTATE)window.KV_SETSTATE('asked',0);}catch(e){}LOG('cleared a stale engine dialog \u2014 the turn logic was frozen behind it');}catch(e){}},2000);}catch(e){}})();true;";

// KV_ROLL_RESCUE v3: the CONTINUE button posts what the CHAIN is owed.
// The relay's turn gate (game_rooms v52+) only accepts a `roll` from the seat it
// expects and an `end` from the seat that last rolled - rescue v2's blind `end`
// was refused with not_the_roller on every node (fan-out 0/3) whenever the stuck
// seat had not rolled yet. v3 reads the local chain: last acked roll mine -> post
// the missing `end`; otherwise -> post a `roll` (same call the engine's own bot
// driver uses; the chain stores the total, devices draw the dice). If the first
// guess has not acked after ~3.5s the other is posted - the relay harmlessly
// refuses the wrong one. Player-triggered only; no engine state is touched.
const KV_ROLL_RESCUE = "(function(){try{var LOG=function(m){try{if(window.KV_LOG)window.KV_LOG(m,'#7fd87f');}catch(e){}try{console.log('[KV_RESCUE] '+m);}catch(e){}};var clickRoll=function(){try{var ds=document.querySelectorAll('div[data-i]');for(var i=0;i<ds.length;i++){var d=ds[i];if(/\\broll\\b/i.test(d.textContent||'')&&d.offsetParent){d.click();return true;}}}catch(e){}return false;};var choiceOpen=function(){try{var ds=document.querySelectorAll('div[data-i]');for(var i=0;i<ds.length;i++)if(ds[i].offsetParent)return true;var os=document.querySelectorAll('div');for(var j=0;j<os.length;j++){var st=os[j].getAttribute&&os[j].getAttribute('style');if(st&&/z-index:\\s*76/.test(st)&&getComputedStyle(os[j]).display!=='none')return true;}return false;}catch(e){return false;}};var ackedBy=function(seat,from){try{var mv=window.KV_MOVES||[];for(var i=mv.length-1;i>=0;i--){var e=mv[i];if(e&&+e.s===seat&&(e.__acked||e.acked)&&(from==null||e.i>=from))return e;if(from!=null&&e&&e.i<from)break;}}catch(e){}return null;};var lastAckedRoll=function(){try{var mv=window.KV_MOVES||[];for(var i=mv.length-1;i>=0;i--){var e=mv[i];if(e&&String(e.a)==='roll'&&(e.__acked||e.acked))return e;}}catch(e){}return null;};var fire=function(ev){if(ev){try{ev.preventDefault();ev.stopPropagation();}catch(x){}}if(btn)btn.style.display='none';try{if(clickRoll()){LOG('clicked the live roll');return;}var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};var s=((f.turn||0)%4)+1;var lr=lastAckedRoll();var mineRolled=!!(lr&&+lr.s===s);var mv0=(window.KV_MOVES||[]);var headB=mv0.length;var post=function(kind){if(typeof window.KV_MOVE!=='function')return;if(kind==='end'){LOG('posting end for P'+s+' (chain says P'+s+' rolled)');window.KV_MOVE(s,'end',s);}else{var tot=2+Math.floor(Math.random()*11);LOG('posting roll '+tot+' for P'+s+' (chain owes a roll)');window.KV_MOVE(s,'roll',tot);}};post(mineRolled?'end':'roll');setTimeout(function(){try{if(clickRoll())return;var got=ackedBy(s,headB>0?(mv0[headB-1]&&mv0[headB-1].i!=null?mv0[headB-1].i+1:null):null);if(got){LOG('chain accepted '+got.a+' — continuing');return;}LOG('no ack — trying the other move');post(mineRolled?'roll':'end');}catch(x2){}},3500);}catch(e2){LOG('rescue error '+e2);}};var btn=null;var mk=function(){if(btn)return btn;btn=document.createElement('div');btn.id='kv_rescue';btn.textContent='▶ CONTINUE';btn.style.cssText='position:fixed;left:14px;bottom:46px;z-index:9950;display:none;min-width:130px;height:52px;line-height:52px;text-align:center;padding:0 16px;border-radius:12px;background:#5a2ca0;color:#fff;font:900 18px system-ui,sans-serif;letter-spacing:1px;box-shadow:0 4px 18px rgba(0,0,0,.6);cursor:pointer;user-select:none;';var armed=0;var g=function(ev){var n=Date.now();if(n-armed<1200)return;armed=n;fire(ev);};btn.addEventListener('touchend',g,{passive:false});btn.addEventListener('pointerup',g);btn.addEventListener('click',g);(document.body||document.documentElement).appendChild(btn);return btn;};var okAt=Date.now();setInterval(function(){try{var M=window.KV_MP2;var show=false;if(M&&M.room&&M.started){var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};var s=((f.turn||0)%4)+1;var mine=false;try{mine=!!(M.owns&&M.owns(s));}catch(e){}if(mine&&!choiceOpen()){if(Date.now()-okAt>6000)show=true;}else okAt=Date.now();}else okAt=Date.now();var b=mk();if(b)b.style.display=show?'block':'none';}catch(e){}},2000);}catch(e){}})();true;";

const KV_AUDIO_KEEP = "(function(){try{var C=window.AudioContext||window.webkitAudioContext;if(!C)return;var made=[];function W(){var c=new C();made.push(c);return c;}W.prototype=C.prototype;try{window.AudioContext=W;}catch(e){}try{window.webkitAudioContext=W;}catch(e){}function kick(){for(var i=0;i<made.length;i++){var c=made[i];if(c&&c.state==='suspended'){try{c.resume();}catch(e){}}}}setInterval(kick,1500);document.addEventListener('touchstart',kick,true);document.addEventListener('touchend',kick,true);document.addEventListener('visibilitychange',kick);window.__kvAudioKick=kick;}catch(e){}})();true;";

function injectCsp(raw: string, meta: string = CSP_META): string {
  // always inject: a page's own CSP can only tighten, never loosen ours
  // KV_CSP_NOCOMMENT + KV_CSP_FIRST: never search for "<head>" - it can sit inside
  // an attribute (<p title="<head>">), a <title>, a <script> string or a comment,
  // which would put our meta inside text. Instead put the meta FIRST: at index 0,
  // or right after a leading <!doctype> (skipping only BOM / whitespace / comments
  // before it, so standards mode is kept). A <meta> before <html> is valid - the
  // parser opens the implied <html><head> and it lands in the document head,
  // ahead of every page script and style.
  let i = 0;
  if (raw.charCodeAt(0) === 0xfeff) i = 1;
  for (;;) {
    while (i < raw.length && /\s/.test(raw[i])) i++;
    if (raw.startsWith('<!--', i)) { const e = raw.indexOf('-->', i + 4); if (e < 0) break; i = e + 3; continue; }
    break;
  }
  const dm = /^<!doctype[^>]*>/i.exec(raw.slice(i, i + 512));
  if (dm) { const at = i + dm[0].length; return raw.slice(0, at) + meta + raw.slice(at); }
  return meta + raw;
}

export default function OnChainPageView(props: OnChainPageViewProps) {
  const { storeAddress, pageHash, network = 'testnet-10', ownerPubkey } = props;
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const webRef = useRef<any>(null);
  // KV_PAGE_RELOAD: games call location.reload() (KasCity does right after
  // host/join — "Reloading into multiplayer...") but our fake
  // https://kv-game.local origin resolves nowhere, so the reload died (silently
  // on iOS, ERR_NAME_NOT_RESOLVED on Android) and the page hung. Catch the
  // attempt and remount the WebView with the same HTML — a true reload;
  // localStorage (same origin) survives. Rate-limited so a page can't remount-spin.
  const kvPageUpRef = useRef(false);
  const kvReloadAtRef = useRef(0);
  const [kvReloadN, setKvReloadN] = useState(0);
  const kvDoReload = useCallback(() => {
    const now = Date.now();
    if (!kvPageUpRef.current || now - kvReloadAtRef.current < 1500) return;
    kvReloadAtRef.current = now; kvPageUpRef.current = false;
    setTimeout(() => setKvReloadN((n) => n + 1), 0);
  }, []);
  const [paySheet, setPaySheet] = useState<any>(null);
  const [rot, setRot] = useState(false);
  const [land, setLand] = useState<boolean | null>(null);
  const [wv, setWv] = useState<{ w: number; h: number } | null>(null);
  // KV_GAME_EXIT: leave the game and return to the wallet (confirm first)
  const kvAskExit = () => { if (!props.onClose) return; const RN = require('react-native');
    RN.Alert.alert('Leave the game?', 'You go back to your wallet. In an online game your seat is kept - open the game again and tap Rejoin table.', [
      { text: 'Keep playing', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => props.onClose && props.onClose() }]); };
  useEffect(() => { if (!props.game || !props.onClose) return; const RN = require('react-native');
    const sub = RN.BackHandler.addEventListener('hardwareBackPress', () => { kvAskExit(); return true; });
    return () => { try { sub.remove(); } catch {} }; }, [props.game, props.onClose]);
  const [topPad, setTopPad] = useState<number | null>(null); // KV_VIEW_FIX2: keep games below the status bar
  const [barH, setBarH] = useState<number | null>(null); const boxRef = useRef<any>(null); // KV_VIEW_FIX3: game area excludes the verified bar
  const outerRef = useRef<any>(null);
  const landKey = 'kv_land_' + String((props.game && (props.game as any).head) || 'page').slice(0, 16);
  useEffect(() => {
    if (!props.game || !html) return;
    const def = /name=["']kv-orientation["'][^>]*content=["']landscape|KV_MP2|KV_FACES/i.test(String(html).slice(0, 400000));
    (async () => { try { const AS = require('@react-native-async-storage/async-storage').default; try { const _mc = await AS.getItem('kv_dev_contact'); if (_mc) (globalThis as any).__kvDevContact = _mc; } catch {} const v = await AS.getItem(landKey); setLand(v === null || v === undefined ? def : v === '1'); } catch { setLand(def); } })();
  }, [html]);
  const toggleLand = () => { const n = !land; setLand(n); try { require('@react-native-async-storage/async-storage').default.setItem(landKey, n ? '1' : '0'); } catch {} };
  const [zoom, setZoom] = useState(1);
  // Remember how this person likes to view THIS game. Rebuilding the board
  // smaller would mean 66 fragments and ~77 KAS for a preference; a stored
  // zoom costs nothing and is per-player rather than baked in for everyone.
  const viewKey = 'kv_view_' + String((props.game && (props.game as any).head) || 'page').slice(0, 16);
  const applyView = (r: boolean, z: number) => {
    webRef.current?.injectJavaScript(KV_ROT_JS.replace('__R__', r ? '1' : '0').replace('__S__', String(z)));
    try {
      const AS = require('@react-native-async-storage/async-storage').default;
      AS.setItem(viewKey, JSON.stringify({ r, z })).catch(() => {});
    } catch {}
  };
  useEffect(() => {
    if (!props.game || !html) return;
    let alive = true;
    (async () => {
      try {
        const AS = require('@react-native-async-storage/async-storage').default;
        const raw = await AS.getItem(viewKey);
        const v = raw ? JSON.parse(raw) : null;
        if (!alive) return;
        // No stored preference: auto-fit once (scale 0 = measure and fit).
        const r = v ? !!v.r : false, z = v ? Number(v.z) || 0 : 0;
        setRot(r); setZoom(z);
        setTimeout(() => applyView(r, z), 350);
      } catch {}
    })();
    return () => { alive = false; };
  }, [html]);
  const [payBusy, setPayBusy] = useState(false);
  const [payDone, setPayDone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setHtml(null);
    setError(null);
    (async () => {
      if ((props as any).previewHtml) { if (alive) setHtml(injectCsp(String((props as any).previewHtml), KV_GAME_CSP)); return; } // KV_PREVIEW
      const res = props.game
        ? await fetchGamePuzzle(props.game.manifestAddress, props.game.manifestHash, (KV_HEAD_SUPERSEDE[props.game.head] || props.game.head), network,
            (have, total) => { if (alive) setProgress('solving puzzle ' + have + '/' + total); },
            // Coordinates must reach the fetcher here too, not only on Mailbox
            // install. Without them the coordinate walk is skipped entirely and
            // a recycled relay leaves an installed game unbootable.
            ((props.game as any).anchor_hash || (props.game as any).daa_to) ? {
              anchor_hash: (props.game as any).anchor_hash,
              daa_from: (props.game as any).daa_from,
              daa_to: (props.game as any).daa_to,
            } : undefined)
        : await fetchHtmlPage(storeAddress, pageHash, network, (props as any).coords, ownerPubkey || undefined); // KV_CHUNK_CANDIDATES: owner-signed chunks only when the announce key is known
      try { const _q: any = props.game; if (_q && _q.head) console.log('[KV] QUAD ' + JSON.stringify({ head: _q.head, anchor_hash: _q.anchor_hash, daa_from: _q.daa_from, daa_to: _q.daa_to, manifestAddress: _q.manifestAddress, manifestHash: _q.manifestHash })); } catch {}
      if (!alive) return;
      // Games: full inline-JS apps, verified by hash chain + scanner - the
      // static-page CSP (default-src none, no scripts) would kill them.
      if (res.html) setHtml(props.game ? injectCsp(res.html, KV_GAME_CSP) : injectCsp(res.html));
      else {
        const g: any = props.game || {};
        const diag = props.game
          ? ' [head ' + String(g.head || '').slice(0, 10) + ' · coords ' + (g.anchor_hash || g.daa_to ? 'yes' : 'NO') + ']'
          : '';
        try { console.log('[KV] game boot failed', { err: res.error, head: g.head, anchor: g.anchor_hash, from: g.daa_from, to: g.daa_to }); } catch {}
        setError((res.error || 'page unavailable') + diag);
      }
    })();
    return () => { alive = false; };
  }, [storeAddress, pageHash, network]);

  const handleKvLink = useCallback((href: string) => {
    const path = href.slice('kv://'.length);
    if (path === 'dm' || path.startsWith('dm/')) {
      const pk = path.startsWith('dm/') ? path.slice(3) : (ownerPubkey || '');
      if (pk && props.onDirectMessage) props.onDirectMessage(pk);
      else setNotice('No contact available for this page.');
      return;
    }
    if (path.startsWith('product/')) {
      props.onProduct?.(path.slice('product/'.length));
      return;
    }
    if (path.startsWith('page/')) {
      props.onPage?.(path.slice('page/'.length));
      return;
    }
    if (path.startsWith('pay/')) {
      if (require('react-native').Platform.OS === 'ios') { setNotice('Payments are not available inside games or pages on iPhone. Use Send in your wallet.'); return; } /* KV_IOS_PAY */
      // KV PAY - the ONE sanctioned payment surface for every on-chain page,
      // dapp and game. Format: kv://pay/<kaspa address>/<amount KAS>[?m=memo]
      // Convention users learn: KAS only ever moves through this sheet.
      try {
        const rest = path.slice(4);
        const q = rest.indexOf('?');
        const core = q >= 0 ? rest.slice(0, q) : rest;
        const qs = q >= 0 ? rest.slice(q + 1) : '';
        const segs = core.split('/');
        const addr = decodeURIComponent(segs[0] || '');
        const kas = Number(segs[1] || '0');
        const memo = qs.startsWith('m=') ? decodeURIComponent(qs.slice(2)).slice(0, 60) : '';
        const okAddr = (addr.startsWith('kaspatest:') || addr.startsWith('kaspa:')) && addr.length >= 20 && addr.length <= 80;
        if (!okAddr || !(kas > 0) || !isFinite(kas) /* KV_PAY_NOCAP */) { setNotice('Invalid payment request.'); return; }
        setPayDone(null);
        setPaySheet({ addr, kas, memo });
      } catch { setNotice('Invalid payment request.'); }
      return;
    }
    setNotice('Unsupported link: ' + href.slice(0, 40));
  }, [ownerPubkey, props]);

  const confirmPay = useCallback(async () => {
    if (!paySheet || payBusy) return;
    setPayBusy(true);
    try {
      { /* KV_PAY_AUTH: fresh Face ID / passcode for every payment */
        const LA = require('expo-local-authentication'); let _a: any = null;
        try { _a = await LA.authenticateAsync({ promptMessage: 'Pay ' + paySheet.kas + ' KAS', cancelLabel: 'Cancel', disableDeviceFallback: false }); } catch { _a = null; }
        if (!_a || !_a.success) { setPayBusy(false); if (_a && _a.error && !/cancel/i.test(String(_a.error))) setNotice('Payment needs Face ID or your phone passcode.'); return; }
      }
      const ps = require('./proposal_share');
      const getId = ps._kvResolveIdentity || ps.resolveKvIdentity || ps.kvResolveIdentity || ps.getKvIdentity || ps.resolveIdentity;
      let ident: any = getId ? await getId() : null;
      if (!ident || !ident.address || !ident.privkey) {
        const SS = require('expo-secure-store');
        ident = { address: await SS.getItemAsync('kaspa_address'), privkey: await ps._kvResolvePrivHex(), network };
      }
      if (!ident || !ident.address || !ident.privkey) throw new Error('wallet identity unavailable');
      const { sendKaspaViaRest } = require('./kaspa_rest_tx');
      const r: any = await sendKaspaViaRest({
        senderAddress: ident.address,
        recipientAddress: paySheet.addr,
        amountSompi: BigInt(Math.round(paySheet.kas * 1e8)),
        privateKeyHex: ident.privkey,
        network: (ident.network || network) as any,
      });
      if (r && r.success && (r.txId || r.transactionId)) {
        const txid = String(r.txId || r.transactionId);
        setPayDone(txid);
        webRef.current?.injectJavaScript('try{window.dispatchEvent(new CustomEvent("kvpay",{detail:{ok:true,txid:"' + txid + '",kas:' + paySheet.kas + '}}))}catch(e){};true;');
      } else {
        setNotice('Payment failed: ' + String((r && r.error) || 'unknown'));
        setPaySheet(null);
      }
    } catch (e: any) {
      setNotice('Payment failed: ' + String(e?.message || e));
      setPaySheet(null);
    }
    setPayBusy(false);
  }, [paySheet, payBusy, network]);

  const onMessage = useCallback((event: any) => {
    try { const _d = JSON.parse(event?.nativeEvent?.data || '{}'); if (_d.kvlog !== undefined) { console.log('[GamePage]', _d.kvlog); return; } } catch {}
    // KV_GAME_INVITE: share an invite / paste a table code (games only)
    try { const _g = JSON.parse(event?.nativeEvent?.data || '{}');
      if (_g && _g.kvshare && props.game) { const t = String(_g.kvshare.text || '').slice(0, 300); require('react-native').Share.share({ message: t }).catch(() => {}); return; }
      if (_g && _g.kvpaste && props.game) { (async () => { let code = ''; try { const t = await require('expo-clipboard').getStringAsync(); code = ((String(t || '').match(/kc[0-9a-f]{8}/i) || [])[0] || '').toLowerCase(); } catch {}
        try { webRef.current && webRef.current.injectJavaScript('try{window.__kvPasted&&window.__kvPasted(' + JSON.stringify(code) + ')}catch(e){};true;'); } catch {} })(); return; }
    } catch {}
    // KV_GAME_CONTACT: vetted contact handoff for player-to-player offers (no in-game money)
    try { const _c = JSON.parse(event?.nativeEvent?.data || '{}'); if (_c && _c.kvcontact && props.game) { const to = String(_c.kvcontact.to || '').replace(/[<>"'`\s]/g, '').slice(0, 80); const text = String(_c.kvcontact.text || '').slice(0, 400); if (!to) return;
      let url = '';
      if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(to)) url = 'mailto:' + to + '?subject=' + encodeURIComponent('KasCity offer') + '&body=' + encodeURIComponent(text);
      else if (/^@?[A-Za-z0-9_]{3,}$/.test(to)) url = 'https://t.me/' + to.replace(/^@/, '');
      else if (/^(https:\/\/)?(t\.me|wa\.me|ig\.me|discord\.gg|x\.com)\//i.test(to)) url = /^https:/i.test(to) ? to : 'https://' + to;
      (async () => { try { await require('expo-clipboard').setStringAsync(text); } catch {} })();
      const RN = require('react-native');
      RN.Alert.alert('Contact player', 'Your message is copied - paste it in the chat.\n\nAgree on the deal there, then settle wallet-to-wallet in KasVillage (direct send or a FROST agreement). Never pay an address you did not verify. The owner presses TRANSFER in the game after being paid.' + (url ? '' : '\n\nContact: ' + to), url ? [{ text: 'Cancel', style: 'cancel' }, { text: 'Open chat', onPress: () => { RN.Linking.openURL(url).catch(() => RN.Alert.alert('Could not open', to)); } }] : [{ text: 'OK' }]);
      return; } } catch {}
    if (handleKvNetMessage(event.nativeEvent.data, (js) => webRef.current?.injectJavaScript(js), {
      sign: !!props.game,
      // KV_DEV_RELAY: a game that declared its own multiplayer server gets that
      // single extra HTTPS host allowed and signed for - nothing else changes.
      allow: (props.game && kvDevRelayAllow((props.game as any).relay)) || undefined,
      relayHost: props.game ? kvDevRelayHost((props.game as any).relay) : null,
    })) return; // KV_WNET_SIGN: only chain games get signed requests
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.kv && /^kv:\/\//.test(String(msg.kv))) handleKvLink(msg.kv); // KV_MSG_FIX: status signals are not links
      else if (msg.blocked) setNotice('External links are disabled inside on-chain pages.');
    } catch { /* ignore malformed bridge messages */ }
  }, [handleKvLink]);

  // Hard block: nothing navigates. kv:// is routed, everything else refused.
  const onShouldStartLoadWithRequest = useCallback((req: any) => {
    const url = String(req?.url || '');
    if (url.startsWith('about:blank') || url === '' || url.startsWith('data:text/html')) return true;
    if (url.startsWith('https://kv-game.local')) {
      if (!kvPageUpRef.current) return true; // initial load (iOS routes it through here)
      kvDoReload(); return false;            // KV_PAGE_RELOAD: the page asked to reload itself
    }
    if (url.startsWith('kv://')) { handleKvLink(url); return false; }
    setNotice('External links are disabled inside on-chain pages.');
    return false;
  }, [handleKvLink, kvDoReload]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errTitle}>Page unavailable</Text>
        <Text style={styles.errBody}>{error}</Text>
        {props.onClose ? (
          <TouchableOpacity style={styles.btn} onPress={props.onClose}>
            <Text style={styles.btnText}>Close</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (!html) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loading}>{progress || 'Rebuilding page from chain…'}</Text>
      </View>
    );
  }

  // KV_TABLET_SAFE: Android tablets ignore the portrait lock and rotate the app.
  // In landscape the game area ran under the system bars, cutting off the bottom
  // strip (KasCity's ROLL button + the verified bar). Games now sit inside the
  // native safe area on the bottom/left/right (top is handled by topPad), and the
  // view re-measures on every rotation.
  const _KvSafe: any = props.game ? require('react-native-safe-area-context').SafeAreaView : View;
  return (
    <_KvSafe style={styles.fill} {...(props.game ? { edges: ['bottom', 'left', 'right'] } : {})}>
    <View ref={outerRef} style={[styles.fill, { paddingTop: topPad || 0 }]} onLayout={(e: any) => { const L = e.nativeEvent.layout;
      const done = (pad: number) => { boxRef.current = { w: L.width, h: L.height, pad }; setTopPad(pad); if (barH == null) return; const h = L.height - pad - barH; if (!wv || Math.abs(wv.w - L.width) > 1 || Math.abs(wv.h - h) > 1) setWv({ w: L.width, h }); };
      let ins = 0; try { const m = require('react-native-safe-area-context').initialWindowMetrics; ins = (m && m.insets && m.insets.top) || 0; } catch {}
      if (!props.game || !ins || topPad !== null) { done(topPad || 0); return; }
      try { outerRef.current.measureInWindow((_x: number, y: number) => done(Math.max(0, Math.round(ins - (y || 0))))); } catch { done(0); } }}>
      {props.game && (land === null || !wv || topPad === null) ? null : (
      <WebView
        key={'kvwv' + (land ? 1 : 0) + '_r' + kvReloadN + (props.game && wv ? (wv.w > wv.h ? '_L' : '_P') : '') /* KV_TABLET_SAFE */}
        source={{ html, baseUrl: 'https://kv-game.local/' }}
        originWhitelist={['https://kv-game.local']}
        ref={webRef}
        injectedJavaScriptBeforeContentLoaded={(props.game && land && wv ? 'window.__kvRealW=' + Math.round(wv.w) + ';window.__kvRealH=' + Math.round(wv.h) + ';' + KV_LAND_SHIM : (props.game && land === false ? 'window.__kvLandOff=1;' : '')) /* KV_LAND_FIX */ + CONSOLE_TAP + BRIDGE + KV_WNET_INJECT + (props.game ? KV_AUDIO_KEEP : '') + (props.game ? KV_END_GUARD : '') /* KV_END_GUARD */ + (props.game ? KV_DLG_WATCH : '') /* KV_DLG_WATCH */ + (props.game ? KV_ROLL_RESCUE : '') /* KV_ROLL_RESCUE */ + (props.game && typeof __DEV__ !== 'undefined' && __DEV__ ? KV_ROLL_PROBE : '') /* KV_ROLL_PROBE */ + (props.game ? ('try{window.KV_GRANTS=' + JSON.stringify((globalThis as any).__kvGrantsAll || {}) + ';window.KV_TRUST=' + JSON.stringify(require('./snail_rule').publicTrust()) /* KV_SNAIL_RULE: read-only trust signal for DApps */ + ';window.KV_MY_CONTACT=' + JSON.stringify(String((globalThis as any).__kvDevContact || '').slice(0, 80)) + ';}catch(e){};') : '') /* KV_GRANTS */}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onLoadEnd={() => { kvPageUpRef.current = true; }}
        onError={(e: any) => { const u = String(e?.nativeEvent?.url || ''); if (u.startsWith('https://kv-game.local')) kvDoReload(); }}
        javaScriptEnabled
        // KV_ANDROID_DOMSTORE: iOS WKWebView always has localStorage; this prop
        // is Android-only and false left localStorage null there, crashing any
        // game that persists its table (KasCity). Storage is sandboxed to the
        // kv-game.local origin inside this WebView, so parity with iOS is safe.
        domStorageEnabled={true}
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        // Games need inline audio. With allowsInlineMediaPlayback false, iOS
        // forces media out of inline playback entirely, and with the default
        // mediaPlaybackRequiresUserAction=true, anything that interrupts the
        // track needs a FRESH user gesture to resume - which never comes while
        // you are sitting watching someone else's turn. KV_MUSIC.loop was
        // already true; the loop was never the problem.
        // Both stay locked down for ordinary pages, which have no business
        // autoplaying anything.
        allowsInlineMediaPlayback={!!props.game}
        mediaPlaybackRequiresUserAction={!props.game}
        cacheEnabled={false}
        setSupportMultipleWindows={false}
        style={styles.fill}
      />
      )}
      {props.game ? (
        <View style={{ position: 'absolute', right: 6, top: '32%' }}>
          {props.onClose ? ( /* KV_GAME_EXIT */
            <TouchableOpacity onPress={() => kvAskExit()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ width: 36, height: 36, borderRadius: 18, marginBottom: 10, backgroundColor: '#b91c1c', borderWidth: 2, borderColor: '#fecaca', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>{'\u2715'}</Text>
            </TouchableOpacity>
          ) : null}
          {[
            { t: '\u27F3', on: toggleLand, hot: !!land },
            ...(land ? [] : [
            { t: '\u25A3', on: () => { setZoom(0); applyView(rot, 0); }, hot: false },
            { t: '\u2212', on: () => { const z = Math.max(0.3, Math.round((zoom - 0.15) * 100) / 100); setZoom(z); applyView(rot, z); }, hot: false },
            { t: '+', on: () => { const z = Math.min(1.5, Math.round((zoom + 0.15) * 100) / 100); setZoom(z); applyView(rot, z); }, hot: false },
            ]),
          ].map((b, i) => (
            <TouchableOpacity key={i} onPress={b.on}
              style={{ width: 36, height: 36, borderRadius: 18, marginBottom: 7,
                backgroundColor: b.hot ? '#7c3aed' : 'rgba(10,10,16,0.82)',
                borderWidth: 1, borderColor: '#7c5cff', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{b.t}</Text>
            </TouchableOpacity>
          ))}
          <Text style={{ color: '#b9a6ff', fontSize: 9, textAlign: 'center' }}>{Math.round(zoom * 100) + '%'}</Text>
        </View>
      ) : null}
      <View style={styles.verifiedBar} onLayout={(e: any) => { const bh = Math.round(e.nativeEvent.layout.height); if (bh !== barH) { setBarH(bh); const b = boxRef.current; if (b) { const h = b.h - b.pad - bh; if (!wv || Math.abs(wv.w - b.w) > 1 || Math.abs(wv.h - h) > 1) setWv({ w: b.w, h }); } } }}>
        <Text style={styles.verifiedText}>
          ⛓ On-chain page · hash {pageHash.slice(0, 12)} verified
        </Text>
      </View>
      {paySheet ? (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#17131f', borderColor: '#7c3aed', borderWidth: 2, borderRadius: 14, padding: 18 }}>
            <Text style={{ color: '#b9a6ff', fontWeight: '900', fontSize: 16, letterSpacing: 2 }}>KV PAY</Text>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 8 }}>{paySheet.kas} KAS</Text>
            {paySheet.memo ? <Text style={{ color: '#cbb9ff', fontSize: 13, marginTop: 2 }}>{paySheet.memo}</Text> : null}
            <Text style={{ color: '#8a8098', fontSize: 11, marginTop: 12 }}>to</Text>
            <Text style={{ color: '#e6e0f5', fontFamily: 'monospace', fontSize: 11 }} numberOfLines={2}>{paySheet.addr}</Text>
            <Text style={{ color: '#f0c860', fontSize: 11, marginTop: 12 }}>
              {'Requested by this ' + (props.game ? 'game' : 'page') + '. KAS only ever moves through this sheet - never type amounts, addresses or your seed inside a page.'}
            </Text>
            {payDone ? (
              <Text style={{ color: '#34d399', fontSize: 12, marginTop: 12 }} numberOfLines={1}>{'sent \u2713 ' + payDone.slice(0, 18) + '\u2026'}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <TouchableOpacity disabled={payBusy} onPress={() => { setPaySheet(null); setPayDone(null); }}
                style={{ flex: 1, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: '#aaa', fontWeight: '700' }}>{payDone ? 'CLOSE' : 'CANCEL'}</Text>
              </TouchableOpacity>
              {!payDone ? (
                <TouchableOpacity disabled={payBusy} onPress={confirmPay}
                  style={{ flex: 1, backgroundColor: payBusy ? '#555' : '#7c3aed', borderRadius: 10, padding: 12, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '900' }}>{payBusy ? 'SENDING\u2026' : 'CONFIRM & SEND'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
      {notice ? (
        <TouchableOpacity style={styles.toast} onPress={() => setNotice(null)}>
          <Text style={styles.toastText}>{notice}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
    </_KvSafe>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loading: { marginTop: 12, color: '#8a8a8a', fontSize: 13 },
  errTitle: { fontSize: 16, fontWeight: '600', color: '#c0392b', marginBottom: 6 },
  errBody: { fontSize: 13, color: '#8a8a8a', textAlign: 'center' },
  btn: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 9, backgroundColor: '#2b2b2b', borderRadius: 6 },
  btnText: { color: '#fff', fontSize: 13 },
  verifiedBar: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#10231a', borderTopWidth: 1, borderTopColor: '#1d3a2c' },
  verifiedText: { color: '#49c07a', fontSize: 11 },
  toast: { position: 'absolute', left: 16, right: 16, bottom: 48, backgroundColor: 'rgba(30,30,30,0.95)', padding: 12, borderRadius: 8 },
  toastText: { color: '#eee', fontSize: 12, textAlign: 'center' },
});
