// ---- KV DEVTOOLS ----
(function () {
  var BONES = ['torso','head','armL','foreL','armR','foreR','legL','shinL','legR','shinR','weapon'];
  var sel = null, tab = 'inspect', keys = [], cursor = 0, live = {};
  var root = document.createElement('div');
  root.style.cssText = 'position:fixed;top:0;right:0;bottom:0;width:330px;background:rgba(12,15,18,0.96);color:#cfe;z-index:99999;font-family:monospace;font-size:11px;display:flex;flex-direction:column;border-left:2px solid #2a3138';
  var tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;border-bottom:1px solid #2a3138';
  var body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow:auto;padding:6px';
  root.appendChild(tabs); root.appendChild(body);
  document.body.appendChild(root);
  function mkTab(id, label) {
    var b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'flex:1;padding:7px;background:#1a2026;color:#cfe;border:0;border-right:1px solid #2a3138;font-family:monospace;font-size:11px';
    b.onclick = function () { tab = id; draw(); };
    tabs.appendChild(b);
  }
  mkTab('inspect','INSPECT');
  mkTab('pose','POSE');
  mkTab('prof','PROF');
  var hide = document.createElement('button');
  hide.textContent = '×';
  hide.style.cssText = 'width:28px;background:#3a2026;color:#fcc;border:0;font-family:monospace';
  hide.onclick = function () { root.style.display = root.style.display === 'none' ? 'flex' : 'none'; };
  tabs.appendChild(hide);
  function row(label, val, onEdit) {
    var d = document.createElement('div');
    d.style.cssText = 'display:flex;justify-content:space-between;padding:1px 0';
    var a = document.createElement('span'); a.textContent = label; a.style.color = '#7a9';
    d.appendChild(a);
    if (onEdit) {
      var inp = document.createElement('input');
      inp.value = val; inp.style.cssText = 'width:120px;background:#0c1014;color:#cfe;border:1px solid #2a3138;font-family:monospace;font-size:11px';
      inp.onchange = function () { onEdit(inp.value); };
      d.appendChild(inp);
    } else { var b2 = document.createElement('span'); b2.textContent = val; d.appendChild(b2); }
    body.appendChild(d);
  }
  function btn(label, fn, col) {
    var b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'margin:2px 2px 2px 0;padding:4px 7px;background:' + (col || '#1f2731') + ';color:#cfe;border:1px solid #2a3138;font-family:monospace;font-size:11px';
    b.onclick = fn;
    body.appendChild(b);
    return b;
  }
  function head(txt) {
    var h = document.createElement('div');
    h.textContent = txt;
    h.style.cssText = 'color:#8fd;margin:6px 0 3px;border-bottom:1px solid #2a3138';
    body.appendChild(h);
  }
  function drawInspect() {
    head('NODES (' + Object.keys(nodes).length + ')');
    var ids = Object.keys(nodes);
    var list = document.createElement('div');
    list.style.cssText = 'max-height:150px;overflow:auto;margin-bottom:5px';
    ids.forEach(function (id) {
      var n = nodes[id];
      var e = document.createElement('div');
      e.textContent = (n._geo && n._geo.rigged ? '* ' : '  ') + id + '  [' + (n.type || '?') + ']';
      e.style.cssText = 'cursor:pointer;padding:1px 3px;' + (sel === id ? 'background:#24404a;color:#dff' : '');
      e.onclick = function () { sel = id; draw(); };
      list.appendChild(e);
    });
    body.appendChild(list);
    if (!sel || !nodes[sel]) return;
    var n = nodes[sel];
    head('SELECTED: ' + sel);
    var t = n.transform || { pos: [0, 0, 0], rot: [0, 0, 0] };
    row('pos x', t.pos[0].toFixed(2), function (v) { t.pos[0] = parseFloat(v); });
    row('pos y', t.pos[1].toFixed(2), function (v) { t.pos[1] = parseFloat(v); });
    row('pos z', t.pos[2].toFixed(2), function (v) { t.pos[2] = parseFloat(v); });
    row('rot y', (t.rot ? t.rot[1] : 0).toFixed(1), function (v) { t.rot[1] = parseFloat(v); });
    if (n.stats) row('hp', (n.hp != null ? n.hp : '-') + '/' + n.stats.maxHp, function (v) { n.hp = parseFloat(v); });
    if (n.stance != null) row('stance', n.stance, function (v) { n.stance = v; });
    row('tags', (n.tags || []).join(','));
    row('room', n.room || '-');
    btn('VISIBLE', function () { n.visible = n.visible === false; });
    btn('RAGDOLL', function () { if (typeof startRagdoll === 'function') startRagdoll(n, { x: 2, y: 4, z: 0 }); });
    btn('TP PLAYER HERE', function () {
      var pl = nodes[playerId];
      if (pl) { pl.transform.pos[0] = t.pos[0] + 1.5; pl.transform.pos[2] = t.pos[2]; }
    });
    btn('LOCK ON', function () { LOCK.target = sel; });
  }
  function drawPose() {
    var n = sel ? nodes[sel] : null;
    if (!n || !n._geo || !n._geo.rigged) { head('select a rigged actor in INSPECT'); return; }
    head('POSE EDITOR: ' + sel);
    row('time', cursor.toFixed(2), function (v) { cursor = parseFloat(v) || 0; });
    BONES.forEach(function (bn) {
      if (!n._geo.parts[bn]) return;
      var d = document.createElement('div');
      d.style.cssText = 'margin:2px 0';
      var lab = document.createElement('div');
      live[bn] = live[bn] || { rx: 0, ry: 0, rz: 0 };
      lab.textContent = bn + '  rx' + live[bn].rx.toFixed(0) + ' ry' + live[bn].ry.toFixed(0) + ' rz' + live[bn].rz.toFixed(0);
      lab.style.color = '#7a9';
      d.appendChild(lab);
      ['rx','ry','rz'].forEach(function (ax) {
        var s = document.createElement('input');
        s.type = 'range'; s.min = -180; s.max = 180; s.step = 1; s.value = live[bn][ax];
        s.style.cssText = 'width:100%;height:12px';
        s.oninput = function () {
          live[bn][ax] = parseFloat(s.value);
          n._devPose = {};
          for (var k in live) n._devPose[k] = { rx: live[k].rx, ry: live[k].ry, rz: live[k].rz };
          lab.textContent = bn + '  rx' + live[bn].rx.toFixed(0) + ' ry' + live[bn].ry.toFixed(0) + ' rz' + live[bn].rz.toFixed(0);
        };
        d.appendChild(s);
      });
      body.appendChild(d);
    });
    btn('CAPTURE KEY @ ' + cursor.toFixed(2), function () {
      var snap = {};
      for (var k in live) if (live[k].rx || live[k].ry || live[k].rz) snap[k] = { rx: live[k].rx, ry: live[k].ry, rz: live[k].rz };
      keys.push({ t: cursor, pose: snap });
      cursor = Math.round((cursor + 0.15) * 100) / 100;
      draw();
    }, '#25402c');
    btn('RESET BONES', function () { live = {}; if (nodes[sel]) nodes[sel]._devPose = null; draw(); });
    btn('CLEAR KEYS', function () { keys = []; cursor = 0; draw(); });
    head('KEYS (' + keys.length + ')');
    keys.forEach(function (k, i) { row('t=' + k.t.toFixed(2), Object.keys(k.pose).join(',') || '(rest)'); });
    btn('EXPORT CLIP JSON', function () {
      var tracks = {};
      keys.forEach(function (k) {
        for (var bn in k.pose) {
          tracks[bn] = tracks[bn] || [[0, 0]];
          tracks[bn].push([k.t, k.pose[bn]]);
        }
      });
      var dur = keys.length ? keys[keys.length - 1].t + 0.15 : 0.5;
      for (var bn2 in tracks) tracks[bn2].push([dur, 0]);
      var clip = { dur: Math.round(dur * 100) / 100, loop: false, blendIn: 0.08, tracks: tracks };
      var ta = document.createElement('textarea');
      ta.value = JSON.stringify(clip, null, 2);
      ta.style.cssText = 'width:100%;height:170px;background:#0c1014;color:#9fe8a0;border:1px solid #2a3138;font-family:monospace;font-size:10px';
      body.appendChild(ta);
      ta.select();
    }, '#2a3550');
  }
  var ftimes = [], lastT = performance.now();
  function drawProf() {
    head('PROFILER');
    var avg = 0;
    for (var i = 0; i < ftimes.length; i++) avg += ftimes[i];
    avg = ftimes.length ? avg / ftimes.length : 0;
    row('frame ms', avg.toFixed(2));
    row('fps', (avg > 0 ? (1000 / avg).toFixed(0) : '-'));
    row('nodes', Object.keys(nodes).length);
    row('actors', typeof actors !== 'undefined' ? actors.length : 0);
    row('bodies', typeof BODIES !== 'undefined' ? BODIES.length : 0);
    var awake = 0;
    if (typeof BODIES !== 'undefined') for (var b = 0; b < BODIES.length; b++) if (!BODIES[b].asleep) awake++;
    row('awake', awake);
    row('ragdolls', typeof RAGDOLLS !== 'undefined' ? RAGDOLLS.length : 0);
    row('projectiles', typeof PROJECTILES !== 'undefined' ? PROJECTILES.length : 0);
    row('joints', typeof JOINTS !== 'undefined' ? JOINTS.length : 0);
    row('posed', typeof POSED !== 'undefined' ? POSED.length : 0);
    row('room', scene._room || '-');
    var cv = document.createElement('canvas');
    cv.width = 300; cv.height = 60;
    cv.style.cssText = 'margin-top:6px;background:#0c1014;border:1px solid #2a3138;width:100%';
    body.appendChild(cv);
    var g = cv.getContext('2d');
    g.strokeStyle = '#6fd'; g.beginPath();
    for (var f = 0; f < ftimes.length; f++) {
      var yy = 60 - Math.min(60, ftimes[f] * 2);
      if (f === 0) g.moveTo(0, yy); else g.lineTo(f * (300 / 60), yy);
    }
    g.stroke();
    g.strokeStyle = '#e66';
    g.beginPath(); g.moveTo(0, 60 - 16.7 * 2); g.lineTo(300, 60 - 16.7 * 2); g.stroke();
  }
  function draw() {
    body.innerHTML = '';
    if (tab === 'inspect') drawInspect();
    else if (tab === 'pose') drawPose();
    else drawProf();
  }
  setInterval(function () {
    var now = performance.now();
    ftimes.push(now - lastT);
    if (ftimes.length > 60) ftimes.shift();
    lastT = now;
  }, 16);
  setInterval(function () { if (tab !== 'pose') draw(); }, 700);
  if (typeof FRAME_HOOKS !== 'undefined') {
    FRAME_HOOKS.push(function () {
      if (!sel || !nodes[sel] || !nodes[sel]._devPose) return;
      var n = nodes[sel];
      n._addPose = null;
      n._devApply = 1;
    });
  }
  draw();
})();