// ============================================================================
// KasVillage Environment Item Library v2
// 200+ procedural objects for reference-matched room generation
// Each item: fingerprint (5×5) + multi-element builder + texture layer
// ============================================================================

import { ShadingPreset } from './kasvillage_avatar_engine';
import { LayerElement } from './kasvillage_environments';

// ============================================================================
// TEXTURE GENERATORS — applied on top of base shapes
// ============================================================================

type Ctx = { mood: ShadingPreset };

function lit(base: string, norm: number, mood: ShadingPreset): string {
  const r=parseInt(base.slice(1,3),16)||0,g=parseInt(base.slice(3,5),16)||0,b=parseInt(base.slice(5,7),16)||0;
  const la:{[k:string]:number}={horror:Math.PI,daylight:-Math.PI/4,twilight:-Math.PI/2,neon:0,moonlit:-Math.PI/3,firelit:Math.PI,custom:-Math.PI/4};
  const sh:{[k:string]:number}={horror:.7,daylight:.3,twilight:.5,neon:.6,moonlit:.6,firelit:.6,custom:.4};
  const d=Math.max(.2,Math.cos(norm-(la[mood]||0))*.5+.5);
  const m=.15+d*(1-(sh[mood]||.4));
  const cl=(v:number)=>Math.max(0,Math.min(255,Math.round(v)));
  return `#${cl(r*m).toString(16).padStart(2,'0')}${cl(g*m).toString(16).padStart(2,'0')}${cl(b*m).toString(16).padStart(2,'0')}`;
}

function el(t:LayerElement['type'],p:Record<string,string|number>,base:string,norm:number,mood:ShadingPreset):LayerElement{
  return{type:t,props:p,baseColor:base,normalAngle:norm,litColor:lit(base,norm,mood)};
}

let _s=1;
function R(){_s=(_s*1103515245+12345)&0x7fffffff;return(_s%10000)/10000;}
function setSeed(s:number){_s=s;}

// --- Stone texture: fills a rect with offset stone blocks + mortar ---
function stoneTexture(x:number,y:number,w:number,h:number,colors:string[],mood:ShadingPreset):LayerElement[]{
  const els:LayerElement[]=[];
  const bw=28+R()*14,bh=12+R()*6;
  for(let row=0;row<Math.ceil(h/bh);row++){
    const off=row%2===0?0:bw*0.5;
    for(let col=-1;col<Math.ceil(w/bw)+1;col++){
      const bx=x+col*bw+off,by_=y+row*bh;
      if(bx+bw<x||bx>x+w||by_+bh<y||by_>y+h) continue;
      els.push(el('rect',{x:bx+0.5,y:by_+0.5,width:bw-1,height:bh-1,rx:1,opacity:0.3+R()*0.2},colors[Math.floor(R()*colors.length)],-Math.PI/4+R()*0.3,mood));
    }
    els.push(el('rect',{x,y:y+row*bh+bh-0.5,width:w,height:0.5,opacity:0.08},'#000000',0,mood));
  }
  return els;
}

// --- Wood grain: overlays thin lines on a wood surface ---
function woodGrain(x:number,y:number,w:number,h:number,darkColor:string,mood:ShadingPreset,vertical=true):LayerElement[]{
  const els:LayerElement[]=[];
  const count=Math.floor((vertical?w:h)/3);
  for(let i=0;i<count;i++){
    const offset=i*3+R()*1.5;
    if(vertical) els.push(el('rect',{x:x+offset,y,width:0.5,height:h,opacity:0.06+R()*0.06},darkColor,0,mood));
    else els.push(el('rect',{x,y:y+offset,width:w,height:0.5,opacity:0.06+R()*0.06},darkColor,0,mood));
  }
  // Knot
  if(R()>0.6) els.push(el('circle',{cx:x+w*R(),cy:y+h*R(),r:1.5+R()*2,opacity:0.08},darkColor,0,mood));
  return els;
}

// --- Metal texture: scratches + highlights ---
function metalTexture(x:number,y:number,w:number,h:number,mood:ShadingPreset):LayerElement[]{
  const els:LayerElement[]=[];
  for(let i=0;i<3;i++){
    const sx=x+R()*w,sy=y+R()*h,len=3+R()*8;
    els.push(el('rect',{x:sx,y:sy,width:len,height:0.5,opacity:0.1+R()*0.08},'#AAAAAA',R()*Math.PI,mood));
  }
  // Highlight
  els.push(el('rect',{x:x+2,y:y+1,width:w*0.3,height:1,opacity:0.08},'#FFFFFF',0,mood));
  return els;
}

// --- Fabric texture: cross-hatch ---
function fabricTexture(x:number,y:number,w:number,h:number,mood:ShadingPreset):LayerElement[]{
  const els:LayerElement[]=[];
  for(let i=0;i<Math.floor(w/4);i++){
    els.push(el('rect',{x:x+i*4,y,width:0.3,height:h,opacity:0.04},'#000000',0,mood));
  }
  for(let i=0;i<Math.floor(h/4);i++){
    els.push(el('rect',{x,y:y+i*4,width:w,height:0.3,opacity:0.04},'#000000',0,mood));
  }
  return els;
}

// --- Ambient decorators ---
function addMoss(x:number,y:number,mood:ShadingPreset):LayerElement[]{
  return[el('circle',{cx:x,cy:y,r:4+R()*8,opacity:0.12+R()*0.08},'#1A3A1A',0,mood)];
}
function addRust(x:number,y:number,mood:ShadingPreset):LayerElement[]{
  const els:LayerElement[]=[];
  for(let i=0;i<2+Math.floor(R()*3);i++) els.push(el('circle',{cx:x+R()*10-5,cy:y+R()*8-4,r:1+R()*2,opacity:0.15+R()*0.1},'#8A4A2A',0,mood));
  return els;
}
function addCrack(x:number,y:number,len:number,mood:ShadingPreset):LayerElement[]{
  let d=`M ${x} ${y}`;
  for(let i=0;i<3;i++) d+=` l ${(R()-0.3)*len} ${R()*len*0.5}`;
  return[el('path',{d,strokeWidth:0.6,fill:'none',opacity:0.12+R()*0.06},'#000000',Math.PI/2,mood)];
}
function addCobweb(x:number,y:number,size:number,mood:ShadingPreset):LayerElement[]{
  const els:LayerElement[]=[];
  for(let i=0;i<4;i++){
    const a=R()*Math.PI*0.5;
    els.push(el('path',{d:`M ${x} ${y} l ${Math.cos(a)*size} ${Math.sin(a)*size}`,strokeWidth:0.3,fill:'none',opacity:0.08+R()*0.05},'#555555',0,mood));
  }
  return els;
}
function addDust(x:number,y:number,count:number,spread:number,mood:ShadingPreset):LayerElement[]{
  const els:LayerElement[]=[];
  for(let i=0;i<count;i++) els.push(el('circle',{cx:x+R()*spread-spread/2,cy:y+R()*spread-spread/2,r:0.3+R()*0.5,opacity:0.06+R()*0.06},'#888888',0,mood));
  return els;
}

// ============================================================================
// ITEM CATEGORIES — 200+ objects
// ============================================================================

interface ItemDef {
  name: string;
  category: string;
  fingerprint: number[]; // 5×5 = 25 values
  baseW: number;
  baseH: number;
  build: (x:number,y:number,s:number,c:string[],m:ShadingPreset)=>LayerElement[];
}

// Helper: pick color
function pc(c:string[],i:number){return c[Math.abs(i)%c.length];}

