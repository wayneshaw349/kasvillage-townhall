import { useState, useEffect, useRef, useCallback } from "react";

// Phone frame dimensions
const PHONE_W = 320;
const PHONE_H = 568;
const ROOM_W = 320;
const ROOM_H = 420;

// Biome palettes
const BIOMES = {
  gothic_castle: { floor: ['#1A1A2A','#2A2A3A'], wall: ['#3A3A4A','#4A4A5A'], accent: ['#880022','#AA0033'], sky: '#0A0A1A' },
  forest_ruins:  { floor: ['#3A5A2A','#4A6A38'], wall: ['#6A7A5A','#7A8A6A'], accent: ['#C8B878','#D8C888'], sky: '#2A4A2A' },
  mine_forge:    { floor: ['#4A3A2A','#5A4A38'], wall: ['#6A5A48','#7A6A58'], accent: ['#FF8800','#FFAA33'], sky: '#2A1A0A' },
};

// Lighting configs
const LIGHTS = {
  horror:   { angle: Math.PI, shadow: 0.7, ambient: 0.15 },
  daylight: { angle: -Math.PI/4, shadow: 0.3, ambient: 0.4 },
  firelit:  { angle: Math.PI, shadow: 0.6, ambient: 0.2 },
  moonlit:  { angle: -Math.PI/3, shadow: 0.65, ambient: 0.15 },
};

function applyLight(r, g, b, normalAngle, lightCfg) {
  const diffuse = Math.max(0.15, Math.cos(normalAngle - lightCfg.angle) * 0.5 + 0.5);
  const mul = lightCfg.ambient + diffuse * (1 - lightCfg.shadow);
  return [Math.min(255, r * mul), Math.min(255, g * mul), Math.min(255, b * mul)];
}

function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

function rgbToHex(r, g, b) {
  const cl = v => Math.max(0, Math.min(255, Math.round(v)));
  return `#${cl(r).toString(16).padStart(2,'0')}${cl(g).toString(16).padStart(2,'0')}${cl(b).toString(16).padStart(2,'0')}`;
}

function litColor(hex, normalAngle, lightCfg) {
  const [r,g,b] = hexToRgb(hex);
  const [lr,lg,lb] = applyLight(r,g,b,normalAngle,lightCfg);
  return rgbToHex(lr,lg,lb);
}

// Seeded random
function srand(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s % 10000) / 10000; };
}

