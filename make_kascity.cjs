// make_kascity.cjs  ->  writes kascity.json
// Rebuilds the KasCity board from a tile table and injects a decorative skyline.
// Vocabulary-checked: only engine actions/functions from the manual are used.
const fs = require('fs');

const SEATS = [1, 2, 3, 4];
const OFF = { 1: -0.55, 2: -0.2, 3: 0.15, 4: 0.5 }; // token z-offset per seat
const RENT_TILE = 0.06, TOK_Y = 0.2;

// id, kind, material, name, price, rent, bandGroup
const T = [
  [0,  'corner',   'corner',   null, 0, 0, null],
  [1,  'prop',     'tile',     'Riverbend Row', 60, 8,  'g_kiln'],
  [2,  'card',     'grant',    null, 0, 0, null],
  [3,  'prop',     'tile',     'Kiln Street', 80, 10, 'g_kiln'],
  [4,  'levy',     'levy',     null, 0, 200, null],
  [5,  'prop',     'transit',  'North Transit', 200, 60, null],
  [6,  'prop',     'tile',     'Copper Lane', 120, 14, 'g_copper'],
  [7,  'card',     'fate',     null, 0, 0, null],
  [8,  'prop',     'tile',     'Foundry Way', 130, 15, 'g_copper'],
  [9,  'prop',     'tile',     'Lantern Court', 150, 18, 'g_copper'],
  [10, 'corner',   'corner',   null, 0, 0, null],
  [11, 'prop',     'tile',     'Market Bridge', 170, 20, 'g_market'],
  [12, 'prop',     'utility',  'Power Station', 150, 40, null],
  [13, 'prop',     'tile',     'Cobbler Alley', 180, 21, 'g_market'],
  [14, 'prop',     'tile',     'Tanner Street', 200, 24, 'g_market'],
  [15, 'prop',     'transit',  'East Transit', 200, 60, null],
  [16, 'prop',     'tile',     'Orchard Gate', 220, 26, 'g_orchard'],
  [17, 'card',     'grant',    null, 0, 0, null],
  [18, 'prop',     'tile',     'Millrace Road', 230, 27, 'g_orchard'],
  [19, 'prop',     'tile',     'Cinder Row', 250, 30, 'g_orchard'],
  [20, 'corner',   'corner',   null, 0, 0, null],
  [21, 'prop',     'tile',     'Amber Quay', 270, 32, 'g_amber'],
  [22, 'card',     'fate',     null, 0, 0, null],
  [23, 'prop',     'tile',     'Vellum Street', 280, 33, 'g_amber'],
  [24, 'prop',     'tile',     'Ironworks Row', 300, 36, 'g_amber'],
  [25, 'prop',     'transit',  'South Transit', 200, 60, null],
  [26, 'prop',     'tile',     'Beacon Avenue', 320, 38, 'g_beacon'],
  [27, 'prop',     'tile',     'Harbor Light', 330, 39, 'g_beacon'],
  [28, 'prop',     'utility',  'Water Works', 150, 40, null],
  [29, 'prop',     'tile',     'Saltmarsh Drive', 350, 42, 'g_beacon'],
  [30, 'jail',     'corner',   null, 0, 0, null],
  [31, 'prop',     'tile',     'Cathedral Walk', 370, 44, 'g_cathedral'],
  [32, 'prop',     'tile',     'Observatory Rise', 380, 45, 'g_cathedral'],
  [33, 'card',     'grant',    null, 0, 0, null],
  [34, 'prop',     'tile',     'Emerald Terrace', 400, 48, 'g_cathedral'],
  [35, 'prop',     'transit',  'West Transit', 200, 60, null],
  [36, 'card',     'fate',     null, 0, 0, null],
  [37, 'prop',     'tile',     'Summit Row', 440, 53, 'g_crown'],
  [38, 'levy',     'levy',     null, 0, 100, null],
  [39, 'prop',     'tile',     'Crown Heights', 500, 60, 'g_crown'],
];

// ring coordinates: 0..10 top (z=11), 10..20 left (x=-11), 20..30 bottom, 30..40 right
function tileXZ(i) {
  const S = 2.2, E = 11;
  if (i <= 10) return [E - S * i, E];
  if (i <= 20) return [-E, E - S * (i - 10)];
  if (i <= 30) return [-E + S * (i - 20), -E];
  return [E, -E + S * (i - 30)];
}

