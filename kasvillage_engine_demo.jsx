import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================================
// WEIGHT MATH — the single formula that creates art from puppets
// ============================================================================
// 
// Every joint offset gets multiplied by TWO race-derived factors:
//   amplitude = torsoScale * shoulderWidth  (bigger = wider movements)
//   speed     = 1 / torsoScale              (bigger = slower cycle)
//
// A Golem (torsoScale=1.25, shoulder=1.4):
//   amplitude = 1.75 → huge sweeping arcs
//   speed     = 0.8  → lumbering, slow
//
// A Sprite (torsoScale=0.55, shoulder=0.6):
//   amplitude = 0.33 → tiny twitchy moves
//   speed     = 1.82 → buzzing fast
//
// An Elemental (torsoScale=1.0, shoulder=1.15):
//   amplitude = 1.15 → moderate
//   speed     = 1.0  → normal but with JITTER added (energy flicker)
//
// JITTER formula for energy/elemental types:
//   jitter = sin(t * 47) * 0.3 + sin(t * 73) * 0.2
//   Applied additively to all joints — creates vibrating energy feel
//
// FLIGHT modifier for winged races (Angel, Phoenix, Fae, Sprite, Dragonkin):
//   Shoulder oscillation: sin(t * speed * 6) * amplitude * 0.4
//   Hands trail shoulders by phase offset: sin(t * speed * 6 - 0.5)
//   Center_mass bobs: sin(t * speed * 3) * 4 — hover effect
//
// The FULL formula per joint per frame:
//   finalOffset.x = poseOffset.x * amplitude + jitter_x + flight_x
//   finalOffset.y = poseOffset.y * amplitude + jitter_y + flight_y
//   frameDuration  = baseDuration / speed
// ============================================================================

const RACE_WEIGHTS = {
  human:     { amp: 1.15 * 1.0,   speed: 1/1.0,   jitter: 0,    flight: false },
  cyborg:    { amp: 1.15 * 1.0,   speed: 1/1.0,   jitter: 0.15, flight: false },
  mutant:    { amp: 1.2 * 1.05,   speed: 1/1.05,  jitter: 0.1,  flight: false },
  ethereal:  { amp: 0.95 * 0.9,   speed: 1/0.9,   jitter: 0.3,  flight: true  },
  beast:     { amp: 1.3 * 1.15,   speed: 1/1.15,  jitter: 0,    flight: false },
  elf:       { amp: 1.0 * 0.95,   speed: 1/0.95,  jitter: 0,    flight: false },
  darkelf:   { amp: 1.0 * 0.95,   speed: 1/0.95,  jitter: 0,    flight: false },
  dwarf:     { amp: 1.1 * 0.85,   speed: 1/0.85,  jitter: 0,    flight: false },
  alien:     { amp: 0.9 * 0.88,   speed: 1/0.88,  jitter: 0.2,  flight: false },
  orc:       { amp: 1.25 * 1.1,   speed: 1/1.1,   jitter: 0,    flight: false },
  halfling:  { amp: 0.85 * 0.75,  speed: 1/0.75,  jitter: 0,    flight: false },
  golem:     { amp: 1.4 * 1.25,   speed: 1/1.25,  jitter: 0,    flight: false },
  elemental: { amp: 1.15 * 1.0,   speed: 1/1.0,   jitter: 0.4,  flight: false },
  undead:    { amp: 1.0 * 0.92,   speed: 1/0.92,  jitter: 0.25, flight: false },
  giant:     { amp: 1.35 * 1.2,   speed: 1/1.2,   jitter: 0,    flight: false },
  merfolk:   { amp: 1.05 * 0.95,  speed: 1/0.95,  jitter: 0,    flight: false },
  centaur:   { amp: 1.2 * 1.1,    speed: 1/1.1,   jitter: 0,    flight: false },
  troll:     { amp: 1.3 * 1.15,   speed: 1/1.15,  jitter: 0,    flight: false },
  gnome:     { amp: 0.8 * 0.72,   speed: 1/0.72,  jitter: 0,    flight: false },
  phoenix:   { amp: 1.0 * 0.9,    speed: 1/0.9,   jitter: 0.2,  flight: true  },
  sprite:    { amp: 0.6 * 0.55,   speed: 1/0.55,  jitter: 0.15, flight: true  },
  vampire:   { amp: 1.05 * 0.98,  speed: 1/0.98,  jitter: 0,    flight: false },
  werewolf:  { amp: 1.25 * 1.1,   speed: 1/1.1,   jitter: 0,    flight: false },
  angel:     { amp: 1.1 * 1.0,    speed: 1/1.0,   jitter: 0,    flight: true  },
  dragonkin: { amp: 1.2 * 1.05,   speed: 1/1.05,  jitter: 0,    flight: true  },
  fae:       { amp: 0.75 * 0.7,   speed: 1/0.7,   jitter: 0.1,  flight: true  },
};