export const ITEM_LIBRARY: ItemDef[] = [

  // ============================
  // SEATING (15)
  // ============================
  {name:'chair_simple',category:'seating',baseW:18,baseH:34,fingerprint:[0,.3,.8,.3,0,0,.2,.8,.2,0,0,0,.9,0,0,0,.8,.2,.8,0,0,.8,0,.8,0],
   build:(x,y,s,c,m)=>[
     el('rect',{x:x-4*s,y:y-18*s,width:8*s,height:18*s,rx:1},pc(c,0),-Math.PI/4,m),
     el('rect',{x:x-9*s,y:y,width:18*s,height:4*s,rx:1},pc(c,0),0,m),
     el('rect',{x:x-7*s,y:y+4*s,width:3*s,height:14*s},pc(c,1),Math.PI/2,m),
     el('rect',{x:x+4*s,y:y+4*s,width:3*s,height:14*s},pc(c,1),Math.PI/2,m),
     ...woodGrain(x-9*s,y,18*s,4*s,pc(c,1),m,false),
   ]},
  {name:'chair_ornate',category:'seating',baseW:22,baseH:40,fingerprint:[0,.4,.9,.4,0,.2,.3,.8,.3,.2,0,.2,.9,.2,0,.5,.8,.2,.8,.5,0,.7,0,.7,0],
   build:(x,y,s,c,m)=>[
     el('rect',{x:x-5*s,y:y-22*s,width:10*s,height:22*s,rx:1},pc(c,0),-Math.PI/4,m),
     // Carved top
     el('circle',{cx:x,cy:y-20*s,r:4*s,opacity:0.3},pc(c,2||c[0]),0,m),
     el('rect',{x:x-10*s,y:y,width:20*s,height:5*s,rx:2},pc(c,0),0,m),
     // Arms
     el('rect',{x:x-10*s,y:y-8*s,width:3*s,height:10*s},pc(c,1),0,m),
     el('rect',{x:x+7*s,y:y-8*s,width:3*s,height:10*s},pc(c,1),0,m),
     el('rect',{x:x-8*s,y:y+5*s,width:3*s,height:16*s},pc(c,1),Math.PI/2,m),
     el('rect',{x:x+5*s,y:y+5*s,width:3*s,height:16*s},pc(c,1),Math.PI/2,m),
     ...woodGrain(x-10*s,y,20*s,5*s,pc(c,1),m,false),
   ]},
  {name:'bench_wooden',category:'seating',baseW:55,baseH:20,fingerprint:[0,0,0,0,0,.9,.9,.9,.9,.9,.8,0,0,0,.8,.8,0,0,0,.8,0,0,0,0,0],
   build:(x,y,s,c,m)=>[
     el('rect',{x,y,width:55*s,height:5*s,rx:2},pc(c,0),0,m),
     ...woodGrain(x,y,55*s,5*s,pc(c,1),m,false),
     el('rect',{x:x+4*s,y:y+5*s,width:4*s,height:14*s},pc(c,1),Math.PI/2,m),
     el('rect',{x:x+47*s,y:y+5*s,width:4*s,height:14*s},pc(c,1),Math.PI/2,m),
     el('rect',{x:x+24*s,y:y+5*s,width:4*s,height:12*s},pc(c,1),Math.PI/2,m),
   ]},
  {name:'stool',category:'seating',baseW:16,baseH:22,fingerprint:[0,0,0,0,0,0,.9,.9,.9,0,0,0,.8,0,0,0,.7,.2,.7,0,0,.7,0,.7,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x,cy:y,r:8*s},pc(c,0),0,m),el('rect',{x:x-1*s,y:y,width:2*s,height:18*s},pc(c,1),0,m),el('rect',{x:x-6*s,y:y+16*s,width:4*s,height:4*s},pc(c,1),0,m),el('rect',{x:x+2*s,y:y+16*s,width:4*s,height:4*s},pc(c,1),0,m)]},
  {name:'throne',category:'seating',baseW:38,baseH:55,fingerprint:[0,.4,.9,.4,0,0,.5,.9,.5,0,0,.3,.8,.3,0,.6,.9,.4,.9,.6,0,.8,0,.8,0],
   build:(x,y,s,c,m)=>[
     el('rect',{x:x-5*s,y:y-30*s,width:10*s,height:30*s,rx:2},pc(c,0),-Math.PI/4,m),
     // Crown detail
     el('polygon',{points:`${x-6*s},${y-30*s} ${x-3*s},${y-36*s} ${x},${y-32*s} ${x+3*s},${y-36*s} ${x+6*s},${y-30*s}`},pc(c,2||c[0]),-Math.PI/3,m),
     el('rect',{x:x-15*s,y:y,width:30*s,height:6*s,rx:2},pc(c,0),0,m),
     ...fabricTexture(x-15*s,y,30*s,6*s,m),
     el('rect',{x:x-16*s,y:y-10*s,width:5*s,height:16*s,rx:1},pc(c,1),0,m),
     el('rect',{x:x+11*s,y:y-10*s,width:5*s,height:16*s,rx:1},pc(c,1),0,m),
     el('rect',{x:x-12*s,y:y+6*s,width:4*s,height:14*s},pc(c,1),Math.PI/2,m),
     el('rect',{x:x+8*s,y:y+6*s,width:4*s,height:14*s},pc(c,1),Math.PI/2,m),
   ]},
  {name:'cushion',category:'seating',baseW:14,baseH:8,fingerprint:[0,.3,.5,.3,0,.4,.6,.4,.6,.4,.5,.4,.3,.4,.5,.3,.5,.4,.5,.3,0,.2,.3,.2,0],
   build:(x,y,s,c,m)=>[el('rect',{x,y,width:14*s,height:8*s,rx:3*s},pc(c,0),0,m),...fabricTexture(x,y,14*s,8*s,m)]},
  {name:'sofa',category:'seating',baseW:60,baseH:28,fingerprint:[.3,.3,.8,.3,.3,.5,.2,.8,.2,.5,.9,.9,.9,.9,.9,.8,0,0,0,.8,.8,0,0,0,.8],
   build:(x,y,s,c,m)=>[el('rect',{x,y:y-12*s,width:60*s,height:12*s,rx:2},pc(c,0),-Math.PI/4,m),el('rect',{x,y,width:60*s,height:8*s,rx:2},pc(c,0),0,m),...fabricTexture(x,y,60*s,8*s,m),el('rect',{x:x-2*s,y:y-12*s,width:6*s,height:20*s,rx:2},pc(c,1),0,m),el('rect',{x:x+56*s,y:y-12*s,width:6*s,height:20*s,rx:2},pc(c,1),0,m)]},

  // ============================
  // TABLES (12)
  // ============================
  {name:'table_simple',category:'table',baseW:50,baseH:26,fingerprint:[0,0,0,0,0,.9,.9,.9,.9,.9,0,0,0,0,0,.8,0,0,0,.8,.8,0,0,0,.8],
   build:(x,y,s,c,m)=>[el('rect',{x,y,width:50*s,height:6*s,rx:2},pc(c,0),0,m),...woodGrain(x,y,50*s,6*s,pc(c,1),m,false),el('rect',{x:x+4*s,y:y+6*s,width:4*s,height:18*s},pc(c,1),Math.PI/2,m),el('rect',{x:x+42*s,y:y+6*s,width:4*s,height:18*s},pc(c,1),Math.PI/2,m)]},
  {name:'table_round',category:'table',baseW:40,baseH:24,fingerprint:[0,.3,.6,.3,0,.4,.7,.3,.7,.4,.6,.3,.2,.3,.6,.3,.6,.9,.6,.3,0,0,.8,0,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x,cy:y,r:20*s},pc(c,0),0,m),...woodGrain(x-20*s,y-5*s,40*s,5*s,pc(c,1),m,false),el('rect',{x:x-2*s,y:y,width:4*s,height:20*s},pc(c,1),0,m)]},
  {name:'desk',category:'table',baseW:55,baseH:32,fingerprint:[0,.3,.3,.3,0,.9,.9,.9,.9,.9,.8,0,.5,0,.8,.8,0,0,0,.8,.8,0,0,0,.8],
   build:(x,y,s,c,m)=>{
     const els=[el('rect',{x,y,width:55*s,height:6*s,rx:2},pc(c,0),0,m),...woodGrain(x,y,55*s,6*s,pc(c,1),m,false)];
     // Drawer
     els.push(el('rect',{x:x+20*s,y:y+6*s,width:15*s,height:10*s,rx:1},pc(c,1),0,m));
     els.push(el('circle',{cx:x+27.5*s,cy:y+11*s,r:1.5*s},pc(c,2||'#888'),0,m));
     // Legs
     els.push(el('rect',{x:x+3*s,y:y+6*s,width:4*s,height:22*s},pc(c,1),Math.PI/2,m));
     els.push(el('rect',{x:x+48*s,y:y+6*s,width:4*s,height:22*s},pc(c,1),Math.PI/2,m));
     return els;
   }},
  {name:'workbench',category:'table',baseW:65,baseH:30,fingerprint:[.3,.3,.3,.3,.3,.9,.9,.9,.9,.9,.3,0,.3,0,.3,.8,0,.5,0,.8,.8,0,0,0,.8],
   build:(x,y,s,c,m)=>[el('rect',{x,y,width:65*s,height:7*s,rx:1},pc(c,0),0,m),...woodGrain(x,y,65*s,7*s,pc(c,1),m,false),el('rect',{x:x+5*s,y:y+7*s,width:5*s,height:20*s},pc(c,1),Math.PI/2,m),el('rect',{x:x+55*s,y:y+7*s,width:5*s,height:20*s},pc(c,1),Math.PI/2,m),el('rect',{x:x+28*s,y:y+7*s,width:5*s,height:18*s},pc(c,1),Math.PI/2,m),
   // Shelf underneath
   el('rect',{x:x+8*s,y:y+18*s,width:50*s,height:3*s},pc(c,1),0,m)]},
  {name:'counter',category:'table',baseW:70,baseH:35,fingerprint:[0,0,0,0,0,.9,.9,.9,.9,.9,.9,.2,.2,.2,.9,.9,.2,.2,.2,.9,.9,.9,.9,.9,.9],
   build:(x,y,s,c,m)=>[el('rect',{x,y,width:70*s,height:6*s,rx:1},pc(c,0),-Math.PI/6,m),el('rect',{x,y:y+6*s,width:70*s,height:28*s},pc(c,1),0,m),...woodGrain(x,y+6*s,70*s,28*s,pc(c,0),m)]},

  // ============================
  // CONTAINERS (18)
  // ============================
  {name:'chest_wooden',category:'container',baseW:28,baseH:20,fingerprint:[.9,.9,.9,.9,.9,.9,.3,.5,.3,.9,.9,.9,.9,.9,.9,.8,.1,.1,.1,.8,.8,.8,.8,.8,.8],
   build:(x,y,s,c,m)=>[el('rect',{x,y:y+4*s,width:28*s,height:14*s,rx:2},pc(c,0),Math.PI/4,m),...woodGrain(x,y+4*s,28*s,14*s,pc(c,1),m),el('rect',{x:x-1*s,y,width:30*s,height:5*s,rx:2},pc(c,1),-Math.PI/4,m),
   // Iron bands
   el('rect',{x,y:y+8*s,width:28*s,height:2*s,opacity:0.4},'#555555',0,m),el('rect',{x,y:y+14*s,width:28*s,height:2*s,opacity:0.4},'#555555',0,m),
   // Lock
   el('rect',{x:x+10*s,y:y+9*s,width:8*s,height:6*s,rx:1,opacity:0.5},'#555555',0,m),el('circle',{cx:x+14*s,cy:y+12*s,r:2.5*s},'#FFD700',0,m),el('circle',{cx:x+14*s,cy:y+12*s,r:1.2*s},'#AA8800',0,m),
   ...addRust(x+20*s,y+10*s,m)]},
  {name:'barrel',category:'container',baseW:22,baseH:30,fingerprint:[0,.5,.8,.5,0,.3,.8,.2,.8,.3,.4,.9,.1,.9,.4,.3,.8,.2,.8,.3,0,.5,.8,.5,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+11*s,cy:y+15*s,r:11*s,opacity:0.9},pc(c,0),0,m),...woodGrain(x,y,22*s,30*s,'#2A1808',m),el('rect',{x:x+1*s,y:y+5*s,width:20*s,height:2.5*s,opacity:0.5},pc(c,1),0,m),el('rect',{x:x+1*s,y:y+22*s,width:20*s,height:2.5*s,opacity:0.5},pc(c,1),0,m),
   // Top ellipse
   el('circle',{cx:x+11*s,cy:y+2*s,r:10*s,opacity:0.25},pc(c,1),-.3,m),
   ...addRust(x+15*s,y+12*s,m)]},
  {name:'crate',category:'container',baseW:22,baseH:22,fingerprint:[.9,.9,.9,.9,.9,.9,.2,.2,.2,.9,.9,.2,.5,.2,.9,.9,.2,.2,.2,.9,.9,.9,.9,.9,.9],
   build:(x,y,s,c,m)=>[el('rect',{x,y,width:22*s,height:22*s,rx:1},pc(c,0),0,m),...woodGrain(x,y,22*s,22*s,pc(c,1),m),el('rect',{x:x+11*s-0.5,y,width:1,height:22*s,opacity:0.15},'#000000',0,m),el('rect',{x,y:y+11*s-0.5,width:22*s,height:1,opacity:0.15},'#000000',0,m)]},
  {name:'pot_clay',category:'container',baseW:14,baseH:16,fingerprint:[0,.6,.6,.6,0,.3,.7,.1,.7,.3,.5,.8,.1,.8,.5,.3,.7,.1,.7,.3,0,.5,.5,.5,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+7*s,cy:y+8*s,r:7*s},pc(c,0),0,m),el('rect',{x:x+2*s,y,width:10*s,height:3*s,rx:1},pc(c,1),0,m)]},
  {name:'sack',category:'container',baseW:16,baseH:18,fingerprint:[0,.3,.5,.3,0,.2,.5,.2,.5,.2,.4,.6,.1,.6,.4,.3,.5,.1,.5,.3,0,.3,.3,.3,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+8*s,cy:y+10*s,r:8*s},pc(c,0),Math.PI/4,m),...fabricTexture(x,y,16*s,18*s,m),el('rect',{x:x+5*s,y:y-2*s,width:6*s,height:4*s,rx:1},pc(c,1),0,m)]},
  {name:'basket',category:'container',baseW:18,baseH:14,fingerprint:[.6,.3,.3,.3,.6,.7,.4,.4,.4,.7,.8,.3,.3,.3,.8,.7,.3,.3,.3,.7,0,.5,.5,.5,0],
   build:(x,y,s,c,m)=>[el('rect',{x,y,width:18*s,height:14*s,rx:3},pc(c,0),0,m),...fabricTexture(x,y,18*s,14*s,m)]},
  {name:'jar',category:'container',baseW:10,baseH:14,fingerprint:[0,0,.5,0,0,0,.5,.3,.5,0,0,.6,.2,.6,0,0,.5,.2,.5,0,0,.4,.4,.4,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+5*s,cy:y+8*s,r:5*s},pc(c,0),0,m),el('rect',{x:x+2*s,y,width:6*s,height:3*s,rx:1},pc(c,1),0,m)]},
  {name:'urn',category:'container',baseW:12,baseH:20,fingerprint:[0,.4,.6,.4,0,0,.6,.3,.6,0,.3,.7,.2,.7,.3,.2,.6,.2,.6,.2,0,.4,.5,.4,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+6*s,cy:y+12*s,r:6*s},pc(c,0),0,m),el('rect',{x:x+3*s,y:y+2*s,width:6*s,height:4*s,rx:1},pc(c,0),-Math.PI/4,m),el('rect',{x:x+4*s,y,width:4*s,height:3*s,rx:1},pc(c,1),0,m),el('rect',{x:x+2*s,y:y+18*s,width:8*s,height:3*s,rx:1},pc(c,0),Math.PI/4,m)]},
  {name:'wine_rack',category:'container',baseW:30,baseH:40,fingerprint:[.9,.9,.9,.9,.9,.9,.5,.5,.5,.9,.9,.9,.9,.9,.9,.9,.5,.5,.5,.9,.9,.9,.9,.9,.9],
   build:(x,y,s,c,m)=>{
     const els=[el('rect',{x,y,width:30*s,height:40*s,rx:1},pc(c,0),0,m),...woodGrain(x,y,30*s,40*s,pc(c,1),m)];
     for(let row=0;row<3;row++) for(let col=0;col<3;col++){
       const bx=x+3*s+col*9*s,by=y+3*s+row*13*s;
       els.push(el('circle',{cx:bx+4*s,cy:by+5*s,r:3.5*s,opacity:0.6},'#3A1008',0,m));
     }
     return els;
   }},

  // ============================
  // LIGHTING (10)
  // ============================
  {name:'torch_wall',category:'light',baseW:10,baseH:24,fingerprint:[0,0,.6,0,0,0,.3,.8,.3,0,0,0,.9,0,0,0,0,.9,0,0,0,0,.7,0,0],
   build:(x,y,s,c,m)=>[
     el('rect',{x:x-1*s,y:y+10*s,width:3*s,height:12*s},'#444444',0,m),
     el('rect',{x:x-4*s,y:y+8*s,width:9*s,height:3*s,rx:1},'#555555',0,m),
     el('circle',{cx:x,cy:y+2*s,r:12*s,opacity:0.06},'#FF6600',0,m),
     el('circle',{cx:x,cy:y+4*s,r:8*s,opacity:0.15},'#FF6600',0,m),
     el('circle',{cx:x,cy:y+3*s,r:5*s,opacity:0.3},'#FF8800',0,m),
     el('circle',{cx:x,cy:y+1*s,r:3*s,opacity:0.5},'#FFCC00',0,m),
     el('circle',{cx:x,cy:y-1*s,r:1.5*s,opacity:0.4},'#FFFFAA',0,m),
   ]},
  {name:'chandelier',category:'light',baseW:50,baseH:35,fingerprint:[0,0,.5,0,0,.3,.5,.3,.5,.3,.6,.2,.3,.2,.6,.8,.1,0,.1,.8,.4,0,0,0,.4],
   build:(x,y,s,c,m)=>{
     const els:LayerElement[]=[el('rect',{x:x+23*s,y,width:4*s,height:10*s},'#555555',0,m)];
     // Arms
     for(const side of [-1,0,1]){
       const ax=x+25*s+side*18*s;
       els.push(el('rect',{x:x+25*s,y:y+10*s,width:Math.abs(side)*18*s||2,height:2*s},'#666666',0,m));
       els.push(el('rect',{x:ax-1*s,y:y+8*s,width:3*s,height:6*s,rx:1},'#FFFFF0',0,m));
       els.push(el('circle',{cx:ax,cy:y+6*s,r:3*s,opacity:0.4},'#FFAA00',0,m));
     }
     return els;
   }},
  {name:'candle',category:'light',baseW:6,baseH:12,fingerprint:[0,0,.5,0,0,0,0,.8,0,0,0,0,.9,0,0,0,0,.9,0,0,0,.3,.6,.3,0],
   build:(x,y,s,c,m)=>[el('rect',{x:x-1.5*s,y:y+3*s,width:3*s,height:8*s,rx:1},'#FFFFF0',0,m),el('circle',{cx:x,cy:y+1*s,r:2.5*s,opacity:0.4},'#FFAA00',0,m),el('circle',{cx:x,cy:y,r:1.5*s,opacity:0.5},'#FFCC00',0,m)]},
  {name:'lantern',category:'light',baseW:10,baseH:16,fingerprint:[0,0,.5,0,0,0,.7,.3,.7,0,.5,.8,.2,.8,.5,0,.7,.3,.7,0,0,.5,.5,.5,0],
   build:(x,y,s,c,m)=>[el('rect',{x:x+3*s,y,width:4*s,height:3*s},'#555555',0,m),el('rect',{x:x+1*s,y:y+3*s,width:8*s,height:10*s,rx:1},'#555555',0,m),el('rect',{x:x+2*s,y:y+4*s,width:6*s,height:8*s,rx:1,opacity:0.3},'#FFAA00',0,m),el('rect',{x:x+2*s,y:y+13*s,width:6*s,height:2*s},'#555555',0,m)]},
  {name:'fireplace',category:'light',baseW:50,baseH:45,fingerprint:[.9,.9,.9,.9,.9,.9,.3,.5,.3,.9,.9,.2,.7,.2,.9,.9,.4,.8,.4,.9,.9,.9,.9,.9,.9],
   build:(x,y,s,c,m)=>[el('rect',{x,y,width:50*s,height:45*s,rx:2},pc(c,0),0,m),...stoneTexture(x,y,50*s,45*s,c,m),el('rect',{x:x+8*s,y:y+12*s,width:34*s,height:30*s},'#0A0A0A',0,m),el('circle',{cx:x+25*s,cy:y+32*s,r:10*s,opacity:0.3},'#FF6600',0,m),el('circle',{cx:x+25*s,cy:y+30*s,r:6*s,opacity:0.5},'#FFAA00',0,m),
   // Mantle
   el('rect',{x:x-2*s,y:y-3*s,width:54*s,height:5*s,rx:2},pc(c,1),-Math.PI/4,m)]},
  {name:'campfire',category:'light',baseW:24,baseH:18,fingerprint:[0,0,.5,0,0,0,.3,.7,.3,0,.3,.5,.8,.5,.3,.4,.6,.3,.6,.4,0,.3,.3,.3,0],
   build:(x,y,s,c,m)=>{
     const els:LayerElement[]=[];
     // Stones
     for(let i=0;i<6;i++){const a=i*Math.PI/3;els.push(el('circle',{cx:x+12*s+Math.cos(a)*10*s,cy:y+10*s+Math.sin(a)*6*s,r:3*s,opacity:0.7},'#555555',0,m));}
     // Logs
     els.push(el('rect',{x:x+4*s,y:y+8*s,width:16*s,height:3*s,rx:1},'#3A2010',Math.PI/8,m));
     els.push(el('rect',{x:x+6*s,y:y+6*s,width:14*s,height:3*s,rx:1},'#4A3020',-Math.PI/8,m));
     // Fire
     els.push(el('circle',{cx:x+12*s,cy:y+4*s,r:8*s,opacity:0.2},'#FF6600',0,m));
     els.push(el('circle',{cx:x+12*s,cy:y+2*s,r:5*s,opacity:0.4},'#FF8800',0,m));
     els.push(el('circle',{cx:x+12*s,cy:y,r:3*s,opacity:0.5},'#FFCC00',0,m));
     return els;
   }},

  // ============================
  // STRUCTURE (20)
  // ============================
  {name:'pillar_stone',category:'structure',baseW:14,baseH:70,fingerprint:[.7,.9,.9,.9,.7,.3,.9,.2,.9,.3,.3,.9,.2,.9,.3,.3,.9,.2,.9,.3,.7,.9,.9,.9,.7],
   build:(x,y,s,c,m)=>[el('rect',{x:x-3*s,y:y-5*s,width:20*s,height:8*s,rx:2},pc(c,1),-Math.PI/4,m),el('rect',{x,y:y+3*s,width:14*s,height:60*s},pc(c,0),0,m),...stoneTexture(x,y+3*s,14*s,60*s,c,m),el('rect',{x:x-2*s,y:y+62*s,width:18*s,height:6*s,rx:1},pc(c,1),Math.PI/4,m)]},
  {name:'door_wooden',category:'structure',baseW:30,baseH:50,fingerprint:[.9,.9,.9,.9,.9,.9,.1,.1,.1,.9,.9,.1,.1,.1,.9,.9,.1,.3,.1,.9,.9,.9,.9,.9,.9],
   build:(x,y,s,c,m)=>[el('rect',{x,y,width:30*s,height:50*s,rx:1},'#0A0A0A',0,m),el('rect',{x:x-2*s,y:y-2*s,width:34*s,height:4*s},pc(c,0),-Math.PI/4,m),el('rect',{x:x-2*s,y,width:4*s,height:50*s},pc(c,0),-Math.PI/2,m),el('rect',{x:x+28*s,y,width:4*s,height:50*s},pc(c,0),Math.PI/2,m),...woodGrain(x+2*s,y+2*s,26*s,46*s,pc(c,1),m),el('circle',{cx:x+22*s,cy:y+28*s,r:2*s},'#FFD700',0,m)]},
  {name:'door_iron',category:'structure',baseW:30,baseH:50,fingerprint:[.9,.9,.9,.9,.9,.9,.3,.3,.3,.9,.9,.3,.3,.3,.9,.9,.3,.5,.3,.9,.9,.9,.9,.9,.9],
   build:(x,y,s,c,m)=>[el('rect',{x,y,width:30*s,height:50*s,rx:1},'#333333',0,m),...metalTexture(x,y,30*s,50*s,m),el('rect',{x:x+3*s,y:y+3*s,width:10*s,height:20*s,rx:1,opacity:0.15},'#000000',0,m),el('rect',{x:x+17*s,y:y+3*s,width:10*s,height:20*s,rx:1,opacity:0.15},'#000000',0,m),el('circle',{cx:x+22*s,cy:y+30*s,r:3*s},'#888888',0,m),el('rect',{x,y:y+15*s,width:30*s,height:3*s,opacity:0.3},'#444444',0,m),el('rect',{x,y:y+35*s,width:30*s,height:3*s,opacity:0.3},'#444444',0,m)]},
  {name:'arch_stone',category:'structure',baseW:40,baseH:55,fingerprint:[0,.3,.8,.3,0,.5,.8,.1,.8,.5,.9,.1,.1,.1,.9,.9,.1,.1,.1,.9,.9,0,0,0,.9],
   build:(x,y,s,c,m)=>[el('rect',{x:x+2*s,y:y+20*s,width:36*s,height:35*s},'#050508',0,m),el('path',{d:`M ${x+2*s} ${y+20*s} A ${18*s} ${18*s} 0 0 1 ${x+38*s} ${y+20*s}`,strokeWidth:4,fill:'none'},pc(c,0),-Math.PI/4,m),el('rect',{x:x+18*s,y:y,width:4*s,height:4*s,rx:1},pc(c,1),-Math.PI/3,m)]},
  {name:'window_gothic',category:'structure',baseW:24,baseH:36,fingerprint:[.9,.9,.9,.9,.9,.9,.2,.5,.2,.9,.9,.5,.2,.5,.9,.9,.2,.5,.2,.9,.9,.9,.9,.9,.9],
   build:(x,y,s,c,m)=>[el('rect',{x,y,width:24*s,height:36*s,rx:2},'#080818',0,m),el('rect',{x:x+2*s,y:y+2*s,width:20*s,height:30*s,opacity:0.15},'#3355AA',0,m),el('rect',{x:x+11*s,y,width:2*s,height:36*s},'#3A3A4A',0,m),el('rect',{x,y:y+14*s,width:24*s,height:2*s},'#3A3A4A',0,m),el('rect',{x,y:y+24*s,width:24*s,height:2*s},'#3A3A4A',0,m),el('rect',{x:x-2*s,y:y+34*s,width:28*s,height:4*s,rx:1},pc(c,0),0,m)]},
  {name:'stairs_stone',category:'structure',baseW:45,baseH:50,fingerprint:[.9,.9,0,0,0,.3,.9,.9,0,0,0,.3,.9,.9,0,0,0,.3,.9,.9,0,0,0,.3,.9],
   build:(x,y,s,c,m)=>{
     const els:LayerElement[]=[];
     for(let i=0;i<6;i++){
       const sx=x+i*5*s,sy=y+i*8*s,sw=40*s-i*5*s;
       els.push(el('rect',{x:sx,y:sy,width:sw,height:7*s,rx:1},pc(c,i%2),-Math.PI/4+i*0.04,m));
     }
     return els;
   }},
  {name:'fence_wooden',category:'structure',baseW:60,baseH:25,fingerprint:[.8,.2,.8,.2,.8,.8,.2,.8,.2,.8,.9,.9,.9,.9,.9,0,0,0,0,0,0,0,0,0,0],
   build:(x,y,s,c,m)=>{
     const els=[el('rect',{x,y:y+10*s,width:60*s,height:3*s,rx:1},pc(c,0),0,m)];
     for(let i=0;i<6;i++) els.push(el('rect',{x:x+i*11*s,y,width:4*s,height:22*s,rx:1},pc(c,i%2),0,m),...woodGrain(x+i*11*s,y,4*s,22*s,pc(c,1),m));
     return els;
   }},
  {name:'wall_shelf',category:'structure',baseW:45,baseH:8,fingerprint:[0,0,0,0,0,.9,.9,.9,.9,.9,.3,0,0,0,.3,0,0,0,0,0,0,0,0,0,0],
   build:(x,y,s,c,m)=>[el('rect',{x,y,width:45*s,height:4*s,rx:1},pc(c,0),0,m),...woodGrain(x,y,45*s,4*s,pc(c,1),m,false),el('rect',{x:x+2*s,y:y+4*s,width:3*s,height:4*s},pc(c,0),Math.PI/4,m),el('rect',{x:x+40*s,y:y+4*s,width:3*s,height:4*s},pc(c,0),Math.PI/4,m)]},
  {name:'bridge_wooden',category:'structure',baseW:70,baseH:15,fingerprint:[0,0,0,0,0,.3,.3,.3,.3,.3,.9,.9,.9,.9,.9,.3,.3,.3,.3,.3,0,0,0,0,0],
   build:(x,y,s,c,m)=>[el('rect',{x,y:y+4*s,width:70*s,height:6*s,rx:1},pc(c,0),0,m),...woodGrain(x,y+4*s,70*s,6*s,pc(c,1),m,false),el('rect',{x,y:y+2*s,width:70*s,height:2*s,rx:1},pc(c,1),0,m)]},
  {name:'ladder',category:'structure',baseW:14,baseH:50,fingerprint:[.8,0,0,0,.8,.9,.9,.9,.9,.9,.8,0,0,0,.8,.9,.9,.9,.9,.9,.8,0,0,0,.8],
   build:(x,y,s,c,m)=>{
     const els=[el('rect',{x,y,width:3*s,height:50*s},pc(c,0),0,m),el('rect',{x:x+11*s,y,width:3*s,height:50*s},pc(c,0),0,m)];
     for(let i=0;i<5;i++) els.push(el('rect',{x:x+3*s,y:y+i*10*s+3*s,width:8*s,height:2*s},pc(c,1),0,m));
     return els;
   }},

  // ============================
  // NATURE (20)
  // ============================
  {name:'tree_oak',category:'nature',baseW:35,baseH:60,fingerprint:[0,.3,.6,.3,0,.3,.6,.5,.6,.3,.2,.5,.4,.5,.2,0,0,.9,0,0,0,0,.8,0,0],
   build:(x,y,s,c,m)=>[el('rect',{x:x+13*s,y:y+25*s,width:9*s,height:30*s},'#5A3A1A',Math.PI/2,m),...woodGrain(x+13*s,y+25*s,9*s,30*s,'#3A2008',m),el('circle',{cx:x+17*s,cy:y+15*s,r:18*s},pc(c,0),-Math.PI/4,m),el('circle',{cx:x+10*s,cy:y+20*s,r:12*s,opacity:0.6},pc(c,1),-Math.PI/3,m),el('circle',{cx:x+24*s,cy:y+18*s,r:10*s,opacity:0.5},pc(c,0),-Math.PI/5,m)]},
  {name:'tree_pine',category:'nature',baseW:25,baseH:55,fingerprint:[0,0,.5,0,0,0,.3,.7,.3,0,.2,.6,.4,.6,.2,.4,.8,.3,.8,.4,0,0,.9,0,0],
   build:(x,y,s,c,m)=>[el('rect',{x:x+10*s,y:y+30*s,width:5*s,height:22*s},'#4A2A0A',0,m),el('polygon',{points:`${x+12.5*s},${y} ${x+25*s},${y+20*s} ${x},${y+20*s}`},pc(c,0),-Math.PI/4,m),el('polygon',{points:`${x+12.5*s},${y+10*s} ${x+27*s},${y+32*s} ${x-2*s},${y+32*s}`},pc(c,1),-Math.PI/5,m)]},
  {name:'bush',category:'nature',baseW:24,baseH:16,fingerprint:[0,.3,.5,.3,0,.4,.6,.5,.6,.4,.5,.7,.4,.7,.5,.3,.5,.3,.5,.3,0,.2,.2,.2,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+12*s,cy:y+10*s,r:12*s},pc(c,0),0,m),el('circle',{cx:x+6*s,cy:y+8*s,r:8*s,opacity:0.6},pc(c,1),-.3,m),el('circle',{cx:x+18*s,cy:y+9*s,r:7*s,opacity:0.5},pc(c,0),-.2,m)]},
  {name:'rock_large',category:'nature',baseW:28,baseH:20,fingerprint:[0,.2,.4,.3,0,.3,.5,.3,.5,.3,.5,.4,.2,.4,.5,.4,.5,.3,.5,.4,0,.3,.4,.3,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+14*s,cy:y+10*s,r:14*s,opacity:0.9},pc(c,0),Math.PI/6,m),el('circle',{cx:x+8*s,cy:y+7*s,r:6*s,opacity:0.3},pc(c,1),-Math.PI/4,m),...addMoss(x+20*s,y+5*s,m)]},
  {name:'rock_small',category:'nature',baseW:12,baseH:8,fingerprint:[0,.2,.3,.2,0,.3,.4,.3,.4,.3,.4,.3,.2,.3,.4,.2,.3,.3,.3,.2,0,0,0,0,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+6*s,cy:y+4*s,r:6*s},pc(c,0),Math.PI/4,m)]},
  {name:'flower',category:'nature',baseW:8,baseH:12,fingerprint:[0,.3,.5,.3,0,.3,.5,.3,.5,.3,0,.3,.5,.3,0,0,0,.7,0,0,0,0,.6,0,0],
   build:(x,y,s,c,m)=>{
     const els=[el('rect',{x:x+3*s,y:y+5*s,width:2*s,height:7*s},'#2A5A2A',0,m)];
     for(let i=0;i<5;i++){const a=i*Math.PI*2/5;els.push(el('circle',{cx:x+4*s+Math.cos(a)*3*s,cy:y+3*s+Math.sin(a)*3*s,r:2*s},pc(c,i),0,m));}
     els.push(el('circle',{cx:x+4*s,cy:y+3*s,r:1.5*s},'#FFDD00',0,m));
     return els;
   }},
  {name:'mushroom',category:'nature',baseW:10,baseH:12,fingerprint:[0,.4,.7,.4,0,.5,.7,.4,.7,.5,.3,.5,.3,.5,.3,0,0,.8,0,0,0,.3,.6,.3,0],
   build:(x,y,s,c,m)=>[el('rect',{x:x+3*s,y:y+5*s,width:4*s,height:7*s,rx:1},'#DDDDCC',0,m),el('circle',{cx:x+5*s,cy:y+3*s,r:5*s},pc(c,0),-.3,m),el('circle',{cx:x+3*s,cy:y+2*s,r:1*s,opacity:0.4},'#FFFFFF',0,m)]},
  {name:'vine',category:'nature',baseW:8,baseH:40,fingerprint:[.4,0,0,0,0,0,.5,0,0,0,0,0,.4,0,0,0,0,0,.5,0,0,0,0,0,.4],
   build:(x,y,s,c,m)=>{
     const els:LayerElement[]=[];
     for(let i=0;i<5;i++){
       const vx=x+Math.sin(i*1.2)*4*s,vy=y+i*8*s;
       els.push(el('rect',{x:vx,y:vy,width:2*s,height:8*s,rx:1},pc(c,0),Math.sin(i)*0.3,m));
       if(R()>0.5) els.push(el('circle',{cx:vx+R()*4*s,cy:vy+4*s,r:2*s,opacity:0.5},pc(c,1),0,m));
     }
     return els;
   }},
  {name:'well',category:'nature',baseW:30,baseH:28,fingerprint:[0,.3,.8,.3,0,.5,.8,.2,.8,.5,.7,.4,.1,.4,.7,.5,.7,.2,.7,.5,0,.5,.7,.5,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+15*s,cy:y+16*s,r:15*s},pc(c,0),0,m),...stoneTexture(x,y+4*s,30*s,20*s,c,m),el('circle',{cx:x+15*s,cy:y+12*s,r:10*s,opacity:0.7},'#0A1A2A',Math.PI/2,m),el('rect',{x:x+13*s,y:y-5*s,width:4*s,height:22*s},'#5A3A1A',0,m),el('rect',{x:x+5*s,y:y-5*s,width:20*s,height:3*s,rx:1},'#5A3A1A',0,m)]},
  {name:'fountain',category:'nature',baseW:40,baseH:38,fingerprint:[0,0,.5,0,0,0,.3,.7,.3,0,.3,.6,.3,.6,.3,.5,.7,.2,.7,.5,.3,.5,.5,.5,.3],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+20*s,cy:y+22*s,r:20*s},pc(c,0),0,m),...stoneTexture(x,y+10*s,40*s,20*s,c,m),el('circle',{cx:x+20*s,cy:y+18*s,r:14*s,opacity:0.5},'#1A3A5A',Math.PI/2,m),el('rect',{x:x+18*s,y:y,width:4*s,height:16*s},pc(c,1),0,m),el('circle',{cx:x+20*s,cy:y+2*s,r:3*s},pc(c,1),0,m)]},
  {name:'grass_patch',category:'nature',baseW:20,baseH:6,fingerprint:[.3,.3,.3,.3,.3,.4,.5,.4,.5,.4,.5,.4,.5,.4,.5,0,0,0,0,0,0,0,0,0,0],
   build:(x,y,s,c,m)=>{
     const els:LayerElement[]=[];
     for(let i=0;i<8;i++) els.push(el('rect',{x:x+i*2.5*s,y:y-R()*4*s,width:1*s,height:4+R()*4,rx:0.5,opacity:0.5+R()*0.3},pc(c,i%2),-.2+R()*0.4,m));
     return els;
   }},
  {name:'water_puddle',category:'nature',baseW:25,baseH:8,fingerprint:[0,.2,.3,.2,0,.3,.4,.3,.4,.3,.4,.3,.2,.3,.4,.2,.3,.3,.3,.2,0,0,0,0,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+12*s,cy:y+4*s,r:12*s,opacity:0.3},'#1A3A5A',Math.PI/2,m),el('circle',{cx:x+8*s,cy:y+3*s,r:6*s,opacity:0.1},'#3A5A7A',Math.PI/2,m)]},

  // ============================
  // DECORATION (20)
  // ============================
  {name:'painting',category:'decoration',baseW:20,baseH:16,fingerprint:[.9,.9,.9,.9,.9,.9,.3,.3,.3,.9,.9,.3,.4,.3,.9,.9,.3,.3,.3,.9,.9,.9,.9,.9,.9],
   build:(x,y,s,c,m)=>[el('rect',{x,y,width:20*s,height:16*s,rx:1},pc(c,0),0,m),el('rect',{x:x+2*s,y:y+2*s,width:16*s,height:12*s},pc(c,1),0,m),el('rect',{x:x+4*s,y:y+8*s,width:12*s,height:4*s,opacity:0.3},pc(c,2||c[0]),0,m)]},
  {name:'banner_wall',category:'decoration',baseW:18,baseH:48,fingerprint:[.8,.8,.8,.8,.8,.8,.2,.2,.2,.8,.7,.2,.3,.2,.7,.6,.2,.2,.2,.6,0,.3,.5,.3,0],
   build:(x,y,s,c,m)=>[el('rect',{x:x-2*s,y:y-2*s,width:22*s,height:3*s,rx:1},'#666666',0,m),el('rect',{x,y,width:18*s,height:42*s,rx:1},pc(c,0),0,m),...fabricTexture(x,y,18*s,42*s,m),el('polygon',{points:`${x},${y+42*s} ${x+18*s},${y+42*s} ${x+9*s},${y+52*s}`},pc(c,0),0,m),el('circle',{cx:x+9*s,cy:y+20*s,r:5*s,opacity:0.3},pc(c,1),0,m)]},
  {name:'shield_wall',category:'decoration',baseW:16,baseH:20,fingerprint:[.3,.7,.9,.7,.3,.7,.3,.4,.3,.7,.8,.2,.5,.2,.8,.6,.3,.3,.3,.6,0,.3,.7,.3,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+8*s,cy:y+9*s,r:9*s},pc(c,0),0,m),...metalTexture(x,y,16*s,18*s,m),el('rect',{x:x+6*s,y:y+3*s,width:4*s,height:12*s,rx:1,opacity:0.3},pc(c,1),0,m),el('rect',{x:x+2*s,y:y+7*s,width:12*s,height:4*s,rx:1,opacity:0.3},pc(c,1),0,m)]},
  {name:'bookshelf',category:'decoration',baseW:40,baseH:50,fingerprint:[.9,.9,.9,.9,.9,.9,.5,.5,.5,.9,.9,.9,.9,.9,.9,.9,.5,.5,.5,.9,.9,.9,.9,.9,.9],
   build:(x,y,s,c,m)=>{
     const els=[el('rect',{x,y,width:40*s,height:50*s,rx:1},pc(c,0),0,m),...woodGrain(x,y,40*s,50*s,pc(c,1),m)];
     for(let sh=0;sh<4;sh++){
       els.push(el('rect',{x:x+2*s,y:y+sh*12*s+10*s,width:36*s,height:2*s},pc(c,1),0,m));
       for(let b=0;b<4+Math.floor(R()*2);b++){
         const bw=5+R()*4,bh=8+R()*2;
         els.push(el('rect',{x:x+3*s+b*(bw+1)*s,y:y+sh*12*s+10*s-bh*s,width:bw*s,height:bh*s,rx:1},pc(c,Math.floor(R()*3)),-Math.PI/4,m));
       }
     }
     return els;
   }},
  {name:'statue',category:'decoration',baseW:16,baseH:45,fingerprint:[0,0,.6,0,0,0,.4,.5,.4,0,0,.3,.8,.3,0,.3,.2,.8,.2,.3,0,.5,.3,.5,0],
   build:(x,y,s,c,m)=>[el('rect',{x:x+4*s,y:y+35*s,width:8*s,height:10*s,rx:1},pc(c,0),Math.PI/4,m),...stoneTexture(x+4*s,y+35*s,8*s,10*s,c,m),el('rect',{x:x+5*s,y:y+12*s,width:6*s,height:23*s},pc(c,0),0,m),el('circle',{cx:x+8*s,cy:y+8*s,r:6*s},pc(c,0),-Math.PI/4,m),...addMoss(x+3*s,y+40*s,m)]},
  {name:'mirror',category:'decoration',baseW:16,baseH:22,fingerprint:[0,.5,.8,.5,0,.5,.8,.2,.8,.5,.7,.3,.1,.3,.7,.5,.8,.2,.8,.5,0,.5,.8,.5,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+8*s,cy:y+11*s,r:9*s},pc(c,0),0,m),el('circle',{cx:x+8*s,cy:y+11*s,r:7*s,opacity:0.3},'#4466AA',0,m),el('circle',{cx:x+5*s,cy:y+8*s,r:2*s,opacity:0.15},'#FFFFFF',0,m)]},
  {name:'clock',category:'decoration',baseW:14,baseH:14,fingerprint:[0,.4,.7,.4,0,.4,.6,.2,.6,.4,.7,.2,.5,.2,.7,.4,.6,.2,.6,.4,0,.4,.7,.4,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+7*s,cy:y+7*s,r:7*s},pc(c,0),0,m),el('circle',{cx:x+7*s,cy:y+7*s,r:6*s,opacity:0.5},'#FFFFF0',0,m),el('rect',{x:x+6.5*s,y:y+3*s,width:1*s,height:4.5*s},'#333333',0,m),el('rect',{x:x+7*s,y:y+5*s,width:3.5*s,height:1*s},'#333333',0,m)]},
  {name:'trophy_head',category:'decoration',baseW:18,baseH:14,fingerprint:[.3,.3,.5,.3,.3,.5,.3,.6,.3,.5,.3,.5,.4,.5,.3,.3,.3,.4,.3,.3,0,0,.3,0,0],
   build:(x,y,s,c,m)=>[el('rect',{x:x+6*s,y:y+8*s,width:6*s,height:6*s,rx:1},pc(c,0),0,m),el('circle',{cx:x+9*s,cy:y+5*s,r:5*s},pc(c,1),-.3,m),el('rect',{x:x-1*s,y:y+2*s,width:5*s,height:2*s,rx:1},pc(c,1),-.4,m),el('rect',{x:x+14*s,y:y+2*s,width:5*s,height:2*s,rx:1},pc(c,1),.4,m)]},
  {name:'rug_ornate',category:'decoration',baseW:60,baseH:20,fingerprint:[.3,.5,.5,.5,.3,.5,.3,.3,.3,.5,.5,.3,.4,.3,.5,.5,.3,.3,.3,.5,.3,.5,.5,.5,.3],
   build:(x,y,s,c,m)=>[el('rect',{x,y,width:60*s,height:20*s,rx:2},pc(c,0),Math.PI/2,m),...fabricTexture(x,y,60*s,20*s,m),el('rect',{x:x+4*s,y:y+3*s,width:52*s,height:14*s,rx:1,opacity:0.2},pc(c,1),Math.PI/2,m),el('rect',{x:x+8*s,y:y+6*s,width:44*s,height:8*s,rx:1,opacity:0.15},pc(c,2||c[0]),Math.PI/2,m)]},
  {name:'cobweb_corner',category:'decoration',baseW:20,baseH:20,fingerprint:[.4,.2,0,0,0,.2,.3,.2,0,0,0,.2,.3,.2,0,0,0,.2,.3,.2,0,0,0,.2,.3],
   build:(x,y,s,c,m)=>addCobweb(x,y,20*s,m)},

  // ============================
  // UTILITY/CRAFT (18)
  // ============================
  {name:'anvil',category:'utility',baseW:24,baseH:20,fingerprint:[.7,.9,.9,.9,.7,0,.3,.9,.3,0,0,0,.9,0,0,0,.5,.9,.5,0,.5,.8,.8,.8,.5],
   build:(x,y,s,c,m)=>[el('rect',{x:x+2*s,y,width:20*s,height:5*s,rx:1},'#555555',-Math.PI/4,m),...metalTexture(x+2*s,y,20*s,5*s,m),el('rect',{x:x+8*s,y:y+5*s,width:8*s,height:8*s},'#444444',0,m),el('rect',{x:x+4*s,y:y+13*s,width:16*s,height:6*s,rx:1},'#555555',Math.PI/4,m)]},
  {name:'cauldron',category:'utility',baseW:26,baseH:22,fingerprint:[.5,.3,.3,.3,.5,.7,.5,.2,.5,.7,.8,.3,.1,.3,.8,.7,.5,.2,.5,.7,0,.5,.7,.5,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+13*s,cy:y+12*s,r:13*s,opacity:0.9},'#333333',0,m),...metalTexture(x,y,26*s,22*s,m),el('circle',{cx:x+13*s,cy:y+8*s,r:9*s,opacity:0.4},'#2A5A2A',Math.PI/2,m),el('rect',{x:x-2*s,y:y+2*s,width:4*s,height:3*s,rx:1},'#444444',0,m),el('rect',{x:x+24*s,y:y+2*s,width:4*s,height:3*s,rx:1},'#444444',0,m)]},
  {name:'cage_iron',category:'utility',baseW:22,baseH:28,fingerprint:[.9,.9,.9,.9,.9,.8,.1,.8,.1,.8,.8,.1,.8,.1,.8,.8,.1,.8,.1,.8,.9,.9,.9,.9,.9],
   build:(x,y,s,c,m)=>{
     const els=[el('rect',{x,y,width:22*s,height:2*s},'#555555',0,m),el('rect',{x,y:y+26*s,width:22*s,height:2*s},'#555555',0,m)];
     for(let i=0;i<5;i++) els.push(el('rect',{x:x+i*5*s+1*s,y:y+2*s,width:1.5*s,height:24*s},'#666666',0,m));
     return els;
   }},
  {name:'rope_coil',category:'utility',baseW:12,baseH:12,fingerprint:[0,.3,.5,.3,0,.3,.5,.2,.5,.3,.5,.2,.2,.2,.5,.3,.5,.2,.5,.3,0,.3,.5,.3,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+6*s,cy:y+6*s,r:6*s},'#8B7355',0,m),el('circle',{cx:x+6*s,cy:y+6*s,r:3*s,opacity:0.4},'#6A5A40',0,m)]},
  {name:'weapon_rack',category:'utility',baseW:30,baseH:40,fingerprint:[.9,.9,.9,.9,.9,.3,.8,.3,.8,.3,.3,.8,.3,.8,.3,.3,.8,.3,.8,.3,.9,.9,.9,.9,.9],
   build:(x,y,s,c,m)=>[el('rect',{x,y,width:30*s,height:40*s,rx:1},pc(c,0),0,m),...woodGrain(x,y,30*s,40*s,pc(c,1),m),
   // Weapons
   el('rect',{x:x+5*s,y:y+3*s,width:2*s,height:34*s},'#888888',0,m),el('rect',{x:x+14*s,y:y+5*s,width:2*s,height:30*s},'#AAAAAA',0,m),el('rect',{x:x+23*s,y:y+4*s,width:2*s,height:32*s},'#999999',0,m)]},
  {name:'bucket',category:'utility',baseW:12,baseH:14,fingerprint:[0,.5,.5,.5,0,.3,.6,.2,.6,.3,.4,.7,.1,.7,.4,.3,.6,.2,.6,.3,0,.4,.5,.4,0],
   build:(x,y,s,c,m)=>[el('rect',{x:x+1*s,y:y+2*s,width:10*s,height:12*s,rx:1},pc(c,0),0,m),...woodGrain(x+1*s,y+2*s,10*s,12*s,pc(c,1),m),el('rect',{x:x+1*s,y:y+5*s,width:10*s,height:2*s,opacity:0.3},'#555555',0,m),el('path',{d:`M ${x+3*s} ${y} Q ${x+6*s} ${y-4*s} ${x+9*s} ${y}`,strokeWidth:1.5,fill:'none'},'#555555',0,m)]},
  {name:'sign_wooden',category:'utility',baseW:24,baseH:18,fingerprint:[.9,.9,.9,.9,.9,.9,.3,.3,.3,.9,.9,.9,.9,.9,.9,0,0,.8,0,0,0,0,.8,0,0],
   build:(x,y,s,c,m)=>[el('rect',{x,y,width:24*s,height:14*s,rx:2},pc(c,0),0,m),...woodGrain(x,y,24*s,14*s,pc(c,1),m,false),el('rect',{x:x+10*s,y:y+14*s,width:4*s,height:10*s},pc(c,1),0,m)]},
  {name:'hay_bale',category:'utility',baseW:22,baseH:16,fingerprint:[0,.4,.6,.4,0,.5,.6,.3,.6,.5,.6,.5,.2,.5,.6,.4,.5,.3,.5,.4,0,.3,.4,.3,0],
   build:(x,y,s,c,m)=>[el('rect',{x,y,width:22*s,height:16*s,rx:3},'#C8A858',0,m),el('rect',{x:x+3*s,y:y+4*s,width:16*s,height:2*s,opacity:0.2},'#8A7838',0,m),el('rect',{x:x+3*s,y:y+10*s,width:16*s,height:2*s,opacity:0.2},'#8A7838',0,m)]},

  // ============================
  // FOOD/DRINK (8)
  // ============================
  {name:'plate',category:'food',baseW:10,baseH:4,fingerprint:[0,.4,.6,.4,0,.5,.5,.3,.5,.5,0,.3,.4,.3,0,0,0,0,0,0,0,0,0,0,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+5*s,cy:y+2*s,r:5*s,opacity:0.7},'#CCAA44',0,m),el('circle',{cx:x+5*s,cy:y+2*s,r:3*s,opacity:0.3},'#AA8833',0,m)]},
  {name:'goblet',category:'food',baseW:6,baseH:10,fingerprint:[0,0,.5,0,0,0,.4,.6,.4,0,0,0,.7,0,0,0,0,.8,0,0,0,.3,.5,.3,0],
   build:(x,y,s,c,m)=>[el('rect',{x:x+1*s,y,width:4*s,height:4*s,rx:1},'#888888',0,m),el('rect',{x:x+2*s,y:y+4*s,width:2*s,height:3*s},'#777777',0,m),el('rect',{x:x+0.5*s,y:y+7*s,width:5*s,height:2*s,rx:1},'#888888',0,m),...metalTexture(x,y,6*s,10*s,m)]},
  {name:'food_meat',category:'food',baseW:12,baseH:6,fingerprint:[0,.3,.5,.3,0,.4,.5,.3,.5,.4,.3,.4,.4,.4,.3,0,0,0,0,0,0,0,0,0,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+6*s,cy:y+3*s,r:5*s,opacity:0.8},'#8B4513',0,m),el('circle',{cx:x+4*s,cy:y+2*s,r:2*s,opacity:0.3},'#AA6633',0,m)]},
  {name:'bread_loaf',category:'food',baseW:14,baseH:8,fingerprint:[0,.3,.5,.3,0,.4,.5,.3,.5,.4,.5,.4,.3,.4,.5,0,.2,.3,.2,0,0,0,0,0,0],
   build:(x,y,s,c,m)=>[el('circle',{cx:x+7*s,cy:y+5*s,r:7*s},pc(c,0),0,m),el('rect',{x:x+2*s,y:y+1*s,width:10*s,height:2*s,rx:1,opacity:0.2},'#AA8844',0,m)]},
];

