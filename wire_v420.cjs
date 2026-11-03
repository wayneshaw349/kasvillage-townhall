// wire_v420.cjs — v419 -> v420: bots wait 0.3 s longer before rolling (everything else kept)
//   engine nextSeat + KV_SETSTATE('seat') stamp world.flags.seat_t; the bot roll rule also needs
//   world.time - seat_t > 0.3 (seat_t defaults to 0, so a bot that opens the game is never stuck).
const fs = require('fs');
const SRC = 'showcase_kascity_v419_rolldrag.html', OUT = 'showcase_kascity_v420_paced.html';
let s = fs.readFileSync(SRC, 'utf8');
const rep = (a, b, what) => { const c = s.split(a).length - 1; if (c !== 1) throw new Error(what + ': anchor x' + c); s = s.replace(a, b); };
rep('      world.flags.seat = nsCur;', '      world.flags.seat = nsCur; world.flags.seat_t = world.time; // KV_BOT_PACE', 'nextSeat stamp');
rep('world.flags.asked == 0 && seat() > world.flags.humans && world.time - world.flags.rollt > 3.5',
    'world.flags.asked == 0 && seat() > world.flags.humans && world.time - world.flags.rollt > 3.5 && world.time - world.flags.seat_t > 0.3', 'bot roll gate');
// seat_t starts at 0; MP / controller seat writes stamp it too
const STAMP = `<script>
// ---- KV_BOT_PACE: seat_t for seat writes that bypass nextSeat ----
(function(){ var t=setInterval(function(){ var S=window.KV_SETSTATE; if(!S||S.__kvPace) return; clearInterval(t);
  try{ S("seat_t",0); }catch(e){}
  var W=function(k,v){ var r=S.apply(this,arguments); if(k==="seat"){ try{ var w=window.KV_WORLD; S("seat_t", (w&&w.time)||0); }catch(e){} } return r; };
  W.__kvPace=1; window.KV_SETSTATE=W; },200); })();
</script>
`;
let at = s.lastIndexOf('</body>'); if (at < 0) at = s.length;
s = s.slice(0, at) + STAMP + s.slice(at);
fs.writeFileSync(OUT, s); console.log('wrote', OUT);