// 25 pose offset functions — all 10 joints
const BASE_POSES = {
  idle: (t) => ({ center_mass:{x:0,y:Math.sin(t*2)*1.5}, head:{x:Math.sin(t*0.7)*0.5,y:Math.sin(t*2)*0.3}, shoulder_L:{x:0,y:Math.sin(t*2)*0.5}, shoulder_R:{x:0,y:Math.sin(t*2)*0.5}, hand_L:{x:Math.sin(t*1.1),y:Math.sin(t*2)*0.8}, hand_R:{x:-Math.sin(t*1.3),y:Math.sin(t*2)*0.8} }),
  idle_combat: (t) => { const b=Math.sin(t*4)*2; return { center_mass:{x:0,y:6+b}, head:{x:0,y:2+b*0.3}, shoulder_L:{x:4,y:-8+b*0.5}, shoulder_R:{x:-4,y:-8+b*0.5}, hand_L:{x:10,y:-18+b}, hand_R:{x:-10,y:-16+b}, hip_L:{x:-3,y:4}, hip_R:{x:3,y:4}, foot_L:{x:-6,y:2}, foot_R:{x:6,y:2} }; },
  walk1: () => ({ hip_L:{x:2,y:-8}, hip_R:{x:-2,y:6}, foot_L:{x:10,y:-4}, foot_R:{x:-8,y:2}, shoulder_L:{x:-2,y:3}, shoulder_R:{x:2,y:-3}, hand_L:{x:-8,y:6}, hand_R:{x:8,y:-6}, center_mass:{x:1,y:-2}, head:{x:0.5,y:-1} }),
  walk2: () => ({ hip_L:{x:-2,y:6}, hip_R:{x:2,y:-8}, foot_L:{x:-8,y:2}, foot_R:{x:10,y:-4}, shoulder_L:{x:2,y:-3}, shoulder_R:{x:-2,y:3}, hand_L:{x:8,y:-6}, hand_R:{x:-8,y:6}, center_mass:{x:-1,y:-2}, head:{x:-0.5,y:-1} }),
  run1: () => ({ hip_L:{x:3,y:-14}, hip_R:{x:-3,y:10}, foot_L:{x:16,y:-22}, foot_R:{x:-16,y:6}, shoulder_L:{x:-3,y:5}, shoulder_R:{x:3,y:-6}, hand_L:{x:-14,y:10}, hand_R:{x:14,y:-12}, center_mass:{x:4,y:-6}, head:{x:3,y:-4} }),
  run2: () => ({ hip_L:{x:-3,y:10}, hip_R:{x:3,y:-14}, foot_L:{x:-16,y:6}, foot_R:{x:16,y:-22}, shoulder_L:{x:3,y:-6}, shoulder_R:{x:-3,y:5}, hand_L:{x:14,y:-12}, hand_R:{x:-14,y:10}, center_mass:{x:-4,y:-6}, head:{x:-3,y:-4} }),
  sprint1: () => ({ hip_L:{x:5,y:-18}, hip_R:{x:-5,y:14}, foot_L:{x:22,y:-30}, foot_R:{x:-20,y:8}, shoulder_L:{x:-5,y:8}, shoulder_R:{x:5,y:-10}, hand_L:{x:-18,y:14}, hand_R:{x:18,y:-18}, center_mass:{x:8,y:-10}, head:{x:6,y:-7} }),
  sprint2: () => ({ hip_L:{x:-5,y:14}, hip_R:{x:5,y:-18}, foot_L:{x:-20,y:8}, foot_R:{x:22,y:-30}, shoulder_L:{x:5,y:-10}, shoulder_R:{x:-5,y:8}, hand_L:{x:18,y:-18}, hand_R:{x:-18,y:14}, center_mass:{x:-8,y:-10}, head:{x:-6,y:-7} }),
  jump_squat: () => ({ center_mass:{x:0,y:12}, head:{x:0,y:6}, shoulder_L:{x:2,y:8}, shoulder_R:{x:-2,y:8}, hand_L:{x:6,y:14}, hand_R:{x:-6,y:14}, hip_L:{x:-4,y:10}, hip_R:{x:4,y:10}, foot_L:{x:-6,y:4}, foot_R:{x:6,y:4} }),
  jump: () => ({ center_mass:{x:0,y:-22}, head:{x:0,y:-6}, shoulder_L:{x:-5,y:-10}, shoulder_R:{x:5,y:-10}, hand_L:{x:-10,y:-20}, hand_R:{x:10,y:-20}, hip_L:{x:-3,y:-8}, hip_R:{x:3,y:-8}, foot_L:{x:-5,y:-16}, foot_R:{x:5,y:-16} }),
  jump_apex: () => ({ center_mass:{x:0,y:-28}, head:{x:0,y:-8}, shoulder_L:{x:-8,y:-6}, shoulder_R:{x:8,y:-6}, hand_L:{x:-16,y:-10}, hand_R:{x:16,y:-10}, hip_L:{x:-5,y:-4}, hip_R:{x:5,y:-4}, foot_L:{x:-8,y:-8}, foot_R:{x:8,y:-8} }),
  fall: () => ({ center_mass:{x:0,y:-14}, head:{x:0,y:-5}, shoulder_L:{x:-4,y:-10}, shoulder_R:{x:4,y:-10}, hand_L:{x:-8,y:-18}, hand_R:{x:8,y:-18}, hip_L:{x:-2,y:-3}, hip_R:{x:2,y:-3}, foot_L:{x:-4,y:-10}, foot_R:{x:4,y:-10} }),
  land_light: () => ({ center_mass:{x:0,y:8}, head:{x:0,y:3}, shoulder_L:{x:2,y:4}, shoulder_R:{x:-2,y:4}, hand_L:{x:4,y:6}, hand_R:{x:-4,y:6}, hip_L:{x:-3,y:8}, hip_R:{x:3,y:4}, foot_L:{x:-4,y:2}, foot_R:{x:6,y:0} }),
  land_heavy: () => ({ center_mass:{x:2,y:16}, head:{x:2,y:8}, shoulder_L:{x:4,y:10}, shoulder_R:{x:-6,y:6}, hand_L:{x:8,y:16}, hand_R:{x:-10,y:20}, hip_L:{x:-6,y:14}, hip_R:{x:4,y:12}, foot_L:{x:-10,y:4}, foot_R:{x:8,y:2} }),
  attack_wind: () => ({ center_mass:{x:-4,y:2}, head:{x:-3,y:0}, shoulder_L:{x:4,y:2}, shoulder_R:{x:-10,y:-4}, hand_L:{x:8,y:4}, hand_R:{x:-20,y:-8}, hip_L:{x:-2,y:2}, hip_R:{x:2,y:2}, foot_L:{x:-4,y:0}, foot_R:{x:4,y:0} }),
  attack: () => ({ center_mass:{x:6,y:-2}, head:{x:4,y:-2}, shoulder_L:{x:-2,y:2}, shoulder_R:{x:12,y:-8}, hand_L:{x:-6,y:6}, hand_R:{x:24,y:-18}, hip_L:{x:-2,y:0}, hip_R:{x:4,y:-2}, foot_L:{x:-6,y:0}, foot_R:{x:8,y:-4} }),
  attack_follow: () => ({ center_mass:{x:8,y:0}, head:{x:5,y:0}, shoulder_L:{x:-4,y:4}, shoulder_R:{x:8,y:4}, hand_L:{x:-8,y:8}, hand_R:{x:16,y:6}, hip_L:{x:-2,y:2}, hip_R:{x:4,y:0}, foot_L:{x:-6,y:0}, foot_R:{x:10,y:-2} }),
  block: () => ({ center_mass:{x:-2,y:6}, head:{x:-2,y:4}, shoulder_L:{x:6,y:-6}, shoulder_R:{x:-2,y:0}, hand_L:{x:12,y:-14}, hand_R:{x:-4,y:2}, hip_L:{x:-2,y:6}, hip_R:{x:2,y:4}, foot_L:{x:-4,y:2}, foot_R:{x:6,y:0} }),
  hit_stagger: () => ({ center_mass:{x:-6,y:4}, head:{x:-8,y:-2}, shoulder_L:{x:-4,y:2}, shoulder_R:{x:-6,y:4}, hand_L:{x:-8,y:6}, hand_R:{x:-10,y:8}, hip_L:{x:-2,y:4}, hip_R:{x:0,y:6}, foot_L:{x:-4,y:2}, foot_R:{x:2,y:-2} }),
  crouch: (t) => { const s=Math.sin(t*1.5)*0.5; return { center_mass:{x:s,y:18}, head:{x:s*2,y:10}, shoulder_L:{x:2,y:10}, shoulder_R:{x:-2,y:10}, hand_L:{x:4,y:14}, hand_R:{x:-4,y:14}, hip_L:{x:-6,y:16}, hip_R:{x:6,y:16}, foot_L:{x:-8,y:6}, foot_R:{x:8,y:6} }; },
  dodge_roll: () => ({ center_mass:{x:12,y:10}, head:{x:10,y:14}, shoulder_L:{x:8,y:12}, shoulder_R:{x:6,y:14}, hand_L:{x:4,y:16}, hand_R:{x:8,y:18}, hip_L:{x:6,y:12}, hip_R:{x:10,y:10}, foot_L:{x:4,y:14}, foot_R:{x:8,y:12} }),
  wall_climb: () => ({ center_mass:{x:0,y:-8}, head:{x:0,y:-10}, shoulder_L:{x:-4,y:-16}, shoulder_R:{x:4,y:-4}, hand_L:{x:-6,y:-28}, hand_R:{x:6,y:-10}, hip_L:{x:-2,y:-4}, hip_R:{x:2,y:4}, foot_L:{x:-4,y:-8}, foot_R:{x:4,y:4} }),
  slide: () => ({ center_mass:{x:6,y:20}, head:{x:8,y:14}, shoulder_L:{x:2,y:16}, shoulder_R:{x:-4,y:12}, hand_L:{x:-4,y:20}, hand_R:{x:-8,y:16}, hip_L:{x:4,y:18}, hip_R:{x:-2,y:20}, foot_L:{x:14,y:14}, foot_R:{x:-4,y:18} }),
  wave: (t) => ({ center_mass:{x:0,y:Math.sin(t*2)}, shoulder_R:{x:4,y:-12}, hand_R:{x:10+Math.sin(t*6)*4,y:-24}, head:{x:Math.sin(t*3),y:-1} }),
  sit: (t) => { const b=Math.sin(t*1.5)*0.8; return { center_mass:{x:0,y:22+b}, head:{x:0,y:14+b}, shoulder_L:{x:2,y:14}, shoulder_R:{x:-2,y:14}, hand_L:{x:6,y:20}, hand_R:{x:-6,y:20}, hip_L:{x:-6,y:18}, hip_R:{x:6,y:18}, foot_L:{x:-8,y:10}, foot_R:{x:8,y:10} }; },
};