export default function PhonePreview() {
  const canvasRef = useRef(null);
  const [biome, setBiome] = useState('gothic_castle');
  const [lighting, setLighting] = useState('horror');
  const [cameraAngle, setCameraAngle] = useState(135);
  const [showHUD, setShowHUD] = useState(true);
  const [showHooks, setShowHooks] = useState(false);
  const [avatarX, setAvatarX] = useState(160);
  const [avatarY, setAvatarY] = useState(310);
  const [avatarPose, setAvatarPose] = useState('idle');
  const timeRef = useRef(0);
  const frameRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, PHONE_W, PHONE_H);
    timeRef.current += 0.016;
    const t = timeRef.current;

    const pal = BIOMES[biome];
    const light = LIGHTS[lighting];
    const rand = srand(cameraAngle * 1000 + Object.keys(BIOMES).indexOf(biome) * 100);
    const yawRad = (cameraAngle * Math.PI) / 180;
    const perspScale = Math.abs(Math.cos(yawRad));

    // === SKY / CEILING ===
    ctx.fillStyle = litColor(pal.sky, 0, light);
    ctx.fillRect(0, 0, ROOM_W, ROOM_H);

    // === BACK WALL with stone blocks ===
    const wallH = 130;
    ctx.fillStyle = litColor(pal.wall[0], -Math.PI/4 + yawRad * 0.3, light);
    ctx.fillRect(0, 0, ROOM_W, wallH);

    // Stone block texture
    const blockW = 32, blockH = 16;
    for (let bx = 0; bx < ROOM_W; bx += blockW) {
      for (let by = 8; by < wallH - 8; by += blockH) {
        const offset = (Math.floor(by / blockH) % 2) * blockW * 0.5;
        ctx.fillStyle = litColor(pal.wall[1], -Math.PI/4 + rand() * 0.3, light);
        ctx.globalAlpha = 0.12 + rand() * 0.08;
        ctx.fillRect(bx + offset, by, blockW - 2, blockH - 2);
      }
    }
    ctx.globalAlpha = 1;

    // === ARCHED DOORWAY ===
    const archX = ROOM_W * 0.5;
    const archW = 40;
    const archH = wallH * 0.65;
    ctx.fillStyle = '#050508';
    ctx.fillRect(archX - archW/2, wallH - archH, archW, archH);
    // Arch curve
    ctx.beginPath();
    ctx.arc(archX, wallH - archH, archW/2, Math.PI, 0);
    ctx.fillStyle = '#050508';
    ctx.fill();
    // Keystone
    ctx.fillStyle = litColor(pal.accent[0], -Math.PI/3, light);
    ctx.fillRect(archX - 4, wallH - archH - archW/2 - 2, 8, 7);
    // Arch frame
    ctx.strokeStyle = litColor(pal.accent[0], -Math.PI/3, light);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(archX, wallH - archH, archW/2 + 2, Math.PI, 0);
    ctx.lineTo(archX + archW/2 + 2, wallH);
    ctx.moveTo(archX - archW/2 - 2, wallH - archH);
    ctx.lineTo(archX - archW/2 - 2, wallH);
    ctx.stroke();

    // === WINDOWS ===
    if (lighting !== 'horror') {
      for (let wi = 0; wi < 2; wi++) {
        const wx = wi === 0 ? 45 : 235;
        const ww = 24, wh = 32, wy = 20;
        ctx.fillStyle = '#0A1530';
        ctx.fillRect(wx, wy, ww, wh);
        const glowC = lighting === 'moonlit' ? '#4466AA' : lighting === 'daylight' ? '#FFFFCC' : '#FF8844';
        ctx.fillStyle = glowC;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(wx+2, wy+2, ww-4, wh-4);
        ctx.globalAlpha = 1;
        ctx.fillStyle = litColor(pal.wall[0], 0, light);
        ctx.fillRect(wx + ww/2 - 1, wy, 2, wh);
        ctx.fillRect(wx, wy + wh/2 - 1, ww, 2);
      }
    }

    // === SIDE WALLS (perspective depth) ===
    ctx.fillStyle = litColor(pal.wall[1], -Math.PI/2 + yawRad * 0.5, light);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, ROOM_H);
    ctx.lineTo(35, ROOM_H - 50); ctx.lineTo(35, wallH);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = litColor(pal.wall[1], Math.PI/2 + yawRad * 0.5, light);
    ctx.beginPath();
    ctx.moveTo(ROOM_W, 0); ctx.lineTo(ROOM_W, ROOM_H);
    ctx.lineTo(ROOM_W - 35, ROOM_H - 50); ctx.lineTo(ROOM_W - 35, wallH);
    ctx.closePath(); ctx.fill();

    // === COLUMNS ===
    for (const cx of [80, 240]) {
      const pw = 12;
      // Capital
      ctx.fillStyle = litColor(pal.accent[0], -Math.PI/4, light);
      ctx.fillRect(cx - pw/2 - 3, wallH - 6, pw + 6, 8);
      // Shaft
      ctx.fillStyle = litColor(pal.wall[0], yawRad * 0.2, light);
      ctx.fillRect(cx - pw/2, wallH + 2, pw, ROOM_H - wallH - 30);
      // Fluting
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#000';
      for (let f = 0; f < 3; f++) ctx.fillRect(cx - pw/4 + f * pw/3, wallH + 5, 1, ROOM_H - wallH - 40);
      ctx.globalAlpha = 1;
      // Base
      ctx.fillStyle = litColor(pal.wall[0], Math.PI/4, light);
      ctx.fillRect(cx - pw/2 - 2, ROOM_H - 28, pw + 4, 6);
    }

    // === FLOOR with perspective tiles ===
    const tileSize = 36;
    for (let tx = -1; tx < 10; tx++) {
      for (let ty = 0; ty < 8; ty++) {
        const yProg = ty / 8;
        const pScale = 1.0 - (1.0 - yProg) * perspScale * 0.35;
        const xOff = (1 - pScale) * ROOM_W * 0.5;
        const tileW = (tileSize - 1) * pScale;
        const tileH = (tileSize - 1) * 0.7;
        const fx = xOff + tx * tileSize * pScale;
        const fy = wallH + 5 + ty * tileH;
        const dark = (tx + ty) % 2 === 0 ? 0 : 0.06;
        ctx.fillStyle = litColor(pal.floor[(tx+ty)%2], Math.PI/2 + rand()*0.1, light);
        ctx.globalAlpha = 0.85 - dark;
        ctx.fillRect(fx, fy, tileW, tileH);
        // Grout
        ctx.fillStyle = '#000';
        ctx.globalAlpha = 0.08;
        ctx.fillRect(fx + tileW, fy, 1, tileH);
      }
    }
    ctx.globalAlpha = 1;

    // === OBJECTS (from shape dictionary) ===
    // Torch left
    ctx.fillStyle = litColor('#555', 0, light);
    ctx.fillRect(55, 75, 4, 16);
    ctx.fillStyle = '#FF8800'; ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.arc(57, 72, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#FFCC00'; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(57, 70, 4, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    // Torch right
    ctx.fillStyle = litColor('#555', 0, light);
    ctx.fillRect(261, 75, 4, 16);
    ctx.fillStyle = '#FF8800'; ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.arc(263, 72, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#FFCC00'; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(263, 70, 4, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    // Table
    const tableX = 100, tableY = 260;
    ctx.fillStyle = litColor('#6A5040', -Math.PI/6, light);
    ctx.fillRect(tableX, tableY, 55, 7);
    ctx.fillRect(tableX+4, tableY+7, 4, 18);
    ctx.fillRect(tableX+47, tableY+7, 4, 18);
    // Items on table
    ctx.fillStyle = litColor(pal.accent[0], -Math.PI/4, light);
    ctx.fillRect(tableX+12, tableY-6, 8, 6); // book
    ctx.fillStyle = litColor('#CCAA44', 0, light);
    ctx.beginPath(); ctx.arc(tableX+38, tableY-3, 4, 0, Math.PI*2); ctx.fill(); // plate

    // Chair
    ctx.fillStyle = litColor('#5A4030', 0, light);
    ctx.fillRect(tableX-18, tableY+5, 14, 4);
    ctx.fillRect(tableX-17, tableY-12, 12, 17);
    ctx.fillRect(tableX-16, tableY+9, 3, 14);
    ctx.fillRect(tableX-7, tableY+9, 3, 14);

    // Barrel cluster (right side)
    for (let bi = 0; bi < 2; bi++) {
      const bx = 220 + bi * 22, by = 290 - bi * 5;
      ctx.fillStyle = litColor('#5A3A1A', bi * 0.3, light);
      ctx.beginPath(); ctx.ellipse(bx, by+12, 10, 14, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = litColor('#7A5A3A', 0, light);
      ctx.fillRect(bx-9, by+5, 18, 2);
      ctx.fillRect(bx-9, by+18, 18, 2);
    }

    // Chest
    ctx.fillStyle = litColor('#4A3520', Math.PI/4, light);
    ctx.fillRect(50, 330, 28, 16);
    ctx.fillStyle = litColor('#5A4530', -Math.PI/4, light);
    ctx.fillRect(49, 326, 30, 5);
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(64, 338, 2.5, 0, Math.PI*2); ctx.fill();

    // Banner (wall)
    ctx.fillStyle = litColor(pal.accent[0], 0, light);
    ctx.fillRect(170, 20, 16, 40);
    ctx.beginPath();
    ctx.moveTo(170, 60); ctx.lineTo(186, 60); ctx.lineTo(178, 70); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = litColor(pal.accent[1] || pal.accent[0], 0, light);
    ctx.globalAlpha = 0.3;
    ctx.fillRect(174, 28, 8, 28);
    ctx.globalAlpha = 1;

    // === GROUND SHADOW under avatar ===
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(avatarX, avatarY + 32, 18, 5, 0, 0, Math.PI*2);
    ctx.fill();

    // === AVATAR (simplified puppet with hooks) ===
    const breath = Math.sin(t * 2) * 1.5;
    const isWalking = avatarPose === 'walk1' || avatarPose === 'walk2';
    const walkOff = isWalking ? Math.sin(t * 8) * 6 : 0;
    const isCombat = avatarPose === 'idle_combat';
    const combatBounce = isCombat ? Math.sin(t * 4) * 2 : 0;
    const isAttack = avatarPose === 'attack';

    // Body parts
    const headX = avatarX, headY = avatarY - 28 + breath * 0.3 + combatBounce * 0.3;
    const torsoX = avatarX, torsoY = avatarY - 8 + breath + combatBounce;
    const armLx = avatarX - 14, armLy = avatarY - 14 + (isAttack ? -10 : walkOff * 0.5);
    const armRx = avatarX + 14, armRy = avatarY - 14 + (isAttack ? -18 : -walkOff * 0.5);
    const legLx = avatarX - 6, legLy = avatarY + 10 + (isWalking ? walkOff : 0);
    const legRx = avatarX + 6, legRy = avatarY + 10 + (isWalking ? -walkOff : 0);

    // Legs
    ctx.fillStyle = litColor('#2F3136', Math.PI/2, light);
    ctx.fillRect(legLx - 3, legLy, 6, 22);
    ctx.fillRect(legRx - 3, legRy, 6, 22);
    // Feet
    ctx.fillStyle = litColor('#3D2314', Math.PI/4, light);
    ctx.fillRect(legLx - 5, legLy + 20, 10, 5);
    ctx.fillRect(legRx - 5, legRy + 20, 10, 5);
    // Torso
    ctx.fillStyle = litColor('#4A6741', -Math.PI/6, light);
    ctx.beginPath();
    ctx.moveTo(torsoX - 12, torsoY - 8);
    ctx.lineTo(torsoX - 16, torsoY + 5);
    ctx.lineTo(torsoX - 10, torsoY + 22);
    ctx.lineTo(torsoX + 10, torsoY + 22);
    ctx.lineTo(torsoX + 16, torsoY + 5);
    ctx.lineTo(torsoX + 12, torsoY - 8);
    ctx.closePath(); ctx.fill();
    // Arms
    ctx.fillStyle = litColor('#D4A574', 0, light);
    ctx.fillRect(armLx - 3, armLy, 5, 20);
    ctx.fillRect(armRx - 2, armRy, 5, 20);
    // Hands
    ctx.fillStyle = litColor('#C89B5D', 0, light);
    ctx.beginPath(); ctx.arc(armLx, armLy + 22, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(armRx + 1, armRy + 22, 3, 0, Math.PI*2); ctx.fill();
    // Weapon (attack pose)
    if (isAttack) {
      ctx.strokeStyle = '#AAAAAA';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(armRx + 1, armRy + 5);
      ctx.lineTo(armRx + 20, armRy - 15);
      ctx.stroke();
    }
    // Head
    ctx.fillStyle = litColor('#D4A574', -Math.PI/4, light);
    ctx.beginPath(); ctx.ellipse(headX, headY, 10, 12, 0, 0, Math.PI*2); ctx.fill();
    // Hair
    ctx.fillStyle = litColor('#2C1810', -Math.PI/3, light);
    ctx.beginPath(); ctx.ellipse(headX, headY - 5, 11, 8, 0, Math.PI, 0); ctx.fill();
    // Eyes
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(headX - 6, headY - 2, 4, 3);
    ctx.fillRect(headX + 2, headY - 2, 4, 3);

    // Hooks overlay
    if (showHooks) {
      const hookPts = {head:[headX,headY],shoulder_L:[armLx,armLy],shoulder_R:[armRx,armRy],
        hip_L:[legLx,legLy],hip_R:[legRx,legRy],hand_L:[armLx,armLy+22],hand_R:[armRx+1,armRy+22],
        foot_L:[legLx,legLy+22],foot_R:[legRx,legRy+22],center:[torsoX,torsoY+10]};
      ctx.strokeStyle = 'rgba(0,255,255,0.3)';
      ctx.lineWidth = 1;
      const bones = [['head','center'],['shoulder_L','center'],['shoulder_R','center'],
        ['shoulder_L','hand_L'],['shoulder_R','hand_R'],['hip_L','center'],['hip_R','center'],
        ['hip_L','foot_L'],['hip_R','foot_R']];
      for (const [a,b] of bones) {
        ctx.beginPath(); ctx.moveTo(hookPts[a][0],hookPts[a][1]); ctx.lineTo(hookPts[b][0],hookPts[b][1]); ctx.stroke();
      }
      for (const [k,v] of Object.entries(hookPts)) {
        ctx.beginPath(); ctx.arc(v[0],v[1],2.5,0,Math.PI*2);
        ctx.fillStyle = k === 'center' ? '#FF0' : '#0FF';
        ctx.fill();
      }
    }

    // === PARTICLES (ambient embers for firelit) ===
    if (lighting === 'firelit' || lighting === 'horror') {
      for (let i = 0; i < 6; i++) {
        const px = 40 + Math.sin(t * 0.7 + i * 2.1) * 120 + 120;
        const py = 300 - (t * 20 + i * 60) % 280;
        const size = 1 + Math.sin(t + i) * 0.8;
        ctx.fillStyle = ['#FF4400','#FF6600','#FFAA00','#FF8800'][i % 4];
        ctx.globalAlpha = 0.4 + Math.sin(t * 2 + i) * 0.3;
        ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // === HUD OVERLAY ===
    if (showHUD) {
      // HP bar
      ctx.fillStyle = '#1A1A1A';
      ctx.fillRect(8, 8, 100, 10);
      ctx.fillStyle = '#22AA44';
      ctx.fillRect(8, 8, 78, 10);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
      ctx.strokeRect(8, 8, 100, 10);
      ctx.fillStyle = '#FFF'; ctx.font = '7px monospace';
      ctx.fillText('HP 78/100', 12, 16);

      // MP bar
      ctx.fillStyle = '#1A1A1A';
      ctx.fillRect(8, 21, 100, 10);
      ctx.fillStyle = '#4488DD';
      ctx.fillRect(8, 21, 92, 10);
      ctx.strokeStyle = '#333';
      ctx.strokeRect(8, 21, 100, 10);
      ctx.fillStyle = '#FFF';
      ctx.fillText('MP 92/100', 12, 29);

      // Nameplate above avatar
      const npW = 72, npH = 20;
      ctx.fillStyle = 'rgba(10,10,20,0.75)';
      ctx.beginPath();
      ctx.roundRect(avatarX - npW/2, avatarY - 56, npW, npH, 3);
      ctx.fill();
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Kael', avatarX, avatarY - 44);
      ctx.fillStyle = '#888'; ctx.font = '7px monospace';
      ctx.fillText('Warrior Lv.5', avatarX, avatarY - 37);
      // Mini HP under name
      ctx.fillStyle = '#1A1A1A';
      ctx.fillRect(avatarX - 28, avatarY - 35, 56, 3);
      ctx.fillStyle = '#22AA44';
      ctx.fillRect(avatarX - 28, avatarY - 35, 44, 3);
      ctx.textAlign = 'start';

      // Action buttons
      const btnY = ROOM_H + 8;
      const btns = [{icon:'⚔️',c:'#CC2222'},{icon:'🛡️',c:'#444466'},{icon:'💨',c:'#4A6741'},{icon:'🦘',c:'#CCAA22'}];
      for (let i = 0; i < 4; i++) {
        const bx = ROOM_W/2 - 88 + i * 44;
        ctx.fillStyle = btns[i].c + '44';
        ctx.beginPath(); ctx.roundRect(bx, btnY, 38, 38, 6); ctx.fill();
        ctx.strokeStyle = btns[i].c; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(bx, btnY, 38, 38, 6); ctx.stroke();
        ctx.font = '18px serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#FFF';
        ctx.fillText(btns[i].icon, bx + 19, btnY + 26);
      }
      ctx.textAlign = 'start';

      // Inventory bar
      const invY = btnY + 46;
      for (let i = 0; i < 6; i++) {
        const sx = ROOM_W/2 - 99 + i * 33;
        ctx.fillStyle = '#1A1A1A';
        ctx.fillRect(sx, invY, 30, 30);
        ctx.strokeStyle = i === 0 ? '#4488DD' : i === 2 ? '#FFAA00' : '#333';
        ctx.lineWidth = i === 0 || i === 2 ? 1.5 : 0.5;
        ctx.strokeRect(sx, invY, 30, 30);
        if (i === 0) { ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#FFF'; ctx.fillText('⚔️', sx+15, invY+22); }
        if (i === 2) { ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#FFF'; ctx.fillText('🧪', sx+15, invY+22); }
        ctx.textAlign = 'start';
      }
    }

    // Camera angle indicator
    ctx.fillStyle = '#FFF'; ctx.font = '9px monospace';
    ctx.fillText(`CAM: ${cameraAngle}°  ${biome}  ${lighting}`, 8, PHONE_H - 6);

    frameRef.current = requestAnimationFrame(draw);
  }, [biome, lighting, cameraAngle, showHUD, showHooks, avatarX, avatarY, avatarPose]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', color: '#e0e0e0', fontFamily: 'monospace', padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 6, letterSpacing: 2 }}>KASVILLAGE — PHONE PREVIEW</div>

      {/* Phone frame */}
      <div style={{ border: '3px solid #333', borderRadius: 20, padding: '24px 4px 16px 4px', background: '#111', position: 'relative' }}>
        {/* Notch */}
        <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', width: 60, height: 6, background: '#222', borderRadius: 3 }} />
        <canvas ref={canvasRef} width={PHONE_W} height={PHONE_H} style={{ display: 'block', borderRadius: 4 }} />
      </div>

      {/* Controls */}
      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', maxWidth: 340 }}>
        {Object.keys(BIOMES).map(b => (
          <button key={b} onClick={() => setBiome(b)} style={{ padding: '3px 7px', fontSize: 9, border: b === biome ? '1px solid #f80' : '1px solid #222', borderRadius: 3, background: b === biome ? '#f802' : '#111', color: b === biome ? '#f80' : '#666', cursor: 'pointer' }}>{b}</button>
        ))}
      </div>
      <div style={{ marginTop: 4, display: 'flex', gap: 4, justifyContent: 'center' }}>
        {Object.keys(LIGHTS).map(l => (
          <button key={l} onClick={() => setLighting(l)} style={{ padding: '3px 7px', fontSize: 9, border: l === lighting ? '1px solid #f0f' : '1px solid #222', borderRadius: 3, background: l === lighting ? '#f0f2' : '#111', color: l === lighting ? '#f0f' : '#666', cursor: 'pointer' }}>{l}</button>
        ))}
      </div>
      <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 9, color: '#555' }}>{cameraAngle}°</span>
        <input type="range" min={0} max={354} step={6} value={cameraAngle} onChange={e => setCameraAngle(+e.target.value)} style={{ width: 140, accentColor: '#0ff' }} />
        <button onClick={() => setShowHUD(!showHUD)} style={{ padding: '3px 7px', fontSize: 9, border: '1px solid #222', borderRadius: 3, background: showHUD ? '#0f02' : '#111', color: showHUD ? '#0f0' : '#666', cursor: 'pointer' }}>{showHUD ? 'HUD ON' : 'HUD OFF'}</button>
        <button onClick={() => setShowHooks(!showHooks)} style={{ padding: '3px 7px', fontSize: 9, border: '1px solid #222', borderRadius: 3, background: showHooks ? '#0ff2' : '#111', color: showHooks ? '#0ff' : '#666', cursor: 'pointer' }}>HOOKS</button>
      </div>
      <div style={{ marginTop: 4, display: 'flex', gap: 4, justifyContent: 'center' }}>
        {['idle','idle_combat','walk1','attack','crouch','block'].map(p => (
          <button key={p} onClick={() => setAvatarPose(p)} style={{ padding: '3px 6px', fontSize: 8, border: p === avatarPose ? '1px solid #0ff' : '1px solid #222', borderRadius: 3, background: p === avatarPose ? '#0ff2' : '#111', color: p === avatarPose ? '#0ff' : '#666', cursor: 'pointer' }}>{p}</button>
        ))}
      </div>
    </div>
  );
}
