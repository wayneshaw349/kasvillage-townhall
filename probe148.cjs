// probe148.cjs — patches 147 into 148 with a live expression-evaluator readout on trades
const fs=require('fs');
function die(m){console.error('ABORT: '+m);process.exit(1);}
if(!fs.existsSync('showcase_kascity147.html')) die('showcase_kascity147.html missing');
let html=fs.readFileSync('showcase_kascity147.html','utf8');
const EOL=html.indexOf('\r\n')>=0?'\r\n':'\n';
const a='var okt=window.KV_SETSTATE("tr_state",2);';
if(html.split(a).length-1!==1) die('anchor not unique');
html=html.replace(a, a+EOL+
'(function(){ setTimeout(function(){'+EOL+
'  var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};'+EOL+
'  var probe=(window.KV_EVAL?window.KV_EVAL("world.flags.tr_amt"):"no KV_EVAL");'+EOL+
'  var probe2=(window.KV_EVAL?window.KV_EVAL("0 - world.flags.tr_amt"):"-");'+EOL+
'  if(window.KV_LOG) window.KV_LOG("EVAL PROBE: KV_FLAGS.tr_amt="+f.tr_amt+" typeof="+(typeof f.tr_amt)+" | engine expr tr_amt="+probe+" | expr 0-tr_amt="+probe2, "#d8a0ff");'+EOL+
'},600); })();');
// expose the engine evaluator if it is not already
const ev='window.KV_SETSTATE = function (k, v) {';
if(html.split(ev).length-1===1){
  html=html.replace(ev,'window.KV_EVAL = function(src){ try { return evalExpr(compileExpr(String(src)), exprCtx(null)); } catch(e){ return "ERR:"+e.message; } };'+EOL+ev);
  console.log('PASS KV_EVAL exposed');
} else console.log('note: KV_SETSTATE anchor not unique, KV_EVAL not added');
fs.writeFileSync('showcase_kascity148.html',html);
console.log('OK showcase_kascity148.html');