const POSE_NAMES = Object.keys(BASE_POSES);
const JOINT_NAMES = ["head","shoulder_L","shoulder_R","hip_L","hip_R","hand_L","hand_R","foot_L","foot_R","center_mass"];

// Apply weight formula to raw pose offsets
function applyWeight(offsets, weight, t) {
  const result = {};
  const jx = weight.jitter > 0 ? (Math.sin(t*47)*0.3 + Math.sin(t*73)*0.2) * weight.jitter * 8 : 0;
  const jy = weight.jitter > 0 ? (Math.sin(t*53)*0.25 + Math.sin(t*89)*0.15) * weight.jitter * 6 : 0;

  for (const key of JOINT_NAMES) {
    const o = offsets[key] || { x: 0, y: 0 };
    let fx = o.x * weight.amp + jx;
    let fy = o.y * weight.amp + jy;

    // Flight modifier
    if (weight.flight) {
      if (key === "shoulder_L" || key === "shoulder_R") {
        const sign = key === "shoulder_L" ? -1 : 1;
        fx += Math.sin(t * weight.speed * 6) * weight.amp * 6 * sign;
        fy += Math.sin(t * weight.speed * 6) * weight.amp * 3;
      }
      if (key === "hand_L" || key === "hand_R") {
        const sign = key === "hand_L" ? -1 : 1;
        fx += Math.sin(t * weight.speed * 6 - 0.5) * weight.amp * 8 * sign;
        fy += Math.sin(t * weight.speed * 6 - 0.5) * weight.amp * 4;
      }
      if (key === "center_mass") {
        fy += Math.sin(t * weight.speed * 3) * 4;
      }
    }
    result[key] = { x: fx, y: fy };
  }
  return result;
}