const A = (action, extra) => Object.assign({ action }, extra || {});
const DO = (action, extra) => ({ do: A(action, extra) });
const SET = (f, v) => DO('setState', { args: [f, v] });
const CASH = (who, amt) => DO('addSeatStat', { args: [who, 'cash'], amount: amt });
const SND = s => DO('playSound', { args: [s] });
const PHASE = n => SET('phase', n);

// ---------- nodes ----------
const nodes = [
  { id: 'terrain', mesh: 'ground', material: 'felt', collision: 'mesh', transform: { pos: [0, -0.25, 0] } },
  { id: 'board_base', mesh: 'board', material: 'board', transform: { pos: [0, 0, 0] } },
];

// ---------- decorative city (cosmetic only: no tags, no collision, no bt) ----------
const Y = 0.08;
nodes.push({ id: 'city_plaza', mesh: 'plaza', material: 'plaza', transform: { pos: [0, Y, 0] } });
const H = { twr_lg: 4.6, twr_md: 3.2, twr_sm: 2.1, twr_xs: 1.3 };
const TOWERS = [
  ['t_core', 'twr_lg', 'glass', 0.0, 0.0, 0],
  ['t_n1', 'twr_md', 'stone', 0.0, -3.0, 0],
  ['t_n2', 'twr_sm', 'slate', 1.9, -3.9, 14],
  ['t_s1', 'twr_md', 'slate', 0.4, 3.2, -8],
  ['t_s2', 'twr_xs', 'brick', -1.7, 3.9, 0],
  ['t_e1', 'twr_lg', 'stone', 3.1, 0.6, 6],
  ['t_e2', 'twr_sm', 'sand', 4.4, -1.5, 0],
  ['t_e3', 'twr_xs', 'brick', 4.7, 2.3, -12],
  ['t_w1', 'twr_md', 'glass', -3.0, -0.7, -6],
  ['t_w2', 'twr_sm', 'sand', -4.3, 1.3, 0],
  ['t_w3', 'twr_xs', 'slate', -4.6, -2.4, 10],
  ['t_ne', 'twr_sm', 'brick', 2.6, -2.0, 0],
  ['t_sw', 'twr_xs', 'stone', -2.4, 2.2, 8],
];
for (const [id, mesh, mat, x, z, yaw] of TOWERS) {
  const h = H[mesh];
  const kids = [{ id: id + '_cap', mesh: 'roof', material: 'roofcap', transform: { pos: [0, h / 2 + 0.07, 0] } }];
  if (mesh === 'twr_lg') kids.push({ id: id + '_spire', mesh: 'spire', material: 'gold', transform: { pos: [0, h / 2 + 0.9, 0] } });
  nodes.push({ id, mesh, material: mat, transform: { pos: [x, Y + h / 2, z], rot: [0, yaw, 0] }, children: kids });
}
nodes.push({ id: 'city_park', mesh: 'park', material: 'grass', transform: { pos: [-1.2, Y + 0.03, -1.9] } });
[[-2.2, -2.5], [-0.4, -2.6], [-1.4, -1.3]].forEach(([x, z], i) => {
  nodes.push({
    id: 'tree_' + (i + 1), mesh: 'trunk', material: 'bark', transform: { pos: [x, Y + 0.3, z] },
    children: [{ id: 'tree_' + (i + 1) + '_top', mesh: 'treetop', material: 'leaf', transform: { pos: [0, 0.55, 0] } }],
  });
});

// ---------- tiles ----------
for (const [i, kind, mat, , , , band] of T) {
  const [x, z] = tileXZ(i);
  const isCorner = kind === 'corner' || kind === 'jail';
  const n = {
    id: 'tile_' + i,
    mesh: isCorner ? 'corner' : 'tileM',
    material: mat,
    tags: ['tile'],
    transform: { pos: [x, RENT_TILE, z] },
  };
  if (band) n.children = [{ id: 'band_' + i, mesh: 'band', material: band, transform: { pos: [0, 0.08, -0.75] } }];
  nodes.push(n);
}

