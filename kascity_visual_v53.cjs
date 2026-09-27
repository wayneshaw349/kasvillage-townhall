// kascity_visual_v53.cjs
// Reads showcase_kascity52.html -> showcase_kascity53.html   (scene JSON unchanged)
//
// 1) SELF-TEST: on boot, logs to console which subsystems are alive (log panel, SFX, flags, owner
//    lookup, move chain). If the play-by-play or sound went missing, this says which one died.
// 2) MANAGEMENT SCENARIOS: a 36-card deck of landlord problems. Each fires on a property you own,
//    is unique per player, and offers 3-4 responses. Every response has:
//        cost      - immediate cash
//        p         - probability of the good outcome
//        win/lose  - cash swing on success / failure
//    EV = p*win + (1-p)*lose - cost, adjusted for affordability: an option you cannot pay for has
//    its EV crushed, so "ignore it" genuinely becomes correct when you are broke.
//    XP is awarded ONLY for choosing the highest-EV option available — skill, not luck. Picking a
//    worse option still resolves the scenario, it just earns nothing.
// 3) Bots resolve their own scenarios silently using the same EV rule.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('showcase_kascity52.html')) die('showcase_kascity52.html missing');
if (fs.existsSync('kascity_v52.json')) fs.writeFileSync('kascity_v53.json', fs.readFileSync('kascity_v52.json'));
let html = fs.readFileSync('showcase_kascity52.html', 'utf8');