// Angle projection — compress X based on viewing angle
function projectPoint(px, py, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const projected_x = 200 + (px - 200) * Math.abs(cosA) + (px - 200) * Math.abs(Math.sin(rad)) * 0.3;
  return [projected_x, py];
}

// Simple body parts as polygons
function getBodyParts() {
  const torsoTop = 118, torsoH = 88, sw = 60, hw = 32, armY = 136, legTop = 211;
  return [
    { id: "hair", joint: "head", pts: [[-35,-15],[-38,10],[0,20],[38,10],[35,-15],[20,-28],[0,-32],[-20,-28]], color: "#2C1810", z: 4 },
    { id: "head", joint: "head", pts: [[-30,-5],[-33,18],[-28,38],[-16,45],[0,48],[16,45],[28,38],[33,18],[30,-5],[18,-14],[0,-18],[-18,-14]], color: "#D4A574", z: 2 },
    { id: "eyeL", joint: "head", pts: [[-18,10],[-14,7],[-8,7],[-4,10],[-8,13],[-14,13]], color: "#1A1A1A", z: 2.5 },
    { id: "eyeR", joint: "head", pts: [[4,10],[8,7],[14,7],[18,10],[14,13],[8,13]], color: "#1A1A1A", z: 2.5 },
    { id: "torso", joint: "center_mass", pts: [[-16,-52],[-sw,-34],[-sw-4,-7],[-hw,18],[hw,18],[sw+4,-7],[sw,-34],[16,-52]], color: "#4A6741", z: 2 },
    { id: "armL", joint: "shoulder_L", pts: [[-4,-2],[-12,44],[-10,86],[2,86],[4,44],[4,-2]], color: "#D4A574", z: 1 },
    { id: "armR", joint: "shoulder_R", pts: [[-4,-2],[4,-2],[4,44],[10,86],[-2,86],[-4,44]], color: "#D4A574", z: 3 },
    { id: "handL", joint: "hand_L", pts: [[-8,-4],[-10,10],[-2,14],[6,10],[4,-4]], color: "#C89B5D", z: 1 },
    { id: "handR", joint: "hand_R", pts: [[-6,-4],[-4,10],[2,14],[10,10],[8,-4]], color: "#C89B5D", z: 3 },
    { id: "legL", joint: "hip_L", pts: [[-12,-4],[-14,56],[-12,110],[0,110],[2,56],[4,-4]], color: "#2F3136", z: 1 },
    { id: "legR", joint: "hip_R", pts: [[-4,-4],[-2,56],[0,110],[12,110],[14,56],[12,-4]], color: "#2F3136", z: 3 },
    { id: "footL", joint: "foot_L", pts: [[-14,-4],[-18,6],[-16,12],[4,12],[4,-4]], color: "#3D2314", z: 1 },
    { id: "footR", joint: "foot_R", pts: [[-4,-4],[-4,12],[16,12],[18,6],[14,-4]], color: "#3D2314", z: 3 },
  ];
}