// ---------- tokens ----------
const TOKMESH = { 1: 'slim', 2: 'broad', 3: 'tall', 4: 'shorty' };
const START = { 1: [11.3, 10.7], 2: [10.7, 10.7], 3: [11.3, 11.3], 4: [10.7, 11.3] };
for (const s of SEATS) {
  nodes.push({
    id: 'token_p' + s, mesh: TOKMESH[s], material: 'p' + s, tags: ['token'], footLock: true,
    transform: { pos: [START[s][0], TOK_Y, START[s][1]], rot: [0, 180, 0] },
  });
}

// ---------- behavior tree ----------
const cardDraw = () => ([
  DO('drawCard', { args: ['cards'] }),
  SND('card'),
  {
    selector: [
      { sequence: [{ cond: "lastCard('cards') == 0" }, CASH('current', 120)] },
      { sequence: [{ cond: "lastCard('cards') == 1" }, CASH('current', 75)] },
      { sequence: [{ cond: "lastCard('cards') == 2" }, CASH('current', -60)] },
      { sequence: [{ cond: "lastCard('cards') == 3" }, CASH('current', -90)] },
      { sequence: [{ cond: "lastCard('cards') == 4" }, CASH('current', 200)] },
      { sequence: [{ cond: "lastCard('cards') == 5" }, SET('pos', 10), SET('moved', 0), CASH('current', -50), SND('jail')] },
      { sequence: [{ cond: "lastCard('cards') == 6" }, CASH('current', 45)] },
      { sequence: [{ cond: "lastCard('cards') == 7" }, CASH('current', -25)] },
    ],
  },
  PHASE(3),
]);

const phase1 = [];
// movement: one branch per seat per square
for (const s of SEATS) {
  for (const [i] of T) {
    const [x, z] = tileXZ(i);
    const to = 'token_p' + s;
    const pos = [x, TOK_Y, z + OFF[s]];
    phase1.push({
      sequence: [
        { cond: `seat() == ${s} && world.flags.pos == ${i} && world.flags.moved == 0` },
        DO('teleport', { args: pos, to }),
        DO('teleport', { args: pos, to }),
        SET('moved', 1),
      ],
    });
  }
}
// landing effects
for (const [i, kind, , name, price, rent] of T) {
  const at = `world.flags.pos == ${i} && world.flags.moved == 1`;
  if (kind === 'corner') { phase1.push({ sequence: [{ cond: at }, PHASE(3)] }); continue; }
  if (kind === 'jail') { phase1.push({ sequence: [{ cond: at }, SET('pos', 10), SET('moved', 0), CASH('current', -50), SND('jail'), PHASE(3)] }); continue; }
  if (kind === 'levy') { phase1.push({ sequence: [{ cond: at }, CASH('current', -rent), SND('rent'), PHASE(3)] }); continue; }
  if (kind === 'card') { phase1.push({ sequence: [{ cond: at }].concat(cardDraw()) }); continue; }
  const k = 't' + i;
  phase1.push({
    sequence: [
      { cond: `${at} && ownerOf('${k}') == 0 && seatStat(seat(),'cash') >= ${price}` },
      DO('prompt', { args: ['buy', `${name} is unowned. Buy for ${price}?`, `Buy (${price})`, 'Pass'] }),
      SET('buy_tile', i), PHASE(2),
    ],
  });
  phase1.push({ sequence: [{ cond: `${at} && ownerOf('${k}') == 0` }, PHASE(3)] });
  for (const o of SEATS) {
    phase1.push({
      sequence: [
        { cond: `${at} && ownerOf('${k}') == ${o} && seat() != ${o}` },
        CASH('current', -rent), CASH(o, rent), SND('rent'), PHASE(3),
      ],
    });
  }
  phase1.push({ sequence: [{ cond: at }, PHASE(3)] });
}

const phase2 = [];
for (const [i, kind, , , price] of T) {
  if (kind !== 'prop') continue;
  phase2.push({
    sequence: [
      { cond: `world.flags.buy_tile == ${i} && world.flags.buy == 0` },
      DO('claim', { args: ['t' + i] }), CASH('current', -price), SND('buy'),
      DO('playPose', { args: ['cheer'], to: 'token_p1' }),
      SET('buy', -1), PHASE(3),
    ],
  });
}
phase2.push({ sequence: [{ cond: 'world.flags.buy == 1' }, SET('buy', -1), PHASE(3)] });

