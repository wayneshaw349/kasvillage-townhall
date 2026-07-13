const fs=require('fs');let d=fs.readFileSync('Dashboard.tsx','utf8');
d=d.replace("const n = await releaseOrphanCollateral([]);","let _live=[]; try { const raw = await AsyncStorage.getItem('kv_frost_active_list'); if (raw) _live = (JSON.parse(raw)||[]).map(x => x.agrId || x.agreementId).filter(Boolean); } catch {}\n      const n = await releaseOrphanCollateral(_live);");
fs.writeFileSync('Dashboard.tsx',d);console.log('done');