// Shading presets
const LIGHT_PRESETS = {
  horror:   { dir: 180, color: [255,68,0],   amb: [10,5,16],  shadow: 0.85, rimColor: [255,34,0] },
  daylight: { dir: 315, color: [255,248,231], amb: [200,216,232], shadow: 0.35, rimColor: [255,250,240] },
  moonlit:  { dir: 330, color: [212,229,255], amb: [13,17,23],  shadow: 0.8, rimColor: [160,192,255] },
  firelit:  { dir: 180, color: [255,153,51],  amb: [26,8,0],   shadow: 0.75, rimColor: [255,102,0] },
  neon:     { dir: 0,   color: [0,255,255],   amb: [10,10,26], shadow: 0.75, rimColor: [0,255,136] },
};

function shadeColor(baseHex, lightPreset, normalAngle) {
  const r = parseInt(baseHex.slice(1,3),16), g = parseInt(baseHex.slice(3,5),16), b = parseInt(baseHex.slice(5,7),16);
  const lRad = (lightPreset.dir * Math.PI) / 180;
  const diffuse = Math.max(0, Math.cos(normalAngle - lRad)) * 0.7 + 0.3;
  const lr = lightPreset.color[0]/255, lg = lightPreset.color[1]/255, lb = lightPreset.color[2]/255;
  const ar = lightPreset.amb[0]/255, ag = lightPreset.amb[1]/255, ab = lightPreset.amb[2]/255;
  const fr = Math.min(255, r * (diffuse * lr + ar * 0.3));
  const fg = Math.min(255, g * (diffuse * lg + ag * 0.3));
  const fb = Math.min(255, b * (diffuse * lb + ab * 0.3));
  const shadowAmt = (1 - diffuse) * lightPreset.shadow;
  const sr = Math.max(0, fr * (1 - shadowAmt * 0.7));
  const sg = Math.max(0, fg * (1 - shadowAmt * 0.75));
  const sb = Math.max(0, fb * (1 - shadowAmt * 0.65));
  return `rgb(${Math.round(sr)},${Math.round(sg)},${Math.round(sb)})`;
}