const phase3 = [];
for (const s of SEATS) {
  phase3.push({
    sequence: [
      { cond: `seatStat(${s},'cash') < 0 && seatStat(${s},'alive') == 1` },
      DO('setSeatStat', { args: [s, 'alive', 0] }), SND('bust'),
    ],
  });
}
phase3.push({
  sequence: [
    { cond: "seatStat(1,'alive') + seatStat(2,'alive') + seatStat(3,'alive') + seatStat(4,'alive') <= 1" },
    DO('prompt', { args: ['fin', 'The city has one landlord left. Game over.', 'OK'] }),
    PHASE(9), SND('win'),
  ],
});
phase3.push({ sequence: [{ cond: '1 == 1' }, DO('nextSeat'), SET('moved', 0), SET('sum', 0), PHASE(0)] });

const director = {
  id: 'director', type: 'Actor', tags: ['director'], transform: { pos: [0, 0, 0] },
  bt: {
    selector: [
      {
        sequence: [
          { cond: 'world.flags.phase == 0' },
          {
            selector: [
              {
                sequence: [
                  { cond: 'world.flags.asked == 0' }, SET('asked', 1),
                  DO('prompt', { args: ['go', 'Your turn. Tap to roll the fate deck.', 'Roll'] }),
                ],
              },
              {
                sequence: [
                  { cond: 'world.flags.go >= 0' },
                  DO('drawCard', { args: ['fate'] }), SND('dice'),
                  DO('setFlagExpr', { args: ['sum', "world.flags.pos + lastCard('fate') + 2"] }),
                  DO('setFlagExpr', { args: ['pos', 'mod(world.flags.sum, 40)'] }),
                  SET('asked', 0), SET('go', -1), PHASE(1),
                ],
              },
            ],
          },
        ],
      },
      {
        sequence: [
          { cond: 'world.flags.phase == 1' },
          { selector: [{ sequence: [{ cond: 'world.flags.sum >= 40' }, CASH('current', 200), SND('depot')] }, { cond: '1 == 1' }] },
          { selector: phase1 },
        ],
      },
      { sequence: [{ cond: 'world.flags.phase == 2 && world.flags.buy >= 0' }, { selector: phase2 }] },
      { sequence: [{ cond: 'world.flags.phase == 3' }, { selector: phase3 }] },
    ],
  },
};
nodes.push(director);

