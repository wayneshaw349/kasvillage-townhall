const s = require("fs").readFileSync("showcase_kascity227.html", "utf8").replace(/\r/g, "");
const j = s.indexOf('window.KV_MOVE(me,"bid:"+tile,v);');
console.log(s.slice(j - 300, j + 2600));