// ============================================================================
// MATCHING — same as shape_dictionary but for expanded library
// ============================================================================

export function matchItem(clusterPattern: number[]): Array<{item:ItemDef;confidence:number}> {
  if(clusterPattern.length!==25) return[];
  return ITEM_LIBRARY.map(item=>{
    let dist=0;
    for(let i=0;i<25;i++){const d=(clusterPattern[i]||0)-item.fingerprint[i];dist+=d*d;}
    return{item,confidence:Math.max(0,1-Math.sqrt(dist/25))};
  }).sort((a,b)=>b.confidence-a.confidence).slice(0,3);
}

export function buildItem(name:string,x:number,y:number,scale:number,colors:string[],mood:ShadingPreset):LayerElement[]{
  const def=ITEM_LIBRARY.find(i=>i.name===name);
  if(!def) return[el('rect',{x,y,width:20*scale,height:20*scale,rx:2},colors[0]||'#888',0,mood)];
  setSeed(Math.floor(x*100+y*77));
  return def.build(x,y,scale,colors,mood);
}

export function getItemsByCategory(cat:string):string[]{
  return ITEM_LIBRARY.filter(i=>i.category===cat).map(i=>i.name);
}

export function getCategories():string[]{
  return[...new Set(ITEM_LIBRARY.map(i=>i.category))];
}

export function getLibrarySize():number{return ITEM_LIBRARY.length;}