// ---------- descriptor ----------
const g = {
  kind: 'kv_game_v1',
  engine: 'scene',
  meta: { id: 'kascity_v2', name: 'KasCity', seed: 'kc2', players: 4, category: 'board' },
  debug: false,
  permissions: ['identity', 'persist', 'stats'],
  compliance: { maxNodes: 512 },
  input: { scheme: 'tap' },
  world: { score: 0, flags: { phase: 0, asked: 0, pos: 0, sum: 0, moved: 1, go: -1, buy: -1, buy_tile: -1, seat: 1, turn: 0 } },
  tables: { decks: { fate: 11, cards: 8 } },
  nodes,
  resources: {
    meshes: {
      ground: { type: 'box', size: [40, 0.5, 40] },
      board: { type: 'box', size: [24.2, 0.12, 24.2] },
      tileM: { type: 'box', size: [2.06, 0.1, 2.06] },
      corner: { type: 'box', size: [2.16, 0.14, 2.16] },
      band: { type: 'box', size: [2.06, 0.06, 0.57] },
      plaza: { type: 'box', size: [15, 0.04, 15] },
      twr_lg: { type: 'box', size: [1.5, 4.6, 1.5] },
      twr_md: { type: 'box', size: [1.3, 3.2, 1.3] },
      twr_sm: { type: 'box', size: [1.15, 2.1, 1.15] },
      twr_xs: { type: 'box', size: [1.0, 1.3, 1.0] },
      spire: { type: 'box', size: [0.3, 1.5, 0.3] },
      roof: { type: 'box', size: [1.6, 0.14, 1.6] },
      park: { type: 'box', size: [3.4, 0.05, 2.6] },
      treetop: { type: 'box', size: [0.66, 0.66, 0.66] },
      trunk: { type: 'box', size: [0.16, 0.5, 0.16] },
      slim: { type: 'humanoid', bulk: 0.8, limbLen: 1.05 },
      broad: { type: 'humanoid', bulk: 1.25, limbLen: 0.92 },
      tall: { type: 'humanoid', bulk: 0.95, limbLen: 1.18 },
      shorty: { type: 'humanoid', bulk: 1.1, limbLen: 0.82 },
    },
    materials: {
      felt: { color: '#1f4032' }, board: { color: '#dfd3b6' }, tile: { color: '#efe6cf' },
      corner: { color: '#cbbd9a' }, transit: { color: '#3c3c44' }, utility: { color: '#8aa0a8' },
      fate: { color: '#e08a2e' }, grant: { color: '#4f8fc0' }, levy: { color: '#8e2f2f' },
      p1: { color: '#d94f4f' }, p2: { color: '#4f7fd9' }, p3: { color: '#4fd98a' }, p4: { color: '#d9c14f' },
      g_kiln: { color: '#6b4a2f' }, g_copper: { color: '#7fb8d8' }, g_market: { color: '#c9569a' },
      g_orchard: { color: '#d98232' }, g_amber: { color: '#c0392b' }, g_beacon: { color: '#d8c33a' },
      g_cathedral: { color: '#3f9e5a' }, g_crown: { color: '#2f3f8e' },
      plaza: { color: '#2a2f38' }, stone: { color: '#5f6a78' }, slate: { color: '#4a5361' },
      sand: { color: '#8d8471' }, glass: { color: '#42707f' }, brick: { color: '#7a4b40' },
      roofcap: { color: '#39404c' }, gold: { color: '#d8b24a' }, grass: { color: '#2f6b3f' },
      leaf: { color: '#3f8a4e' }, bark: { color: '#4a3626' },
    },
    poses: {
      cheer: {
        dur: 0.9, loop: false,
        tracks: {
          armL: [[0, 0], [0.28, { rx: -155, rz: -18 }], [0.9, 0]],
          armR: [[0, 0], [0.28, { rx: -155, rz: 18 }], [0.9, 0]],
          handL: [[0, 0], [0.34, { rz: -22 }], [0.55, { rz: 18 }], [0.9, 0]],
          handR: [[0, 0], [0.34, { rz: 22 }], [0.55, { rz: -18 }], [0.9, 0]],
        },
      },
    },
    sounds: {
      dice: { type: 'noise', filter: 2600, dur: 0.38, vol: 0.5 },
      card: { type: 'noise', filter: 4200, dur: 0.16, vol: 0.35 },
      buy: { layers: [{ type: 'tone', wave: 'sine', freq: 660, sweep: 220, dur: 0.14, vol: 0.35 }, { type: 'tone', wave: 'sine', freq: 990, sweep: 320, dur: 0.2, vol: 0.25 }] },
      rent: { type: 'tone', wave: 'sawtooth', freq: 340, sweep: -180, dur: 0.28, vol: 0.32 },
      depot: { type: 'tone', wave: 'sine', freq: 784, sweep: 120, dur: 0.26, vol: 0.3 },
      jail: { type: 'tone', wave: 'square', freq: 150, sweep: -70, dur: 0.42, vol: 0.34 },
      bust: { type: 'tone', wave: 'sawtooth', freq: 400, sweep: -330, dur: 0.75, vol: 0.38 },
      win: { layers: [{ type: 'tone', wave: 'sine', freq: 523, dur: 0.3, vol: 0.32 }, { type: 'tone', wave: 'sine', freq: 784, dur: 0.42, vol: 0.3 }] },
    },
  },
  alarms: [{
    id: 'boot', at: 0.1,
    actions: [].concat(...SEATS.map(s => [
      { action: 'setSeatStat', args: [s, 'cash', 1500] },
      { action: 'setSeatStat', args: [s, 'alive', 1] },
    ])).concat([
      { action: 'shuffleDeck', args: ['fate'] },
      { action: 'shuffleDeck', args: ['cards'] },
    ]),
  }],
};

const count = (function walk(a) { return a.reduce((n, x) => n + 1 + (x.children ? walk(x.children) : 0), 0); })(g.nodes);
if (count > g.compliance.maxNodes) { console.log('ABORT: ' + count + ' nodes > ' + g.compliance.maxNodes); process.exit(1); }

fs.writeFileSync('kascity.json', JSON.stringify(g));
console.log('OK kascity.json written - nodes ' + count + '/' + g.compliance.maxNodes + ', bytes ' + fs.statSync('kascity.json').size);
