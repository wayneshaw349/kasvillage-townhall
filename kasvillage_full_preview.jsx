import { useState, useEffect, useRef, useCallback } from "react";

const W = 380, H = 580, ROOM_H = 460;

const BIOMES = {
  gothic_castle: { floor:['#1A1A28','#1E1E2E'], wall:['#2A2A38','#333342','#2E2E3C','#353545'], accent:['#880022','#AA1133'], sky:'#06060B', wood:['#4A3520','#5A4530'], metal:'#555' },
  forest_ruins:  { floor:['#1A2A18','#1E2E1C'], wall:['#2A3A28','#333F32','#2E3C2C','#354535'], accent:['#C8B878','#AA9958'], sky:'#0A1A0A', wood:['#3A2A10','#4A3A20'], metal:'#556655' },
  volcanic_lair: { floor:['#1A0A08','#2A1A12'], wall:['#2A1A10','#3A2A18','#2E1E12','#352A1A'], accent:['#FF4400','#FF6600'], sky:'#0A0400', wood:['#2A1A0A','#3A2A14'], metal:'#665544' },
};

const LIGHTS = {
  horror:   { angle: Math.PI, sh: 0.7, amb: 0.12, flameColor: [255,102,0] },
  moonlit:  { angle: -Math.PI/3, sh: 0.65, amb: 0.14, flameColor: [180,200,255] },
  firelit:  { angle: Math.PI*0.8, sh: 0.6, amb: 0.18, flameColor: [255,153,51] },
  daylight: { angle: -Math.PI/4, sh: 0.3, amb: 0.35, flameColor: [255,248,230] },
};

function lit(hex, norm, L) {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  const d=Math.max(0.15,Math.cos(norm-L.angle)*0.5+0.5);
  const m=L.amb+d*(1-L.sh);
  const cl=v=>Math.max(0,Math.min(255,Math.round(v)));
  return `rgb(${cl(r*m)},${cl(g*m)},${cl(b*m)})`;
}

function srand(s){let h=s;return()=>{h=(h*1103515245+12345)&0x7fffffff;return(h%10000)/10000;};}

