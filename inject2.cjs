const fs = require("fs");
const pako = require("pako");
const SLOT0 = "kaspatest:qq84zfnfkat2399k6ucjeugm4psx8flyx9v2ef9nvtr9g6x9c63wx9d39z594";
(async () => {
  const mc = JSON.parse(fs.readFileSync("harvest_found.json","utf8")).map(x=>x.rec.d).sort((a,b)=>a.seq-b.seq);
  const manifest = JSON.parse(Buffer.from(pako.inflate(Buffer.from(mc.map(r=>r.c).join(""),"base64"))).toString("utf8"));
  const frag0 = manifest.frags[0].h;
  const st = JSON.parse(fs.readFileSync("harvest_state.json","utf8"));
  const r = await fetch("https://kasvillage.app.runonflux.io/api/kaspa/records/"+encodeURIComponent(SLOT0)+"?limit=4000");
  const rows = await r.json();
  let added = 0, scanned = 0;
  for (const row of (Array.isArray(rows)?rows:rows.records||[])) {
    const hex = row && row.payload; if (!hex) continue;
    scanned++;
    try {
      const raw = Buffer.from(hex,"hex").toString("utf8");
      const rec = JSON.parse(raw.startsWith("KVP1")?raw.slice(4):raw);
      const d = rec && rec.d;
      if (rec.k==="cfg" && d && d.ty==="html" && d.h===frag0) {
        const k = d.h+":"+d.seq;
        if (!st.store[k] || rec.t > st.store[k].t) { st.store[k]={t:rec.t,tot:d.tot,c:d.c}; added++; }
      }
    } catch {}
  }
  fs.writeFileSync("harvest_state.json", JSON.stringify(st));
  const have = Object.keys(st.store).filter(k=>k.startsWith(frag0)).map(k=>+k.split(":")[1]).sort((a,b)=>a-b);
  console.log("rows scanned:",scanned,"| added:",added,"| frag0 seqs now:",have.join(","));
})().catch(e=>{console.error("FATAL",e);process.exit(1);});