export default function AvatarEngineDemo() {
  const canvasRef = useRef(null);
  const [race, setRace] = useState("human");
  const [poseIdx, setPoseIdx] = useState(0);
  const [angle, setAngle] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [autoPose, setAutoPose] = useState(false);
  const [lighting, setLighting] = useState("daylight");
  const [showHooks, setShowHooks] = useState(true);
  const timeRef = useRef(0);
  const frameRef = useRef(0);

  const currentPose = POSE_NAMES[poseIdx];
  const weight = RACE_WEIGHTS[race] || RACE_WEIGHTS.human;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    timeRef.current += 0.016 * weight.speed;
    const t = timeRef.current;

    // Get pose offsets and apply weight
    const rawOffsets = BASE_POSES[currentPose](t);
    const offsets = applyWeight(rawOffsets, weight, t);

    // Compute joint positions
    const joints = {};
    for (const key of JOINT_NAMES) {
      const base = JOINTS[key];
      const off = offsets[key] || { x: 0, y: 0 };
      const [px, py] = projectPoint(base.x + off.x, base.y + off.y, angle);
      joints[key] = { x: px, y: py };
    }

    const light = LIGHT_PRESETS[lighting];
    const parts = getBodyParts();

    // Sort by Z (back to front), flip Z for back-facing angles
    const isFacingBack = Math.cos((angle * Math.PI) / 180) < 0;
    const sorted = [...parts].sort((a, b) => {
      let az = a.z, bz = b.z;
      if (isFacingBack) { az = 4 - az; bz = 4 - bz; }
      return az - bz;
    });

    // Hide face details when facing back
    const sinA = Math.sin((angle * Math.PI) / 180);
    const abssin = Math.abs(sinA);

    // Draw shadow
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath();
    ctx.ellipse(joints.center_mass.x, 340, 40 * Math.abs(Math.cos((angle*Math.PI)/180)) + 15, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw each part
    for (const part of sorted) {
      // Visibility check
      if (isFacingBack && (part.id === "eyeL" || part.id === "eyeR")) continue;
      if (abssin > 0.85) {
        if ((sinA > 0 && part.id.includes("L") && part.z === 1)) continue;
        if ((sinA < 0 && part.id.includes("R") && part.z === 3)) continue;
      }

      const j = joints[part.joint];
      const normalAngle = Math.atan2(j.y - 200, j.x - 200);
      const color = shadeColor(part.color, light, normalAngle);

      ctx.fillStyle = color;
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();

      // Scale part based on angle compression
      const cosA = Math.cos((angle * Math.PI) / 180);
      const xScale = Math.abs(cosA) + Math.abs(Math.sin((angle * Math.PI) / 180)) * 0.3;

      for (let i = 0; i < part.pts.length; i++) {
        const px = j.x + part.pts[i][0] * xScale;
        const py = j.y + part.pts[i][1];
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Rim light
      ctx.strokeStyle = `rgba(${light.rimColor[0]},${light.rimColor[1]},${light.rimColor[2]},0.2)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Draw joint hooks
    if (showHooks) {
      for (const key of JOINT_NAMES) {
        const j = joints[key];
        ctx.beginPath();
        ctx.arc(j.x, j.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = key === "center_mass" ? "#FF0" : "#0FF";
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      // Draw bones
      ctx.strokeStyle = "rgba(0,255,255,0.3)";
      ctx.lineWidth = 1;
      const bones = [
        ["head","center_mass"],["shoulder_L","center_mass"],["shoulder_R","center_mass"],
        ["shoulder_L","hand_L"],["shoulder_R","hand_R"],
        ["hip_L","center_mass"],["hip_R","center_mass"],
        ["hip_L","foot_L"],["hip_R","foot_R"]
      ];
      for (const [a, b] of bones) {
        ctx.beginPath();
        ctx.moveTo(joints[a].x, joints[a].y);
        ctx.lineTo(joints[b].x, joints[b].y);
        ctx.stroke();
      }
    }

    // HUD
    ctx.fillStyle = "#FFF";
    ctx.font = "11px monospace";
    ctx.fillText(`${race} | ${currentPose} | ${angle}°`, 8, 16);
    ctx.fillText(`amp:${weight.amp.toFixed(2)} spd:${weight.speed.toFixed(2)} jit:${weight.jitter} fly:${weight.flight}`, 8, 30);
    ctx.fillText(`frame: ${Math.floor(angle/6)*25 + poseIdx} / 1500`, 8, 44);

    frameRef.current = requestAnimationFrame(draw);
  }, [currentPose, angle, race, lighting, showHooks, weight]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  // Auto-rotate
  useEffect(() => {
    if (!autoRotate) return;
    const iv = setInterval(() => setAngle(a => (a + 6) % 360), 120);
    return () => clearInterval(iv);
  }, [autoRotate]);

  // Auto-pose cycle
  useEffect(() => {
    if (!autoPose) return;
    const iv = setInterval(() => setPoseIdx(i => (i + 1) % POSE_NAMES.length), 800);
    return () => clearInterval(iv);
  }, [autoPose]);

  const races = Object.keys(RACE_WEIGHTS);

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", color: "#e0e0e0", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", padding: 12 }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 14, color: "#888", letterSpacing: 2 }}>KASVILLAGE 2.5D ENGINE</span>
        <span style={{ fontSize: 11, color: "#555", marginLeft: 12 }}>25 POSES × 60 ANGLES = 1500 FRAMES</span>
      </div>

      <canvas ref={canvasRef} width={400} height={360} style={{ display: "block", margin: "0 auto", background: "#111118", borderRadius: 6, border: "1px solid #222" }} />

      {/* Pose selector */}
      <div style={{ margin: "10px 0", display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
        {POSE_NAMES.map((p, i) => (
          <button key={p} onClick={() => setPoseIdx(i)}
            style={{ padding: "3px 7px", fontSize: 9, border: i === poseIdx ? "1px solid #0ff" : "1px solid #333", borderRadius: 3,
              background: i === poseIdx ? "#0ff2" : "#1a1a1a", color: i === poseIdx ? "#0ff" : "#888", cursor: "pointer" }}>
            {p}
          </button>
        ))}
      </div>

      {/* Angle slider */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", margin: "6px 0" }}>
        <span style={{ fontSize: 10, color: "#666", width: 40 }}>{angle}°</span>
        <input type="range" min={0} max={354} step={6} value={angle} onChange={e => setAngle(+e.target.value)}
          style={{ width: 200, accentColor: "#0ff" }} />
        <button onClick={() => setAutoRotate(!autoRotate)}
          style={{ padding: "3px 8px", fontSize: 10, border: "1px solid #333", borderRadius: 3,
            background: autoRotate ? "#0ff2" : "#1a1a1a", color: autoRotate ? "#0ff" : "#888", cursor: "pointer" }}>
          {autoRotate ? "⏸ STOP" : "⏵ ROTATE"}
        </button>
        <button onClick={() => setAutoPose(!autoPose)}
          style={{ padding: "3px 8px", fontSize: 10, border: "1px solid #333", borderRadius: 3,
            background: autoPose ? "#ff02" : "#1a1a1a", color: autoPose ? "#ff0" : "#888", cursor: "pointer" }}>
          {autoPose ? "⏸ POSES" : "⏵ CYCLE"}
        </button>
      </div>

      {/* Race selector */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center", margin: "6px 0" }}>
        {races.map(r => (
          <button key={r} onClick={() => setRace(r)}
            style={{ padding: "2px 6px", fontSize: 9, border: r === race ? "1px solid #f80" : "1px solid #222", borderRadius: 3,
              background: r === race ? "#f802" : "#111", color: r === race ? "#f80" : "#666", cursor: "pointer" }}>
            {r}
          </button>
        ))}
      </div>

      {/* Lighting + hooks */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "6px 0" }}>
        {Object.keys(LIGHT_PRESETS).map(l => (
          <button key={l} onClick={() => setLighting(l)}
            style={{ padding: "3px 8px", fontSize: 10, border: l === lighting ? "1px solid #f0f" : "1px solid #222", borderRadius: 3,
              background: l === lighting ? "#f0f2" : "#111", color: l === lighting ? "#f0f" : "#666", cursor: "pointer" }}>
            {l}
          </button>
        ))}
        <button onClick={() => setShowHooks(!showHooks)}
          style={{ padding: "3px 8px", fontSize: 10, border: "1px solid #222", borderRadius: 3,
            background: showHooks ? "#0f02" : "#111", color: showHooks ? "#0f0" : "#666", cursor: "pointer" }}>
          {showHooks ? "HOOKS ON" : "HOOKS OFF"}
        </button>
      </div>

      {/* Weight formula display */}
      <div style={{ margin: "8px auto", maxWidth: 400, padding: 8, background: "#0d0d14", borderRadius: 4, border: "1px solid #1a1a2e", fontSize: 10, lineHeight: 1.6 }}>
        <div style={{ color: "#0ff", marginBottom: 4 }}>WEIGHT FORMULA:</div>
        <div style={{ color: "#888" }}>
          offset = pose × <span style={{color:"#f80"}}>{weight.amp.toFixed(2)}</span> + jitter(<span style={{color:"#f0f"}}>{weight.jitter}</span>) + flight(<span style={{color:"#0f0"}}>{weight.flight?"ON":"OFF"}</span>)
        </div>
        <div style={{ color: "#888" }}>
          cycle_speed = base × <span style={{color:"#f80"}}>{weight.speed.toFixed(2)}</span>
        </div>
        <div style={{ color: "#555", marginTop: 4 }}>
          sprite_index = angle_idx({Math.floor(angle/6)}) × 25 + pose_idx({poseIdx}) = <span style={{color:"#ff0"}}>{Math.floor(angle/6)*25 + poseIdx}</span>
        </div>
      </div>
    </div>
  );
}