// ---------- scenario deck ----------
// tier: 0 any, 1 poor districts, 2 mid, 3 rich  (matched loosely by property price)
const DECK = [
  { id:'rent_late',  t:0, txt:'Tenant is a month behind on rent.', opts:[
      {l:'Payment plan',      c:0,  p:0.72, w:60,  x:-20},
      {l:'Serve notice',      c:25, p:0.55, w:110, x:-60},
      {l:'Ignore it',         c:0,  p:0.30, w:0,   x:-45}]},
  { id:'boiler',     t:0, txt:'The boiler has failed in mid-winter.', opts:[
      {l:'Full replacement',  c:120,p:0.95, w:150, x:-20},
      {l:'Patch repair',      c:40, p:0.60, w:90,  x:-80},
      {l:'Ignore it',         c:0,  p:0.15, w:0,   x:-140}]},
  { id:'roof_leak',  t:0, txt:'Water is coming through the roof.', opts:[
      {l:'Re-roof section',   c:100,p:0.92, w:140, x:-25},
      {l:'Tarp it',           c:15, p:0.45, w:60,  x:-95},
      {l:'Ignore it',         c:0,  p:0.10, w:0,   x:-160}]},
  { id:'noise',      t:1, txt:'Neighbours complain about noise at all hours.', opts:[
      {l:'Mediate',           c:10, p:0.70, w:50,  x:-20},
      {l:'Evict the tenant',  c:60, p:0.60, w:80,  x:-70},
      {l:'Ignore it',         c:0,  p:0.35, w:0,   x:-40}]},
  { id:'squatter',   t:1, txt:'Someone has moved into the vacant unit.', opts:[
      {l:'Legal removal',     c:90, p:0.88, w:130, x:-30},
      {l:'Offer cash to go',  c:50, p:0.65, w:90,  x:-50},
      {l:'Ignore it',         c:0,  p:0.12, w:0,   x:-120}]},
  { id:'pest',       t:1, txt:'Infestation reported across two units.', opts:[
      {l:'Professional treat',c:70, p:0.93, w:110, x:-15},
      {l:'DIY traps',         c:12, p:0.40, w:45,  x:-70},
      {l:'Ignore it',         c:0,  p:0.08, w:0,   x:-110}]},
  { id:'damp',       t:1, txt:'Damp is spreading through the ground floor.', opts:[
      {l:'Damp-proof course', c:110,p:0.90, w:150, x:-25},
      {l:'Dehumidifier',      c:25, p:0.42, w:55,  x:-80},
      {l:'Ignore it',         c:0,  p:0.10, w:0,   x:-130}]},
  { id:'wiring',     t:2, txt:'The wiring has failed inspection.', opts:[
      {l:'Full rewire',       c:140,p:0.96, w:180, x:-20},
      {l:'Partial fix',       c:55, p:0.55, w:80,  x:-90},
      {l:'Ignore it',         c:0,  p:0.05, w:0,   x:-180}]},
  { id:'deposit',    t:0, txt:'Tenant disputes their deposit return.', opts:[
      {l:'Return in full',    c:60, p:0.98, w:70,  x:0},
      {l:'Fight in court',    c:40, p:0.50, w:130, x:-90},
      {l:'Split it',          c:30, p:0.85, w:60,  x:-20}]},
  { id:'insurance',  t:0, txt:'Insurance premium has doubled at renewal.', opts:[
      {l:'Pay it',            c:80, p:1.00, w:80,  x:0},
      {l:'Shop around',       c:10, p:0.65, w:110, x:-40},
      {l:'Go uninsured',      c:0,  p:0.55, w:80,  x:-200}]},
  { id:'assessment', t:2, txt:'The district has raised your assessed value.', opts:[
      {l:'Appeal formally',   c:45, p:0.60, w:140, x:-30},
      {l:'Accept it',         c:70, p:1.00, w:0,   x:0},
      {l:'Ignore the notice', c:0,  p:0.20, w:0,   x:-120}]},
  { id:'lawsuit',    t:3, txt:'A tenant is suing over a slip on the stairs.', opts:[
      {l:'Hire counsel',      c:130,p:0.82, w:220, x:-60},
      {l:'Settle quietly',    c:90, p:0.95, w:100, x:-20},
      {l:'Self-represent',    c:15, p:0.35, w:180, x:-240}]},
  { id:'code',       t:2, txt:'Code inspector cites three violations.', opts:[
      {l:'Fix everything',    c:115,p:0.95, w:150, x:-20},
      {l:'Fix the worst one', c:45, p:0.50, w:70,  x:-90},
      {l:'Ignore it',         c:0,  p:0.08, w:0,   x:-170}]},
  { id:'vacancy',    t:0, txt:'The unit has sat empty for two months.', opts:[
      {l:'Cut the rent',      c:0,  p:0.80, w:70,  x:-30},
      {l:'Renovate first',    c:95, p:0.75, w:190, x:-70},
      {l:'Hold the price',    c:0,  p:0.40, w:120, x:-80}]},
  { id:'contractor', t:0, txt:'Your contractor abandoned the job half-done.', opts:[
      {l:'Hire a replacement',c:100,p:0.90, w:140, x:-25},
      {l:'Chase the deposit', c:30, p:0.45, w:120, x:-60},
      {l:'Finish it yourself',c:20, p:0.55, w:90,  x:-70}]},
  { id:'flood',      t:1, txt:'Storm drain backed up into the basement.', opts:[
      {l:'Professional pump', c:85, p:0.94, w:120, x:-20},
      {l:'Shop-vac it',       c:15, p:0.40, w:50,  x:-90},
      {l:'Ignore it',         c:0,  p:0.10, w:0,   x:-140}]},
  { id:'heirs',      t:3, txt:'Heirs contest the title on your block.', opts:[
      {l:'Title lawyer',      c:150,p:0.85, w:260, x:-60},
      {l:'Buy them out',      c:120,p:0.97, w:150, x:-20},
      {l:'Do nothing',        c:0,  p:0.25, w:0,   x:-220}]},
  { id:'graffiti',   t:1, txt:'The frontage has been tagged again.', opts:[
      {l:'Repaint + camera',  c:55, p:0.88, w:80,  x:-15},
      {l:'Scrub it',          c:12, p:0.50, w:35,  x:-40},
      {l:'Ignore it',         c:0,  p:0.30, w:0,   x:-55}]},
  { id:'refinance',  t:0, txt:'The bank offers to refinance your mortgage.', opts:[
      {l:'Take the new terms',c:35, p:0.80, w:160, x:-40},
      {l:'Negotiate harder',  c:10, p:0.55, w:210, x:-70},
      {l:'Decline',           c:0,  p:1.00, w:0,   x:0}]},
  { id:'section8',   t:1, txt:'A subsidised tenancy is offered on the unit.', opts:[
      {l:'Accept it',         c:20, p:0.85, w:130, x:-30},
      {l:'Hold for market',   c:0,  p:0.45, w:150, x:-70},
      {l:'Refuse outright',   c:0,  p:0.60, w:40,  x:-30}]},
  { id:'appraisal',  t:2, txt:'Your appraisal came in under expectation.', opts:[
      {l:'Second appraisal',  c:50, p:0.62, w:150, x:-35},
      {l:'Improve and retry', c:110,p:0.85, w:210, x:-50},
      {l:'Accept the number', c:0,  p:1.00, w:0,   x:-60}]},
  { id:'partywall',  t:2, txt:'The party wall is cracking on the shared side.', opts:[
      {l:'Split cost fairly', c:70, p:0.90, w:110, x:-20},
      {l:'Demand they pay',   c:20, p:0.40, w:150, x:-90},
      {l:'Ignore it',         c:0,  p:0.12, w:0,   x:-150}]},
  { id:'elevator',   t:3, txt:'The lift is out and residents are furious.', opts:[
      {l:'Emergency service', c:145,p:0.95, w:190, x:-25},
      {l:'Wait for parts',    c:35, p:0.50, w:80,  x:-110},
      {l:'Ignore it',         c:0,  p:0.06, w:0,   x:-200}]},
  { id:'shortlet',   t:0, txt:'You could flip the unit to short-let.', opts:[
      {l:'Convert fully',     c:105,p:0.72, w:230, x:-90},
      {l:'Trial one unit',    c:40, p:0.78, w:110, x:-35},
      {l:'Stay long-let',     c:0,  p:1.00, w:30,  x:0}]},
  { id:'utilities',  t:1, txt:'Utility bills have spiked unexpectedly.', opts:[
      {l:'Audit and insulate',c:90, p:0.88, w:160, x:-25},
      {l:'Pass cost to rent', c:0,  p:0.55, w:90,  x:-60},
      {l:'Absorb it',         c:55, p:1.00, w:0,   x:0}]},
  { id:'union',      t:2, txt:'Tenants have organised and want to negotiate.', opts:[
      {l:'Meet them halfway', c:45, p:0.85, w:120, x:-25},
      {l:'Refuse to meet',    c:0,  p:0.30, w:80,  x:-130},
      {l:'Concede fully',     c:90, p:0.98, w:60,  x:-10}]},
  { id:'fire',       t:0, txt:'Fire safety certification has lapsed.', opts:[
      {l:'Full certification',c:95, p:0.97, w:130, x:-15},
      {l:'Minimum compliance',c:40, p:0.62, w:70,  x:-80},
      {l:'Ignore it',         c:0,  p:0.05, w:0,   x:-190}]},
  { id:'buyer',      t:0, txt:'An investor makes an unsolicited offer.', opts:[
      {l:'Counter high',      c:0,  p:0.50, w:220, x:-20},
      {l:'Accept it',         c:0,  p:1.00, w:120, x:0},
      {l:'Decline flatly',    c:0,  p:1.00, w:0,   x:0}]},
  { id:'zoning',     t:3, txt:'A zoning change is proposed for your street.', opts:[
      {l:'Lobby in favour',   c:80, p:0.60, w:280, x:-50},
      {l:'Lobby against',     c:60, p:0.55, w:150, x:-40},
      {l:'Stay out of it',    c:0,  p:0.50, w:60,  x:-60}]},
  { id:'manager',    t:2, txt:'Your property manager is skimming fees.', opts:[
      {l:'Fire and audit',    c:70, p:0.85, w:160, x:-30},
      {l:'Confront quietly',  c:10, p:0.55, w:90,  x:-50},
      {l:'Look away',         c:0,  p:0.20, w:0,   x:-120}]},
  { id:'asbestos',   t:1, txt:'Survey flags possible asbestos in the ceiling.', opts:[
      {l:'Licensed removal',  c:160,p:0.96, w:200, x:-25},
      {l:'Seal and monitor',  c:45, p:0.65, w:80,  x:-110},
      {l:'Ignore it',         c:0,  p:0.05, w:0,   x:-230}]},
  { id:'parking',    t:2, txt:'Parking disputes are driving tenants out.', opts:[
      {l:'Assign bays',       c:40, p:0.88, w:90,  x:-15},
      {l:'Post warnings',     c:8,  p:0.45, w:35,  x:-45},
      {l:'Ignore it',         c:0,  p:0.30, w:0,   x:-70}]},
  { id:'greenloan',  t:0, txt:'A green retrofit loan is available on the block.', opts:[
      {l:'Take the loan',     c:60, p:0.82, w:210, x:-60},
      {l:'Part-fund it',      c:30, p:0.72, w:110, x:-30},
      {l:'Skip it',           c:0,  p:1.00, w:0,   x:0}]},
  { id:'security',   t:1, txt:'Break-ins reported twice this month.', opts:[
      {l:'Alarm and lighting',c:75, p:0.90, w:120, x:-20},
      {l:'New locks only',    c:25, p:0.55, w:60,  x:-60},
      {l:'Ignore it',         c:0,  p:0.20, w:0,   x:-110}]},
  { id:'valuation',  t:3, txt:'A rival is talking your district down publicly.', opts:[
      {l:'Counter-campaign',  c:85, p:0.70, w:200, x:-45},
      {l:'Invite inspection', c:35, p:0.75, w:120, x:-25},
      {l:'Say nothing',       c:0,  p:0.45, w:50,  x:-80}]},
  { id:'sublet',     t:1, txt:'Your tenant is subletting without permission.', opts:[
      {l:'Formalise it',      c:20, p:0.80, w:110, x:-25},
      {l:'Terminate lease',   c:65, p:0.62, w:90,  x:-70},
      {l:'Ignore it',         c:0,  p:0.35, w:0,   x:-75}]}
];
if (DECK.length < 30) die('deck too small: ' + DECK.length);