export default function FullPreview() {
  const ref = useRef(null);
  const [biome, setBiome] = useState('gothic_castle');
  const [lighting, setLighting] = useState('horror');
  const [cam, setCam] = useState(135);
  const [hud, setHud] = useState(true);
  const tRef = useRef(0);
  const fRef = useRef(0);

  const draw = useCallback(() => {
    const c = ref.current; if(!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0,0,W,H);
    tRef.current += 0.016;
    const t = tRef.current;
    const P = BIOMES[biome], L = LIGHTS[lighting];
    const R = srand(cam*100+Object.keys(BIOMES).indexOf(biome)*37);
    const yR = (cam*Math.PI)/180;

    // Sky
    ctx.fillStyle = lit(P.sky, 0, L);
    ctx.fillRect(0,0,W,H);

    // Ceiling beams
    ctx.fillStyle = lit(P.wall[0], -Math.PI/4, L);
    ctx.fillRect(45,0,290,10);
    ctx.fillStyle = lit(P.wood[0], -Math.PI/3, L);
    ctx.fillRect(130,0,8,10); ctx.fillRect(242,0,8,10);

    // Back wall
    const wallH = 175;
    ctx.fillStyle = lit(P.wall[0], -Math.PI/4+yR*0.2, L);
    ctx.fillRect(45,10,290,wallH);

    // Stone blocks — 8 rows
    for(let row=0;row<9;row++){
      const oy=12+row*19, off=row%2===0?0:22;
      for(let bx=-10+off;bx<340;bx+=R()*12+38){
        const bw=36+R()*16, c=P.wall[1+Math.floor(R()*3)];
        ctx.fillStyle=lit(c,-Math.PI/4+R()*0.3,L);
        ctx.globalAlpha=0.35+R()*0.2;
        ctx.fillRect(bx,oy,bw,17);
        ctx.globalAlpha=1;
      }
      // Mortar line
      ctx.fillStyle='rgba(0,0,0,0.08)';
      ctx.fillRect(45,oy+17,290,1);
    }

    // Moss patches
    ctx.globalAlpha=0.18;
    ctx.fillStyle='#1A3A1A';
    ctx.beginPath();ctx.ellipse(65,58,14,5,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(310,90,10,4,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(100,145,8,3,0,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;

    // Water stains
    ctx.strokeStyle='rgba(40,55,55,0.1)'; ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(305,40);ctx.lineTo(306,65);ctx.lineTo(305,85);ctx.stroke();

    // === ARCH DOORWAY ===
    ctx.fillStyle='#030306';
    ctx.fillRect(155,55,70,130);
    ctx.beginPath();ctx.ellipse(190,55,35,30,0,Math.PI,0);ctx.fill();
    // Deep corridor
    ctx.fillStyle='#020205'; ctx.fillRect(163,72,54,113);
    ctx.fillStyle='rgba(21,21,32,0.4)'; ctx.fillRect(170,88,40,2);
    ctx.fillStyle='rgba(21,21,32,0.3)'; ctx.fillRect(173,115,34,1.5);
    // Far glow
    ctx.fillStyle=`rgba(${L.flameColor[0]},${L.flameColor[1]},${L.flameColor[2]},0.05)`;
    ctx.beginPath();ctx.arc(190,100,8,0,Math.PI*2);ctx.fill();
    // Arch frame double
    ctx.strokeStyle=lit('#5A5A6A',0,L); ctx.lineWidth=5;
    ctx.beginPath();ctx.moveTo(153,185);ctx.lineTo(153,55);ctx.ellipse(190,55,37,32,0,Math.PI,0);ctx.lineTo(227,185);ctx.stroke();
    ctx.strokeStyle=lit('#4A4A5A',0,L); ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(156,185);ctx.lineTo(156,55);ctx.ellipse(190,55,34,29,0,Math.PI,0);ctx.lineTo(224,185);ctx.stroke();
    // Keystone
    ctx.fillStyle=lit(P.accent[1],-.3,L);
    ctx.beginPath();ctx.moveTo(185,22);ctx.lineTo(190,15);ctx.lineTo(195,22);ctx.lineTo(193,28);ctx.lineTo(187,28);ctx.closePath();ctx.fill();

    // === GOTHIC WINDOWS ===
    for(const wx of [58,296]){
      ctx.fillStyle='#080818';
      ctx.fillRect(wx,28,26,45);
      ctx.beginPath();ctx.ellipse(wx+13,28,13,10,0,Math.PI,0);ctx.fill();
      // Glass glow
      const gc=lighting==='moonlit'?'#3355AA':lighting==='firelit'?'#FF884430':'#3355AA';
      ctx.fillStyle=gc; ctx.globalAlpha=0.12;
      ctx.fillRect(wx+2,32,22,38);ctx.globalAlpha=1;
      // Lead came
      ctx.fillStyle=lit('#3A3A4A',0,L);
      ctx.fillRect(wx+12,28,2,45); ctx.fillRect(wx,45,26,2); ctx.fillRect(wx,58,26,1.5);
      // Sill
      ctx.fillStyle=lit('#4A4A5A',0,L);
      ctx.fillRect(wx-3,73,32,4);
    }
    // Moon shafts
    ctx.fillStyle='rgba(51,85,170,0.02)';
    ctx.beginPath();ctx.moveTo(60,73);ctx.lineTo(84,73);ctx.lineTo(120,260);ctx.lineTo(45,260);ctx.fill();

    // === SIDE WALLS ===
    ctx.fillStyle=lit('#1E1E2C',-Math.PI/2+yR*0.3,L);
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,510);ctx.lineTo(45,450);ctx.lineTo(45,185);ctx.closePath();ctx.fill();
    ctx.fillStyle=lit('#242434',Math.PI/2+yR*0.3,L);
    ctx.beginPath();ctx.moveTo(W,0);ctx.lineTo(W,510);ctx.lineTo(335,450);ctx.lineTo(335,185);ctx.closePath();ctx.fill();
    // Side wall stone hints
    ctx.globalAlpha=0.15;
    for(let sy=20;sy<420;sy+=42){
      ctx.fillStyle=lit('#222230',0,L);
      ctx.fillRect(5,sy,35,38); ctx.fillRect(340,sy,35,38);
    }
    ctx.globalAlpha=1;
    // Side sconces
    for(const sx of [30,346]){
      ctx.fillStyle=lit('#555',0,L); ctx.fillRect(sx,120,4,12);
      ctx.fillStyle=`rgba(${L.flameColor[0]},${L.flameColor[1]},${L.flameColor[2]},0.2)`;
      ctx.beginPath();ctx.arc(sx+2,114,5,0,Math.PI*2);ctx.fill();
    }

    // === COLUMNS ===
    for(const cx of [85,295]){
      // Capital with volutes
      ctx.fillStyle=lit('#555565',-Math.PI/4,L);
      ctx.fillRect(cx-13,118,26,4);ctx.fillRect(cx-11,122,22,8);
      ctx.strokeStyle=lit('#555565',0,L);ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(cx-11,124,3,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.arc(cx+11,124,3,0,Math.PI*2);ctx.stroke();
      // Shaft
      ctx.fillStyle=lit('#3A3A4A',yR*0.15,L);
      ctx.fillRect(cx-7,130,14,310);
      // Fluting
      ctx.globalAlpha=0.15;ctx.fillStyle='#2A2A38';
      ctx.fillRect(cx-4,135,1,300);ctx.fillRect(cx,135,1,300);ctx.fillRect(cx+4,135,1,300);
      ctx.globalAlpha=1;
      // Highlight edge
      ctx.fillStyle='rgba(74,74,90,0.25)';ctx.fillRect(cx-7,130,1,310);
      // Base molding
      ctx.fillStyle=lit('#4A4A5A',Math.PI/4,L);
      ctx.fillRect(cx-11,438,22,5);ctx.fillRect(cx-9,443,18,4);ctx.fillRect(cx-13,447,26,6);
    }

    // === BANNERS ===
    ctx.fillStyle=lit(P.accent[0],0,L);
    ctx.fillRect(120,25,20,58);
    ctx.beginPath();ctx.moveTo(120,83);ctx.lineTo(140,83);ctx.lineTo(130,96);ctx.closePath();ctx.fill();
    ctx.fillStyle=lit(P.accent[1],0,L);ctx.globalAlpha=0.25;ctx.fillRect(124,33,12,42);ctx.globalAlpha=1;
    // Emblem
    ctx.strokeStyle='rgba(204,170,68,0.4)';ctx.lineWidth=0.8;
    ctx.beginPath();ctx.arc(130,55,6,0,Math.PI*2);ctx.stroke();
    // Rod
    ctx.fillStyle=lit('#666',0,L);ctx.fillRect(117,23,26,3);
    ctx.beginPath();ctx.arc(117,24.5,2.5,0,Math.PI*2);ctx.fillStyle='#777';ctx.fill();

    // === TORCHES ===
    for(const tx of [106,273]){
      ctx.fillStyle=lit('#555',0,L);
      ctx.fillRect(tx-6,100,13,5);ctx.fillRect(tx-2,85,5,17);ctx.fillRect(tx-4,82,9,4);
      // 5-layer flame
      const fc=L.flameColor;
      ctx.fillStyle=`rgba(${fc[0]},${fc[1]},${fc[2]},0.06)`;
      ctx.beginPath();ctx.ellipse(tx+1,72,16,20,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=`rgba(${fc[0]},${fc[1]},${fc[2]},0.15)`;
      ctx.beginPath();ctx.ellipse(tx+1,75,10,13,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=`rgba(${Math.min(255,fc[0]+50)},${Math.min(255,fc[1]+50)},${fc[2]},0.3)`;
      ctx.beginPath();ctx.ellipse(tx+1,73,6,9,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=`rgba(255,${Math.min(255,fc[1]+100)},0,0.5)`;
      ctx.beginPath();ctx.ellipse(tx+1,71,3.5,6,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,200,0.4)';
      ctx.beginPath();ctx.ellipse(tx+1,69,1.5,3,0,0,Math.PI*2);ctx.fill();
      // Floor glow pool
      ctx.fillStyle=`rgba(${fc[0]},${fc[1]},${fc[2]},0.025)`;
      ctx.beginPath();ctx.ellipse(tx+1,240,48,16,0,0,Math.PI*2);ctx.fill();
    }

    // === FLOOR — perspective tiles ===
    const pS=Math.abs(Math.cos(yR));
    for(let row=0;row<9;row++){
      const yP=row/9, scale=1-(1-yP)*pS*0.35;
      const xO=(1-scale)*W*0.5;
      const tW=44*scale, tH=14+row*2.5;
      const fy=185+row*tH;
      for(let tx=0;tx<9;tx++){
        ctx.fillStyle=lit(P.floor[(tx+row)%2],Math.PI/2+R()*0.05,L);
        ctx.globalAlpha=0.78+row*0.015;
        ctx.fillRect(xO+tx*tW,fy,tW-0.5,tH-0.5);
      }
      // Grout
      ctx.fillStyle='rgba(0,0,0,0.08)';
      ctx.fillRect(45,fy+tH-0.5,290,0.5);
    }
    ctx.globalAlpha=1;

    // Floor cracks
    ctx.strokeStyle='rgba(0,0,0,0.16)';ctx.lineWidth=0.8;
    ctx.beginPath();ctx.moveTo(130,290);ctx.lineTo(148,300);ctx.lineTo(143,315);ctx.lineTo(155,321);ctx.stroke();
    ctx.beginPath();ctx.moveTo(250,340);ctx.lineTo(236,348);ctx.lineTo(246,360);ctx.stroke();

    // === TABLE ===
    const tbX=100,tbY=300;
    ctx.fillStyle=lit(P.wood[1],-Math.PI/6,L);
    ctx.fillRect(tbX,tbY,65,8);
    ctx.fillStyle=lit(P.wood[0],0,L);
    ctx.fillRect(tbX-2,tbY-1,69,2); // edge molding
    // Legs + brace
    ctx.fillStyle=lit(P.wood[0],Math.PI/2,L);
    ctx.fillRect(tbX+5,tbY+8,5,22);ctx.fillRect(tbX+55,tbY+8,5,22);
    ctx.strokeStyle=lit('#3A2A1A',0,L);ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(tbX+7,tbY+22);ctx.lineTo(tbX+58,tbY+22);ctx.stroke();
    // Book
    ctx.fillStyle=lit(P.accent[0],-Math.PI/4,L);
    ctx.fillRect(tbX+12,tbY-8,12,8);
    ctx.fillStyle=lit(P.accent[1],0,L);ctx.fillRect(tbX+13,tbY-9,10,2);
    // Scroll
    ctx.fillStyle=lit('#3A3A20',0,L);ctx.fillRect(tbX+28,tbY-6,8,6);
    // Goblet
    ctx.fillStyle=lit(P.metal,0,L);
    ctx.fillRect(tbX+44,tbY-10,5,4);ctx.fillRect(tbX+43,tbY-13,7,4);ctx.fillRect(tbX+45,tbY-6,3,4);
    // Plate
    ctx.fillStyle=lit('#CCAA44',0,L);ctx.globalAlpha=0.6;
    ctx.beginPath();ctx.arc(tbX+50,tbY-3,5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;

    // === CHAIR ===
    ctx.fillStyle=lit(P.wood[0],0,L);
    ctx.fillRect(90,298,16,5);ctx.fillRect(89,280,14,18);
    // Slats
    ctx.strokeStyle=lit('#3A2A14',0,L);ctx.lineWidth=1;
    for(const sx of [92,96,100]){ctx.beginPath();ctx.moveTo(sx,282);ctx.lineTo(sx,296);ctx.stroke();}
    ctx.fillStyle=lit(P.wood[0],Math.PI/2,L);
    ctx.fillRect(91,303,3,16);ctx.fillRect(103,303,3,16);

    // === BARRELS ===
    for(const[bx,by,br] of [[310,332,13],[328,342,13]]){
      ctx.fillStyle=lit(bx<320?'#3A2008':'#4A2A10',0,L);
      ctx.beginPath();ctx.ellipse(bx,by,br,18,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=lit('#5A3A1A',0,L);ctx.globalAlpha=0.5;
      ctx.fillRect(bx-br,by-10,br*2,2.5);ctx.fillRect(bx-br,by+8,br*2,2.5);
      ctx.globalAlpha=1;
      // Grain
      ctx.strokeStyle='rgba(40,24,8,0.15)';ctx.lineWidth=0.5;
      for(const gx of [-5,2,8]){ctx.beginPath();ctx.moveTo(bx+gx,by-16);ctx.lineTo(bx+gx,by+16);ctx.stroke();}
      // Top ellipse
      ctx.fillStyle=lit('#5A3A1A',-.3,L);ctx.globalAlpha=0.35;
      ctx.beginPath();ctx.ellipse(bx,by-16,br,5,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    }
    // Rust
    ctx.fillStyle='rgba(106,58,26,0.25)';
    ctx.beginPath();ctx.arc(325,338,2.5,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(305,328,1.8,0,Math.PI*2);ctx.fill();

    // === CHEST ===
    ctx.fillStyle=lit(P.wood[0],Math.PI/4,L);ctx.fillRect(52,375,34,20);
    ctx.fillStyle=lit(P.wood[1],-Math.PI/4,L);ctx.fillRect(50,370,38,7);
    // Iron bands
    ctx.fillStyle=lit(P.metal,0,L);ctx.globalAlpha=0.4;
    ctx.fillRect(52,380,34,2);ctx.fillRect(52,388,34,2);ctx.globalAlpha=1;
    // Lock
    ctx.fillStyle='rgba(85,85,85,0.6)';ctx.fillRect(64,381,10,8);
    ctx.fillStyle='#FFD700';ctx.beginPath();ctx.arc(69,385,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#AA8800';ctx.beginPath();ctx.arc(69,385,1.5,0,Math.PI*2);ctx.fill();

    // Cobwebs
    ctx.strokeStyle='rgba(85,85,85,0.12)';ctx.lineWidth=0.3;
    ctx.beginPath();ctx.moveTo(45,185);ctx.quadraticCurveTo(55,190,50,202);ctx.stroke();
    ctx.beginPath();ctx.moveTo(47,186);ctx.lineTo(56,196);ctx.stroke();
    ctx.beginPath();ctx.moveTo(335,185);ctx.quadraticCurveTo(325,189,330,200);ctx.stroke();

    // === AVATAR ===
    // Shadow
    ctx.fillStyle='rgba(0,0,0,0.2)';
    ctx.beginPath();ctx.ellipse(190,422,24,7,0,0,Math.PI*2);ctx.fill();
    // Back leg
    ctx.fillStyle=lit('#222228',Math.PI/2,L);ctx.fillRect(182,398,8,26);
    ctx.fillStyle=lit('#1A1210',Math.PI/4,L);ctx.fillRect(180,422,12,5);
    // Torso armor
    ctx.fillStyle=lit('#3A5A35',-Math.PI/6,L);
    ctx.beginPath();ctx.moveTo(174,370);ctx.lineTo(171,384);ctx.lineTo(175,402);ctx.lineTo(205,402);ctx.lineTo(209,384);ctx.lineTo(206,370);ctx.closePath();ctx.fill();
    // Armor line + belt
    ctx.strokeStyle=lit('#2A4A28',0,L);ctx.lineWidth=0.8;
    ctx.beginPath();ctx.moveTo(190,372);ctx.lineTo(190,400);ctx.stroke();
    ctx.fillStyle=lit('#2A1A0A',0,L);ctx.fillRect(176,395,28,4);
    ctx.fillStyle=lit('#CCAA44',0,L);ctx.fillRect(187,393,6,6);
    // Pauldrons
    ctx.fillStyle=lit('#3A5A35',-.2,L);
    ctx.beginPath();ctx.ellipse(174,372,6,4,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(206,372,6,4,0,0,Math.PI*2);ctx.fill();
    // Front leg
    ctx.fillStyle=lit('#2A2A32',Math.PI/2,L);ctx.fillRect(192,398,8,26);
    ctx.fillStyle=lit('#2A1A10',Math.PI/4,L);ctx.fillRect(190,422,12,5);
    // Boot straps
    ctx.fillStyle='rgba(58,42,26,0.5)';ctx.fillRect(181,415,10,1.5);ctx.fillRect(191,415,10,1.5);
    // Back arm + shield
    ctx.fillStyle=lit('#A07A55',0,L);ctx.fillRect(168,374,7,24);
    ctx.beginPath();ctx.arc(171,400,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=lit('#555',0,L);
    ctx.beginPath();ctx.ellipse(167,388,8,10,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=lit('#444',0,L);
    ctx.beginPath();ctx.ellipse(167,388,6,8,0,0,Math.PI*2);ctx.fill();
    // Front arm
    ctx.fillStyle=lit('#C4956A',0,L);ctx.fillRect(205,374,7,24);
    ctx.beginPath();ctx.arc(209,400,4,0,Math.PI*2);ctx.fill();
    // Sword
    ctx.strokeStyle='#AAA';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(209,394);ctx.lineTo(209,360);ctx.stroke();
    ctx.strokeStyle='#CCC';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(209,360);ctx.lineTo(209,350);ctx.stroke();
    ctx.strokeStyle='#DDD';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(209,350);ctx.lineTo(209,347);ctx.stroke();
    ctx.fillStyle='#CCAA44';ctx.beginPath();ctx.arc(209,396,2.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=lit('#888',0,L);ctx.fillRect(203,393,12,3);
    // Head
    ctx.fillStyle=lit('#C4956A',-Math.PI/4,L);
    ctx.beginPath();ctx.ellipse(190,360,12,14,0,0,Math.PI*2);ctx.fill();
    // Nose shadow
    ctx.fillStyle='rgba(160,122,85,0.2)';
    ctx.beginPath();ctx.ellipse(190,365,2,3,0,0,Math.PI*2);ctx.fill();
    // Hair
    ctx.fillStyle=lit('#1E1410',-Math.PI/3,L);
    ctx.beginPath();ctx.ellipse(190,352,13,10,0,Math.PI,0);ctx.fill();
    ctx.beginPath();ctx.moveTo(176,357);ctx.lineTo(179,350);ctx.lineTo(183,355);ctx.lineTo(187,347);ctx.lineTo(190,352);ctx.lineTo(193,347);ctx.lineTo(197,355);ctx.lineTo(201,350);ctx.lineTo(204,357);ctx.fill();
    // Spikes
    ctx.strokeStyle='#1E1410';ctx.lineWidth=1.5;
    for(const[sx,sy] of [[178,345,176,338],[184,342,183,335],[190,340,190,334],[196,342,197,335],[202,345,204,338]]){
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(arguments[2]||sx-2,arguments[3]||sy-7);ctx.stroke();
    }
    // Eyes
    ctx.fillStyle='#1A1A2A';
    ctx.fillRect(183,357,5,4);ctx.fillRect(193,357,5,4);
    ctx.fillStyle='rgba(255,255,255,0.6)';
    ctx.fillRect(185,357.5,2,2);ctx.fillRect(195,357.5,2,2);

    // Nameplate
    ctx.fillStyle='rgba(10,10,20,0.85)';
    ctx.beginPath();ctx.roundRect(152,326,76,22,4);ctx.fill();
    ctx.fillStyle='#FFD700';ctx.font='bold 10px monospace';ctx.textAlign='center';
    ctx.fillText('Kael',190,338);
    ctx.fillStyle='#888';ctx.font='7px monospace';
    ctx.fillText('Warrior Lv.5',190,346);
    ctx.fillStyle='#1A1A1A';ctx.fillRect(162,348,56,3);
    ctx.fillStyle='#22AA44';ctx.fillRect(162,348,44,3);
    ctx.textAlign='start';

    // Dust motes
    for(let i=0;i<8;i++){
      const dx=60+Math.sin(t*0.3+i*1.7)*140+80;
      const dy=160+(t*8+i*50)%250;
      ctx.fillStyle=`rgba(170,170,170,${0.08+Math.sin(t+i)*0.04})`;
      ctx.beginPath();ctx.arc(dx,dy,0.5+Math.sin(t*2+i)*0.3,0,Math.PI*2);ctx.fill();
    }
    // Embers
    for(let i=0;i<6;i++){
      const ex=90+Math.sin(t*0.5+i*2.3)*140+60;
      const ey=400-(t*15+i*55)%340;
      const es=0.8+Math.sin(t*3+i)*0.5;
      ctx.fillStyle=[`rgba(${L.flameColor[0]},${L.flameColor[1]>>1},0,0.3)`,`rgba(${L.flameColor[0]},${L.flameColor[1]},0,0.25)`][i%2];
      ctx.beginPath();ctx.arc(ex,ey,es,0,Math.PI*2);ctx.fill();
    }

    // === HUD ===
    if(hud){
      // Bars
      const bars=[{v:78,m:100,c:'#22AA44',l:'HP'},{v:92,m:100,c:'#3377CC',l:'MP'},{v:65,m:100,c:'#CCAA22',l:'SP'}];
      bars.forEach((b,i)=>{
        const by=ROOM_H+8+i*16;
        ctx.fillStyle='rgba(10,10,20,0.88)';ctx.beginPath();ctx.roundRect(8,by,115,13,2);ctx.fill();
        ctx.fillStyle=b.c;ctx.fillRect(9,by+1,105*(b.v/b.m),11);
        ctx.fillStyle='#FFF';ctx.font='7px monospace';ctx.fillText(`${b.l} ${b.v}/${b.m}`,14,by+10);
      });
      // Buttons
      const btns=[{i:'⚔️',c:'#CC2222'},{i:'🛡️',c:'#444466'},{i:'💨',c:'#4A6741'},{i:'🦘',c:'#CCAA22'}];
      btns.forEach((b,i)=>{
        const bx=95+i*48;
        ctx.fillStyle=b.c+'30';ctx.beginPath();ctx.roundRect(bx,ROOM_H+60,44,44,7);ctx.fill();
        ctx.strokeStyle=b.c;ctx.lineWidth=1.2;ctx.beginPath();ctx.roundRect(bx,ROOM_H+60,44,44,7);ctx.stroke();
        ctx.font='22px serif';ctx.textAlign='center';ctx.fillStyle='#FFF';
        ctx.fillText(b.i,bx+22,ROOM_H+88);
      });
      ctx.textAlign='start';
      // Inventory
      const items=[{i:'⚔️',b:'#4488DD'},{i:null,b:'#333'},{i:'🧪',b:'#FFAA00'},{i:'📜',b:'#AA44CC'},{i:null,b:'#333'},{i:null,b:'#333'}];
      items.forEach((it,i)=>{
        const sx=65+i*38;
        ctx.fillStyle='#0E0E18';ctx.fillRect(sx,ROOM_H+112,36,36);
        ctx.strokeStyle=it.b;ctx.lineWidth=it.i?1.5:0.5;ctx.strokeRect(sx,ROOM_H+112,36,36);
        if(it.i){ctx.font='18px serif';ctx.textAlign='center';ctx.fillStyle='#FFF';ctx.fillText(it.i,sx+18,ROOM_H+136);ctx.textAlign='start';}
      });
    }
    // Camera label
    ctx.fillStyle='#444';ctx.font='8px monospace';
    ctx.fillText(`CAM:${cam}° ${biome.toUpperCase()} ${lighting.toUpperCase()}`,8,H-8);
    ctx.fillText('KasVillage Procedural SDK v2.0',8,H-18);

    fRef.current=requestAnimationFrame(draw);
  },[biome,lighting,cam,hud]);

  useEffect(()=>{fRef.current=requestAnimationFrame(draw);return()=>cancelAnimationFrame(fRef.current);},[draw]);

  return(
    <div style={{background:'#0a0a0f',minHeight:'100vh',color:'#e0e0e0',fontFamily:'monospace',padding:8,display:'flex',flexDirection:'column',alignItems:'center'}}>
      <div style={{fontSize:11,color:'#555',marginBottom:4,letterSpacing:2}}>KASVILLAGE — FULL VAGRANT STORY DETAIL</div>
      <div style={{border:'3px solid #333',borderRadius:22,padding:'26px 5px 18px 5px',background:'#111',position:'relative'}}>
        <div style={{position:'absolute',top:8,left:'50%',transform:'translateX(-50%)',width:60,height:6,background:'#222',borderRadius:3}}/>
        <canvas ref={ref} width={W} height={H} style={{display:'block',borderRadius:6}}/>
      </div>
      <div style={{marginTop:8,display:'flex',gap:4,flexWrap:'wrap',justifyContent:'center',maxWidth:390}}>
        {Object.keys(BIOMES).map(b=><button key={b} onClick={()=>setBiome(b)} style={{padding:'3px 7px',fontSize:9,border:b===biome?'1px solid #f80':'1px solid #222',borderRadius:3,background:b===biome?'#f802':'#111',color:b===biome?'#f80':'#555',cursor:'pointer'}}>{b}</button>)}
      </div>
      <div style={{marginTop:4,display:'flex',gap:4,justifyContent:'center'}}>
        {Object.keys(LIGHTS).map(l=><button key={l} onClick={()=>setLighting(l)} style={{padding:'3px 7px',fontSize:9,border:l===lighting?'1px solid #f0f':'1px solid #222',borderRadius:3,background:l===lighting?'#f0f2':'#111',color:l===lighting?'#f0f':'#555',cursor:'pointer'}}>{l}</button>)}
      </div>
      <div style={{marginTop:4,display:'flex',gap:6,alignItems:'center',justifyContent:'center'}}>
        <span style={{fontSize:9,color:'#444'}}>{cam}°</span>
        <input type="range" min={0} max={354} step={6} value={cam} onChange={e=>setCam(+e.target.value)} style={{width:160,accentColor:'#0ff'}}/>
        <button onClick={()=>setHud(!hud)} style={{padding:'3px 7px',fontSize:9,border:'1px solid #222',borderRadius:3,background:hud?'#0f02':'#111',color:hud?'#0f0':'#555',cursor:'pointer'}}>{hud?'HUD ON':'HUD OFF'}</button>
      </div>
    </div>
  );
}