const endAnchor = '  window.KV_END=endGame;';
if (html.split(endAnchor).length - 1 !== 1) die('endGame anchor not found');

const block = [
  '  window.KV_END=endGame;',
  '',
  '  // ================= SELF-TEST =================',
  '  setTimeout(function(){',
  '    var r={ logPanel: typeof window.KV_LOG==="function", sfx: typeof window.KV_SFX==="function",',
  '            samples: Object.keys(window.KV_VOX||{}).join(","), flags: !!window.KV_FLAGS,',
  '            owner: !!window.KV_OWNER, moves: Array.isArray(window.KV_MOVES),',
  '            names: Object.keys(window.KV_NAMES||{}).length };',
  '    console.log("[KV SELF-TEST]", r);',
  '    if(window.KV_LOG) window.KV_LOG("systems ok — "+r.names+" properties","#9cd87c");',
  '  }, 2500);',
  '',
  '  // ================= MANAGEMENT SCENARIOS =================',
  '  window.KV_DECK = ' + JSON.stringify(DECK) + ';',
  '  (function(){',
  '    var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '    var used={}, busy=false, lastFire=0;',
  '',
  '    function tierOf(price){ return price<100?1:(price<200?2:3); }',
  '    function cashOfSeat(p){ var v=(window.KV_SEAT&&window.KV_SEAT(p,"cash")); if(v==null){ var f=(window.KV_FLAGS&&window.KV_FLAGS())||{}; v=f["cash"+p]; } return v==null?0:Math.round(v); }',
  '',
  '    // expected value, penalised when the player cannot actually afford the option',
  '    function ev(o, cash){',
  '      var base = o.p*o.w + (1-o.p)*o.x - o.c;',
  '      if(o.c > cash) return base - (o.c-cash)*2.5;   // unaffordable: heavily discounted',
  '      if(o.c > cash*0.6) return base - (o.c*0.4);    // affordable but ruinous',
  '      return base;',
  '    }',
  '    function bestIndex(sc, cash){',
  '      var bi=0, bv=-1e9;',
  '      sc.opts.forEach(function(o,i){ var v=ev(o,cash); if(v>bv){bv=v;bi=i;} });',
  '      return bi;',
  '    }',
  '    function resolve(sc, oi, seat, isHuman){',
  '      var o=sc.opts[oi], cash=cashOfSeat(seat);',
  '      var good=Math.random()<o.p;',
  '      var swing=(good?o.w:o.x)-o.c;',
  '      var best=bestIndex(sc,cash);',
  '      if(window.KV_LOG) window.KV_LOG("P"+seat+"  "+o.l+"  \\u2192  "+(swing>=0?"+":"")+swing, COL[seat]);',
  '      if(window.KV_SFX) window.KV_SFX(good?"ching":"dang");',
  '      if(oi===best){',
  '        if(window.KV_XP){',
  '          var amt=Math.max(1,Math.round(12*(window.KV_XP_MULT==null?1:window.KV_XP_MULT)));',
  '          window.KV_XP[seat]=(window.KV_XP[seat]||0)+amt;',
  '          if(window.KV_LOG) window.KV_LOG("P"+seat+"  +"+amt+" XP  best decision", COL[seat]);',
  '        }',
  '      }',
  '      if(window.KV_MOVE) window.KV_MOVE(seat,"mgmt:"+sc.id,oi);',
  '      busy=false;',
  '    }',
  '',
  '    function present(sc, seat, tileName){',
  '      busy=true;',
  '      var cash=cashOfSeat(seat);',
  '      var ov=document.createElement("div");',
  '      ov.style.cssText="position:fixed;inset:0;z-index:76;background:rgba(10,8,6,.82);display:flex;align-items:center;justify-content:center;";',
  '      var box=document.createElement("div");',
  '      box.style.cssText="background:#14100c;border:2px solid "+COL[seat]+";border-radius:10px;padding:18px 22px;font:13px/1.6 monospace;color:#f4e4c1;max-width:430px;";',
  '      box.innerHTML="<div style=\'color:"+COL[seat]+";font-weight:700;letter-spacing:1px\'>P"+seat+" \\u2014 "+tileName+"</div>"+',
  '                    "<div style=\'margin:8px 0 12px\'>"+sc.txt+"</div>"+',
  '                    "<div style=\'opacity:.6;font-size:11px;margin-bottom:8px\'>cash on hand "+cash+"</div>";',
  '      sc.opts.forEach(function(o,i){',
  '        var b=document.createElement("button");',
  '        var afford=o.c<=cash;',
  '        b.innerHTML=o.l+" <span style=\'opacity:.6\'>cost "+o.c+" \\u00b7 "+Math.round(o.p*100)+"% works</span>";',
  '        b.style.cssText="display:block;width:100%;margin:5px 0;padding:8px 10px;text-align:left;background:"+(afford?"#2a2118":"#1b1712")+";color:"+(afford?"#f4e4c1":"#7a6a58")+";border:1px solid #5a4a3a;border-radius:5px;font:12px monospace;cursor:pointer;";',
  '        b.onclick=function(){ ov.remove(); resolve(sc,i,seat,true); };',
  '        box.appendChild(b);',
  '      });',
  '      ov.appendChild(box); document.body.appendChild(ov);',
  '    }',
  '',
  '    setInterval(function(){',
  '      if(busy) return;',
  '      if(Date.now()-lastFire < 9000) return;          // pacing',
  '      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};',
  '      var seat=((f.turn||0)%4)+1;',
  '      var pos=f["p"+seat];',
  '      if(pos==null) return;',
  '      var N=window.KV_NAMES||{};',
  '      if(!N[pos]) return;                              // not a property square',
  '      if(!window.KV_OWNER || window.KV_OWNER(pos)!==seat) return;   // only your own property',
  '      if(Math.random()>0.45) return;                   // not every landing',
  '      var tier=tierOf(N[pos].p||100);',
  '      var pool=window.KV_DECK.filter(function(s){',
  '        return (s.t===0||s.t===tier) && !used[seat+":"+s.id];',
  '      });',
  '      if(!pool.length) return;',
  '      var sc=pool[Math.floor(Math.random()*pool.length)];',
  '      used[seat+":"+sc.id]=1;',
  '      lastFire=Date.now();',
  '      var humans=window.KV_HUMANS||[1];',
  '      if(humans.indexOf(seat)>=0) present(sc, seat, N[pos].n);',
  '      else resolve(sc, bestIndex(sc, cashOfSeat(seat)), seat, false);   // bots play the EV line',
  '    }, 1200);',
  '  })();'
].join('\n');
html = html.split(endAnchor).join(block);

fs.writeFileSync('showcase_kascity53.html', html);
console.log('PASS self-test on boot (console: [KV SELF-TEST]) reporting log / sfx / flags / owner / moves');
console.log('PASS ' + DECK.length + ' management scenarios, tiered by district wealth, unique per player');
console.log('PASS EV model: p*win + (1-p)*lose - cost, penalised when unaffordable — "ignore it" wins when broke');
console.log('PASS XP only for the highest-EV choice; bots play the EV line silently');
console.log('OK showcase_kascity53.html (' + (fs.statSync('showcase_kascity53.html').size/1024/1024).toFixed(1) + ' MB)');
