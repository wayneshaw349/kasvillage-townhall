// ============================================================================
// KasVillage World Physics — kasvillage_world_physics.ts
// 12 physics systems for games. Pure math. Zero assets. Zero dependencies.
//
// Systems:
//   1.  AABB + Circle collision
//   2.  Raycasting 2D
//   3.  Rigid body (simple)
//   4.  Gravity + jumping
//   5.  Momentum / velocity (skating, sliding)
//   6.  Rail grinding / Bezier curves
//   7.  A* pathfinding
//   8.  Trigger zones
//   9.  Inverse kinematics (2-bone)
//   10. Ragdoll (chain)
//   11. Projectile arcs
//   12. Spatial hash grid
//
// Constraints compliance: ✅ All pure math, no images, no fetch, no eval
// ============================================================================

// ============================================================================
// SHARED TYPES
// ============================================================================

export interface Vec2 { x: number; y: number; }
export interface Vec3 { x: number; y: number; z: number; }

export function vec2(x: number, y: number): Vec2 { return { x, y }; }
export function vec3(x: number, y: number, z: number): Vec3 { return { x, y, z }; }

export function v2add(a: Vec2, b: Vec2): Vec2 { return { x: a.x + b.x, y: a.y + b.y }; }
export function v2sub(a: Vec2, b: Vec2): Vec2 { return { x: a.x - b.x, y: a.y - b.y }; }
export function v2scale(a: Vec2, s: number): Vec2 { return { x: a.x * s, y: a.y * s }; }
export function v2dot(a: Vec2, b: Vec2): number { return a.x * b.x + a.y * b.y; }
export function v2len(a: Vec2): number { return Math.sqrt(a.x * a.x + a.y * a.y); }
export function v2dist(a: Vec2, b: Vec2): number { return v2len(v2sub(a, b)); }
export function v2norm(a: Vec2): Vec2 {
  const l = v2len(a);
  return l > 0.0001 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
}
export function v2lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
export function v2rotate(v: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}
export function v2perp(v: Vec2): Vec2 { return { x: -v.y, y: v.x }; }
export function v2reflect(v: Vec2, normal: Vec2): Vec2 {
  const d = 2 * v2dot(v, normal);
  return { x: v.x - d * normal.x, y: v.y - d * normal.y };
}
export function v2clamp(v: Vec2, maxLen: number): Vec2 {
  const l = v2len(v);
  return l > maxLen ? v2scale(v2norm(v), maxLen) : v;
}

// ============================================================================
// 1. AABB + CIRCLE COLLISION
// ============================================================================

export interface AABB {
  x: number; y: number;  // center
  hw: number; hh: number; // half-width, half-height
}

export interface Circle {
  x: number; y: number;
  r: number;
}

export interface CollisionResult {
  hit: boolean;
  overlap: number;
  normal: Vec2;
  point: Vec2;
}

const NO_HIT: CollisionResult = { hit: false, overlap: 0, normal: vec2(0, 0), point: vec2(0, 0) };

export function aabbVsAabb(a: AABB, b: AABB): CollisionResult {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const overlapX = a.hw + b.hw - Math.abs(dx);
  const overlapY = a.hh + b.hh - Math.abs(dy);
  if (overlapX <= 0 || overlapY <= 0) return NO_HIT;
  if (overlapX < overlapY) {
    const nx = dx > 0 ? 1 : -1;
    return { hit: true, overlap: overlapX, normal: vec2(nx, 0), point: vec2(a.x + a.hw * nx, a.y) };
  }
  const ny = dy > 0 ? 1 : -1;
  return { hit: true, overlap: overlapY, normal: vec2(0, ny), point: vec2(a.x, a.y + a.hh * ny) };
}

export function circleVsCircle(a: Circle, b: Circle): CollisionResult {
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const overlap = a.r + b.r - dist;
  if (overlap <= 0) return NO_HIT;
  const nx = dist > 0.0001 ? dx / dist : 1;
  const ny = dist > 0.0001 ? dy / dist : 0;
  return {
    hit: true, overlap,
    normal: vec2(nx, ny),
    point: vec2(a.x + nx * a.r, a.y + ny * a.r),
  };
}

export function aabbVsCircle(box: AABB, circle: Circle): CollisionResult {
  const closestX = Math.max(box.x - box.hw, Math.min(circle.x, box.x + box.hw));
  const closestY = Math.max(box.y - box.hh, Math.min(circle.y, box.y + box.hh));
  const dx = circle.x - closestX, dy = circle.y - closestY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist >= circle.r) return NO_HIT;
  const nx = dist > 0.0001 ? dx / dist : 0;
  const ny = dist > 0.0001 ? dy / dist : -1;
  return {
    hit: true, overlap: circle.r - dist,
    normal: vec2(nx, ny),
    point: vec2(closestX, closestY),
  };
}

export function pointInAabb(p: Vec2, box: AABB): boolean {
  return Math.abs(p.x - box.x) <= box.hw && Math.abs(p.y - box.y) <= box.hh;
}

export function pointInCircle(p: Vec2, c: Circle): boolean {
  return v2dist(p, vec2(c.x, c.y)) <= c.r;
}

// ============================================================================
// 2. RAYCASTING 2D
// ============================================================================

export interface Ray {
  origin: Vec2;
  direction: Vec2;
  maxDist: number;
}

export interface RayHit {
  hit: boolean;
  t: number;          // distance along ray
  point: Vec2;
  normal: Vec2;
  entityId?: string;
}

const NO_RAY_HIT: RayHit = { hit: false, t: Infinity, point: vec2(0, 0), normal: vec2(0, 0) };

export function rayVsAabb(ray: Ray, box: AABB): RayHit {
  const invDx = ray.direction.x !== 0 ? 1 / ray.direction.x : 1e10;
  const invDy = ray.direction.y !== 0 ? 1 / ray.direction.y : 1e10;
  const t1x = (box.x - box.hw - ray.origin.x) * invDx;
  const t2x = (box.x + box.hw - ray.origin.x) * invDx;
  const t1y = (box.y - box.hh - ray.origin.y) * invDy;
  const t2y = (box.y + box.hh - ray.origin.y) * invDy;
  const tMin = Math.max(Math.min(t1x, t2x), Math.min(t1y, t2y));
  const tMax = Math.min(Math.max(t1x, t2x), Math.max(t1y, t2y));
  if (tMax < 0 || tMin > tMax || tMin > ray.maxDist) return NO_RAY_HIT;
  const t = tMin >= 0 ? tMin : tMax;
  const point = v2add(ray.origin, v2scale(ray.direction, t));
  // Determine hit normal
  let normal = vec2(0, 0);
  const eps = 0.001;
  if (Math.abs(point.x - (box.x - box.hw)) < eps) normal = vec2(-1, 0);
  else if (Math.abs(point.x - (box.x + box.hw)) < eps) normal = vec2(1, 0);
  else if (Math.abs(point.y - (box.y - box.hh)) < eps) normal = vec2(0, -1);
  else normal = vec2(0, 1);
  return { hit: true, t, point, normal };
}

export function rayVsCircle(ray: Ray, circle: Circle): RayHit {
  const oc = v2sub(ray.origin, vec2(circle.x, circle.y));
  const b = v2dot(oc, ray.direction);
  const c = v2dot(oc, oc) - circle.r * circle.r;
  const disc = b * b - c;
  if (disc < 0) return NO_RAY_HIT;
  const sqrtDisc = Math.sqrt(disc);
  let t = -b - sqrtDisc;
  if (t < 0) t = -b + sqrtDisc;
  if (t < 0 || t > ray.maxDist) return NO_RAY_HIT;
  const point = v2add(ray.origin, v2scale(ray.direction, t));
  const normal = v2norm(v2sub(point, vec2(circle.x, circle.y)));
  return { hit: true, t, point, normal };
}

/** Cast a vision cone — returns all entities within angle+distance */
export function visionCone(
  origin: Vec2,
  facing: Vec2,
  halfAngle: number,
  maxDist: number,
  targets: Array<{ pos: Vec2; id: string }>
): Array<{ id: string; dist: number }> {
  const results: Array<{ id: string; dist: number }> = [];
  const facingNorm = v2norm(facing);
  const cosHalf = Math.cos(halfAngle);
  for (const target of targets) {
    const toTarget = v2sub(target.pos, origin);
    const dist = v2len(toTarget);
    if (dist > maxDist || dist < 0.001) continue;
    const dir = v2scale(toTarget, 1 / dist);
    const dot = v2dot(facingNorm, dir);
    if (dot >= cosHalf) {
      results.push({ id: target.id, dist });
    }
  }
  return results.sort((a, b) => a.dist - b.dist);
}

// ============================================================================
// 3. RIGID BODY (SIMPLE)
// ============================================================================

export interface RigidBody {
  pos: Vec2;
  vel: Vec2;
  acc: Vec2;
  mass: number;
  restitution: number;  // bounciness 0-1
  friction: number;      // 0-1
  angularVel: number;
  angle: number;
  isStatic: boolean;
  collider: AABB | Circle;
  id: string;
}

export function createRigidBody(opts: Partial<RigidBody> & { id: string; pos: Vec2; collider: AABB | Circle }): RigidBody {
  return {
    vel: vec2(0, 0),
    acc: vec2(0, 0),
    mass: 1,
    restitution: 0.3,
    friction: 0.1,
    angularVel: 0,
    angle: 0,
    isStatic: false,
    ...opts,
  };
}

export function applyForce(body: RigidBody, force: Vec2): void {
  if (body.isStatic) return;
  body.acc.x += force.x / body.mass;
  body.acc.y += force.y / body.mass;
}

export function applyImpulse(body: RigidBody, impulse: Vec2): void {
  if (body.isStatic) return;
  body.vel.x += impulse.x / body.mass;
  body.vel.y += impulse.y / body.mass;
}

export function integrateBody(body: RigidBody, dt: number): void {
  if (body.isStatic) return;
  body.vel.x += body.acc.x * dt;
  body.vel.y += body.acc.y * dt;
  body.pos.x += body.vel.x * dt;
  body.pos.y += body.vel.y * dt;
  body.angle += body.angularVel * dt;
  // Apply friction
  body.vel.x *= 1 - body.friction * dt;
  body.vel.y *= 1 - body.friction * dt;
  body.angularVel *= 1 - body.friction * dt;
  // Reset acceleration
  body.acc.x = 0;
  body.acc.y = 0;
  // Sync collider position
  if ('hw' in body.collider) {
    body.collider.x = body.pos.x;
    body.collider.y = body.pos.y;
  } else {
    body.collider.x = body.pos.x;
    body.collider.y = body.pos.y;
  }
}

export function resolveCollision(a: RigidBody, b: RigidBody, collision: CollisionResult): void {
  if (!collision.hit) return;
  const { normal, overlap } = collision;
  // Separate bodies
  const totalMass = (a.isStatic ? 0 : a.mass) + (b.isStatic ? 0 : b.mass);
  if (totalMass === 0) return;
  if (!a.isStatic) {
    const ratio = b.isStatic ? 1 : b.mass / totalMass;
    a.pos.x -= normal.x * overlap * ratio;
    a.pos.y -= normal.y * overlap * ratio;
  }
  if (!b.isStatic) {
    const ratio = a.isStatic ? 1 : a.mass / totalMass;
    b.pos.x += normal.x * overlap * ratio;
    b.pos.y += normal.y * overlap * ratio;
  }
  // Impulse resolution
  const relVel = v2sub(a.vel, b.vel);
  const velAlongNormal = v2dot(relVel, normal);
  if (velAlongNormal > 0) return; // separating
  const e = Math.min(a.restitution, b.restitution);
  const j = -(1 + e) * velAlongNormal / (
    (a.isStatic ? 0 : 1 / a.mass) + (b.isStatic ? 0 : 1 / b.mass)
  );
  const impulse = v2scale(normal, j);
  if (!a.isStatic) {
    a.vel.x += impulse.x / a.mass;
    a.vel.y += impulse.y / a.mass;
  }
  if (!b.isStatic) {
    b.vel.x -= impulse.x / b.mass;
    b.vel.y -= impulse.y / b.mass;
  }
}

// ============================================================================
// 4. GRAVITY + JUMPING
// ============================================================================

export interface CharacterBody {
  pos: Vec2;
  vel: Vec2;
  grounded: boolean;
  jumpCount: number;
  maxJumps: number;       // 1 = normal, 2 = double jump
  jumpForce: number;      // pixels/sec upward
  gravity: number;        // pixels/sec² downward
  maxFallSpeed: number;
  coyoteTime: number;     // seconds of grace after leaving ground
  coyoteTimer: number;
  jumpBufferTime: number; // pre-land jump buffer
  jumpBufferTimer: number;
  wallSlideSpeed: number; // reduced fall speed on walls
  touchingWall: -1 | 0 | 1; // -1 left, 0 none, 1 right
}

export function createCharacterBody(pos: Vec2, opts?: Partial<CharacterBody>): CharacterBody {
  return {
    pos, vel: vec2(0, 0),
    grounded: false, jumpCount: 0, maxJumps: 1,
    jumpForce: -600, gravity: 1800, maxFallSpeed: 900,
    coyoteTime: 0.1, coyoteTimer: 0,
    jumpBufferTime: 0.12, jumpBufferTimer: 0,
    wallSlideSpeed: 150, touchingWall: 0,
    ...opts,
  };
}

export function updateCharacterGravity(ch: CharacterBody, dt: number): void {
  // Gravity
  if (!ch.grounded) {
    // Wall slide reduces fall speed
    if (ch.touchingWall !== 0 && ch.vel.y > 0) {
      ch.vel.y = Math.min(ch.vel.y + ch.gravity * 0.2 * dt, ch.wallSlideSpeed);
    } else {
      ch.vel.y = Math.min(ch.vel.y + ch.gravity * dt, ch.maxFallSpeed);
    }
    ch.coyoteTimer -= dt;
  } else {
    ch.vel.y = 0;
    ch.jumpCount = 0;
    ch.coyoteTimer = ch.coyoteTime;
  }
  // Jump buffer countdown
  if (ch.jumpBufferTimer > 0) ch.jumpBufferTimer -= dt;
  // Integrate
  ch.pos.x += ch.vel.x * dt;
  ch.pos.y += ch.vel.y * dt;
}

export function tryJump(ch: CharacterBody): boolean {
  const canJump = ch.grounded || ch.coyoteTimer > 0 || ch.jumpCount < ch.maxJumps;
  if (!canJump) {
    ch.jumpBufferTimer = ch.jumpBufferTime; // buffer for later
    return false;
  }
  ch.vel.y = ch.jumpForce;
  ch.jumpCount++;
  ch.grounded = false;
  ch.coyoteTimer = 0;
  return true;
}

export function tryWallJump(ch: CharacterBody, wallKickForce: number = 400): boolean {
  if (ch.touchingWall === 0 || ch.grounded) return false;
  ch.vel.y = ch.jumpForce * 0.85;
  ch.vel.x = -ch.touchingWall * wallKickForce;
  ch.jumpCount = 1;
  ch.touchingWall = 0;
  return true;
}

export function landOnGround(ch: CharacterBody, groundY: number): void {
  ch.pos.y = groundY;
  ch.vel.y = 0;
  ch.grounded = true;
  ch.jumpCount = 0;
  ch.coyoteTimer = ch.coyoteTime;
  // Check buffered jump
  if (ch.jumpBufferTimer > 0) {
    ch.jumpBufferTimer = 0;
    tryJump(ch);
  }
}

// ============================================================================
// 5. MOMENTUM / VELOCITY (skating, sliding, acceleration)
// ============================================================================

export interface MomentumBody {
  pos: Vec2;
  vel: Vec2;
  speed: number;
  maxSpeed: number;
  acceleration: number;
  deceleration: number;  // friction when no input
  turnSpeed: number;     // how fast you can change direction
  facing: number;        // angle in radians
  // Skating-specific
  isGrinding: boolean;
  trickMultiplier: number;
  combo: number;
  airTime: number;
}

export function createMomentumBody(pos: Vec2, opts?: Partial<MomentumBody>): MomentumBody {
  return {
    pos, vel: vec2(0, 0), speed: 0,
    maxSpeed: 500, acceleration: 800, deceleration: 400,
    turnSpeed: 4, facing: 0,
    isGrinding: false, trickMultiplier: 1, combo: 0, airTime: 0,
    ...opts,
  };
}

export function accelerate(body: MomentumBody, inputDir: Vec2, dt: number): void {
  const inputLen = v2len(inputDir);
  if (inputLen > 0.1) {
    // Accelerate toward input direction
    const targetAngle = Math.atan2(inputDir.y, inputDir.x);
    // Smooth turn
    let angleDiff = targetAngle - body.facing;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    body.facing += angleDiff * Math.min(1, body.turnSpeed * dt);
    body.speed = Math.min(body.speed + body.acceleration * dt, body.maxSpeed);
  } else {
    // Decelerate
    body.speed = Math.max(0, body.speed - body.deceleration * dt);
  }
  body.vel.x = Math.cos(body.facing) * body.speed;
  body.vel.y = Math.sin(body.facing) * body.speed;
  body.pos.x += body.vel.x * dt;
  body.pos.y += body.vel.y * dt;
}

/** Apply slope boost (downhill = faster, uphill = slower) */
export function applySlopeEffect(body: MomentumBody, slopeAngle: number, strength: number = 200): void {
  const slopeEffect = Math.sin(slopeAngle - body.facing) * strength;
  body.speed += slopeEffect * 0.016; // assume 60fps
  body.speed = Math.max(0, Math.min(body.speed, body.maxSpeed * 1.5));
}

/** Drift / powerslide — preserves speed but changes direction faster */
export function drift(body: MomentumBody, driftAngle: number, grip: number = 0.3): void {
  const targetVel = v2rotate(vec2(body.speed, 0), body.facing + driftAngle);
  body.vel.x = body.vel.x * (1 - grip) + targetVel.x * grip;
  body.vel.y = body.vel.y * (1 - grip) + targetVel.y * grip;
  body.speed *= 0.998; // slight speed loss during drift
}

// ============================================================================
// 6. RAIL GRINDING / BEZIER CURVES
// ============================================================================

export interface BezierCurve {
  p0: Vec2; p1: Vec2; p2: Vec2; p3: Vec2; // cubic bezier
}

export interface Rail {
  curve: BezierCurve;
  length: number;
  id: string;
}

export function evalBezier(c: BezierCurve, t: number): Vec2 {
  const u = 1 - t;
  const uu = u * u, uuu = uu * u;
  const tt = t * t, ttt = tt * t;
  return {
    x: uuu * c.p0.x + 3 * uu * t * c.p1.x + 3 * u * tt * c.p2.x + ttt * c.p3.x,
    y: uuu * c.p0.y + 3 * uu * t * c.p1.y + 3 * u * tt * c.p2.y + ttt * c.p3.y,
  };
}

export function evalBezierTangent(c: BezierCurve, t: number): Vec2 {
  const u = 1 - t;
  return v2norm({
    x: 3 * u * u * (c.p1.x - c.p0.x) + 6 * u * t * (c.p2.x - c.p1.x) + 3 * t * t * (c.p3.x - c.p2.x),
    y: 3 * u * u * (c.p1.y - c.p0.y) + 6 * u * t * (c.p2.y - c.p1.y) + 3 * t * t * (c.p3.y - c.p2.y),
  });
}

export function estimateBezierLength(c: BezierCurve, segments: number = 20): number {
  let len = 0;
  let prev = evalBezier(c, 0);
  for (let i = 1; i <= segments; i++) {
    const curr = evalBezier(c, i / segments);
    len += v2dist(prev, curr);
    prev = curr;
  }
  return len;
}

export function createRail(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, id: string): Rail {
  const curve = { p0, p1, p2, p3 };
  return { curve, length: estimateBezierLength(curve), id };
}

export interface GrindState {
  rail: Rail;
  t: number;          // 0-1 position on rail
  speed: number;      // pixels/sec along rail
  direction: 1 | -1;  // forward or backward on rail
  balance: number;    // -1 to 1, fall off at extremes
  balanceDrift: number;
}

export function startGrind(rail: Rail, startT: number, speed: number): GrindState {
  return {
    rail, t: startT, speed: Math.abs(speed),
    direction: speed >= 0 ? 1 : -1,
    balance: 0, balanceDrift: (Math.random() - 0.5) * 2,
  };
}

export function updateGrind(state: GrindState, balanceInput: number, dt: number): { pos: Vec2; tangent: Vec2; fell: boolean; finished: boolean } {
  // Move along rail
  const tDelta = (state.speed * state.direction * dt) / state.rail.length;
  state.t += tDelta;
  // Balance mechanic
  state.balance += state.balanceDrift * dt;
  state.balance += balanceInput * 3 * dt;
  state.balance = Math.max(-1, Math.min(1, state.balance));
  state.balanceDrift += (Math.random() - 0.5) * 4 * dt;
  state.balanceDrift *= 0.95;
  const fell = Math.abs(state.balance) >= 0.95;
  const finished = state.t <= 0 || state.t >= 1;
  const clampedT = Math.max(0, Math.min(1, state.t));
  return {
    pos: evalBezier(state.rail.curve, clampedT),
    tangent: evalBezierTangent(state.rail.curve, clampedT),
    fell, finished,
  };
}

/** Find closest point on rail to a position */
export function closestPointOnRail(rail: Rail, pos: Vec2, samples: number = 30): { t: number; dist: number; point: Vec2 } {
  let bestT = 0, bestDist = Infinity, bestPoint = vec2(0, 0);
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = evalBezier(rail.curve, t);
    const d = v2dist(pos, p);
    if (d < bestDist) { bestT = t; bestDist = d; bestPoint = p; }
  }
  return { t: bestT, dist: bestDist, point: bestPoint };
}

// ============================================================================
// 7. A* PATHFINDING
// ============================================================================

export interface NavGrid {
  width: number;
  height: number;
  cellSize: number;
  blocked: Set<string>; // "x,y" keys for blocked cells
}

export function createNavGrid(width: number, height: number, cellSize: number): NavGrid {
  return { width, height, cellSize, blocked: new Set() };
}

export function blockCell(grid: NavGrid, gx: number, gy: number): void {
  grid.blocked.add(`${gx},${gy}`);
}

export function unblockCell(grid: NavGrid, gx: number, gy: number): void {
  grid.blocked.delete(`${gx},${gy}`);
}

export function worldToGrid(grid: NavGrid, pos: Vec2): Vec2 {
  return vec2(Math.floor(pos.x / grid.cellSize), Math.floor(pos.y / grid.cellSize));
}

export function gridToWorld(grid: NavGrid, cell: Vec2): Vec2 {
  return vec2((cell.x + 0.5) * grid.cellSize, (cell.y + 0.5) * grid.cellSize);
}

export function findPath(grid: NavGrid, startWorld: Vec2, endWorld: Vec2): Vec2[] {
  const start = worldToGrid(grid, startWorld);
  const end = worldToGrid(grid, endWorld);
  const key = (x: number, y: number) => `${x},${y}`;
  if (grid.blocked.has(key(end.x, end.y))) return [];

  const open: Array<{ x: number; y: number; f: number; g: number }> = [];
  const closed = new Set<string>();
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();

  const h = (x: number, y: number) => Math.abs(x - end.x) + Math.abs(y - end.y);

  gScore.set(key(start.x, start.y), 0);
  open.push({ x: start.x, y: start.y, f: h(start.x, start.y), g: 0 });

  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, 1], [1, -1], [-1, -1], // diagonals
  ];

  let iterations = 0;
  const maxIter = grid.width * grid.height;

  while (open.length > 0 && iterations++ < maxIter) {
    // Find lowest f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    const ck = key(current.x, current.y);

    if (current.x === end.x && current.y === end.y) {
      // Reconstruct path
      const path: Vec2[] = [];
      let k = ck;
      while (k) {
        const [px, py] = k.split(',').map(Number);
        path.unshift(gridToWorld(grid, vec2(px, py)));
        k = cameFrom.get(k) || '';
      }
      return path;
    }

    closed.add(ck);

    for (const [dx, dy] of dirs) {
      const nx = current.x + dx, ny = current.y + dy;
      const nk = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
      if (closed.has(nk) || grid.blocked.has(nk)) continue;
      // Diagonal: check both adjacent cells aren't blocked (prevent corner cutting)
      if (dx !== 0 && dy !== 0) {
        if (grid.blocked.has(key(current.x + dx, current.y)) ||
            grid.blocked.has(key(current.x, current.y + dy))) continue;
      }
      const moveCost = dx !== 0 && dy !== 0 ? 1.414 : 1;
      const tentG = current.g + moveCost;
      const prevG = gScore.get(nk) ?? Infinity;
      if (tentG < prevG) {
        cameFrom.set(nk, ck);
        gScore.set(nk, tentG);
        const f = tentG + h(nx, ny);
        const existing = open.find(o => o.x === nx && o.y === ny);
        if (existing) { existing.f = f; existing.g = tentG; }
        else open.push({ x: nx, y: ny, f, g: tentG });
      }
    }
  }
  return []; // no path
}

/** Smooth a path by removing unnecessary waypoints (line of sight check) */
export function smoothPath(path: Vec2[], grid: NavGrid): Vec2[] {
  if (path.length <= 2) return path;
  const smoothed: Vec2[] = [path[0]];
  let current = 0;
  while (current < path.length - 1) {
    let farthest = current + 1;
    for (let i = path.length - 1; i > current + 1; i--) {
      if (hasLineOfSight(grid, path[current], path[i])) {
        farthest = i;
        break;
      }
    }
    smoothed.push(path[farthest]);
    current = farthest;
  }
  return smoothed;
}

function hasLineOfSight(grid: NavGrid, a: Vec2, b: Vec2): boolean {
  const steps = Math.ceil(v2dist(a, b) / (grid.cellSize * 0.5));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const p = v2lerp(a, b, t);
    const cell = worldToGrid(grid, p);
    if (grid.blocked.has(`${cell.x},${cell.y}`)) return false;
  }
  return true;
}

// ============================================================================
// 8. TRIGGER ZONES
// ============================================================================

export type TriggerShape = AABB | Circle;
export type TriggerCallback = (entityId: string, zone: TriggerZone) => void;

export interface TriggerZone {
  id: string;
  shape: TriggerShape;
  oneShot: boolean;       // fire once then disable
  enabled: boolean;
  triggered: boolean;
  onEnter?: TriggerCallback;
  onStay?: TriggerCallback;
  onExit?: TriggerCallback;
  entitiesInside: Set<string>;
  data?: any;             // custom data (door target, cutscene id, etc)
}

export function createTrigger(id: string, shape: TriggerShape, opts?: Partial<TriggerZone>): TriggerZone {
  return {
    id, shape, oneShot: false, enabled: true, triggered: false,
    entitiesInside: new Set(),
    ...opts,
  };
}

export function updateTriggers(
  zones: TriggerZone[],
  entities: Array<{ id: string; pos: Vec2; radius?: number }>
): void {
  for (const zone of zones) {
    if (!zone.enabled) continue;
    for (const entity of entities) {
      const isInside = 'hw' in zone.shape
        ? pointInAabb(entity.pos, zone.shape as AABB)
        : pointInCircle(entity.pos, zone.shape as Circle);
      const wasInside = zone.entitiesInside.has(entity.id);
      if (isInside && !wasInside) {
        zone.entitiesInside.add(entity.id);
        zone.onEnter?.(entity.id, zone);
        if (zone.oneShot) {
          zone.triggered = true;
          zone.enabled = false;
        }
      } else if (isInside && wasInside) {
        zone.onStay?.(entity.id, zone);
      } else if (!isInside && wasInside) {
        zone.entitiesInside.delete(entity.id);
        zone.onExit?.(entity.id, zone);
      }
    }
  }
}

// ============================================================================
// 9. INVERSE KINEMATICS (2-bone)
// ============================================================================

export interface IKChain {
  root: Vec2;       // shoulder / hip
  mid: Vec2;        // elbow / knee
  end: Vec2;        // hand / foot
  upperLen: number;  // root→mid length
  lowerLen: number;  // mid→end length
  bendDir: 1 | -1;  // which way the joint bends
}

export function createIKChain(root: Vec2, upperLen: number, lowerLen: number, bendDir: 1 | -1 = 1): IKChain {
  return {
    root,
    mid: vec2(root.x, root.y + upperLen * bendDir),
    end: vec2(root.x, root.y + (upperLen + lowerLen) * bendDir),
    upperLen, lowerLen, bendDir,
  };
}

/** Solve 2-bone IK — position the end effector at target */
export function solveIK(chain: IKChain, target: Vec2): void {
  const totalLen = chain.upperLen + chain.lowerLen;
  const toTarget = v2sub(target, chain.root);
  let dist = v2len(toTarget);

  // Clamp distance
  dist = Math.min(dist, totalLen * 0.999);
  dist = Math.max(dist, Math.abs(chain.upperLen - chain.lowerLen) + 0.001);

  // Law of cosines for knee/elbow angle
  const a = chain.upperLen, b = chain.lowerLen, c = dist;
  const cosAngle = (a * a + c * c - b * b) / (2 * a * c);
  const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

  // Base angle (root to target)
  const baseAngle = Math.atan2(toTarget.y, toTarget.x);

  // Mid joint position
  const midAngle = baseAngle + angle * chain.bendDir;
  chain.mid = {
    x: chain.root.x + Math.cos(midAngle) * chain.upperLen,
    y: chain.root.y + Math.sin(midAngle) * chain.upperLen,
  };

  // End follows target (clamped)
  const midToTarget = v2sub(target, chain.mid);
  const midDist = v2len(midToTarget);
  if (midDist > 0.001) {
    const norm = v2scale(midToTarget, 1 / midDist);
    chain.end = {
      x: chain.mid.x + norm.x * chain.lowerLen,
      y: chain.mid.y + norm.y * chain.lowerLen,
    };
  } else {
    chain.end = { ...target };
  }
}

/** Foot placement — snap feet to ground using IK */
export function footPlacement(
  chain: IKChain,
  groundHeight: (x: number) => number,
  stepOffset: number = 0
): void {
  const groundY = groundHeight(chain.root.x + stepOffset);
  const target = vec2(chain.root.x + stepOffset, groundY);
  solveIK(chain, target);
}

// ============================================================================
// 10. RAGDOLL (chain)
// ============================================================================

export interface RagdollJoint {
  pos: Vec2;
  prevPos: Vec2;
  mass: number;
  pinned: boolean;
}

export interface RagdollConstraint {
  a: number;  // joint index
  b: number;  // joint index
  length: number;
  stiffness: number; // 0-1
}

export interface Ragdoll {
  joints: RagdollJoint[];
  constraints: RagdollConstraint[];
  gravity: Vec2;
  damping: number;
  iterations: number; // constraint solve iterations
}

export function createRagdoll(gravity?: Vec2): Ragdoll {
  return {
    joints: [],
    constraints: [],
    gravity: gravity || vec2(0, 600),
    damping: 0.99,
    iterations: 5,
  };
}

export function addJoint(ragdoll: Ragdoll, pos: Vec2, mass: number = 1, pinned: boolean = false): number {
  ragdoll.joints.push({ pos: { ...pos }, prevPos: { ...pos }, mass, pinned });
  return ragdoll.joints.length - 1;
}

export function addConstraint(ragdoll: Ragdoll, a: number, b: number, stiffness: number = 1): void {
  const length = v2dist(ragdoll.joints[a].pos, ragdoll.joints[b].pos);
  ragdoll.constraints.push({ a, b, length, stiffness });
}

/** Build a humanoid ragdoll: head, torso, arms, legs */
export function buildHumanoidRagdoll(headPos: Vec2, scale: number = 1): Ragdoll {
  const r = createRagdoll();
  const s = scale;
  // 0: head, 1: neck, 2: torso, 3: hip
  const head = addJoint(r, headPos, 3);
  const neck = addJoint(r, vec2(headPos.x, headPos.y + 15 * s), 2);
  const torso = addJoint(r, vec2(headPos.x, headPos.y + 45 * s), 5);
  const hip = addJoint(r, vec2(headPos.x, headPos.y + 70 * s), 4);
  // 4: left shoulder, 5: left elbow, 6: left hand
  const lShoulder = addJoint(r, vec2(headPos.x - 20 * s, headPos.y + 20 * s), 2);
  const lElbow = addJoint(r, vec2(headPos.x - 35 * s, headPos.y + 40 * s), 1);
  const lHand = addJoint(r, vec2(headPos.x - 45 * s, headPos.y + 58 * s), 1);
  // 7: right shoulder, 8: right elbow, 9: right hand
  const rShoulder = addJoint(r, vec2(headPos.x + 20 * s, headPos.y + 20 * s), 2);
  const rElbow = addJoint(r, vec2(headPos.x + 35 * s, headPos.y + 40 * s), 1);
  const rHand = addJoint(r, vec2(headPos.x + 45 * s, headPos.y + 58 * s), 1);
  // 10: left knee, 11: left foot
  const lKnee = addJoint(r, vec2(headPos.x - 10 * s, headPos.y + 95 * s), 2);
  const lFoot = addJoint(r, vec2(headPos.x - 12 * s, headPos.y + 120 * s), 1);
  // 12: right knee, 13: right foot
  const rKnee = addJoint(r, vec2(headPos.x + 10 * s, headPos.y + 95 * s), 2);
  const rFoot = addJoint(r, vec2(headPos.x + 12 * s, headPos.y + 120 * s), 1);

  // Spine
  addConstraint(r, head, neck, 1);
  addConstraint(r, neck, torso, 1);
  addConstraint(r, torso, hip, 1);
  // Arms
  addConstraint(r, neck, lShoulder, 0.9);
  addConstraint(r, lShoulder, lElbow, 0.8);
  addConstraint(r, lElbow, lHand, 0.7);
  addConstraint(r, neck, rShoulder, 0.9);
  addConstraint(r, rShoulder, rElbow, 0.8);
  addConstraint(r, rElbow, rHand, 0.7);
  // Legs
  addConstraint(r, hip, lKnee, 0.9);
  addConstraint(r, lKnee, lFoot, 0.85);
  addConstraint(r, hip, rKnee, 0.9);
  addConstraint(r, rKnee, rFoot, 0.85);
  // Cross braces (stability)
  addConstraint(r, head, torso, 0.5);
  addConstraint(r, lShoulder, rShoulder, 0.6);
  addConstraint(r, lKnee, rKnee, 0.3);

  return r;
}

export function updateRagdoll(ragdoll: Ragdoll, dt: number, groundY?: number): void {
  // Verlet integration
  for (const joint of ragdoll.joints) {
    if (joint.pinned) continue;
    const vx = (joint.pos.x - joint.prevPos.x) * ragdoll.damping;
    const vy = (joint.pos.y - joint.prevPos.y) * ragdoll.damping;
    joint.prevPos.x = joint.pos.x;
    joint.prevPos.y = joint.pos.y;
    joint.pos.x += vx + ragdoll.gravity.x * dt * dt;
    joint.pos.y += vy + ragdoll.gravity.y * dt * dt;
    // Ground collision
    if (groundY !== undefined && joint.pos.y > groundY) {
      joint.pos.y = groundY;
      joint.prevPos.y = joint.pos.y + vy * 0.3; // bounce
    }
  }
  // Constraint solving
  for (let iter = 0; iter < ragdoll.iterations; iter++) {
    for (const c of ragdoll.constraints) {
      const a = ragdoll.joints[c.a], b = ragdoll.joints[c.b];
      const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.001) continue;
      const diff = (c.length - dist) / dist * c.stiffness;
      const ox = dx * diff * 0.5, oy = dy * diff * 0.5;
      if (!a.pinned) { a.pos.x -= ox; a.pos.y -= oy; }
      if (!b.pinned) { b.pos.x += ox; b.pos.y += oy; }
    }
  }
}

export function applyRagdollImpulse(ragdoll: Ragdoll, jointIdx: number, impulse: Vec2): void {
  const joint = ragdoll.joints[jointIdx];
  if (!joint || joint.pinned) return;
  joint.prevPos.x -= impulse.x;
  joint.prevPos.y -= impulse.y;
}

// ============================================================================
// 11. PROJECTILE ARCS
// ============================================================================

export interface Projectile {
  pos: Vec2;
  vel: Vec2;
  gravity: number;
  drag: number;
  lifetime: number;
  maxLifetime: number;
  active: boolean;
  radius: number;
  trail: Vec2[];
  maxTrail: number;
  onHit?: (proj: Projectile, target: string) => void;
}

export function fireProjectile(
  origin: Vec2,
  velocity: Vec2,
  opts?: Partial<Projectile>
): Projectile {
  return {
    pos: { ...origin },
    vel: { ...velocity },
    gravity: 400,
    drag: 0.01,
    lifetime: 0,
    maxLifetime: 5,
    active: true,
    radius: 4,
    trail: [{ ...origin }],
    maxTrail: 20,
    ...opts,
  };
}

/** Fire at a target position with calculated arc */
export function fireAtTarget(
  origin: Vec2,
  target: Vec2,
  speed: number,
  gravity: number = 400,
  highArc: boolean = false
): Projectile {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Calculate launch angle for parabolic trajectory
  const v2 = speed * speed;
  const v4 = v2 * v2;
  const disc = v4 - gravity * (gravity * dx * dx + 2 * dy * v2);
  let angle: number;
  if (disc < 0) {
    // Can't reach — fire at 45°
    angle = Math.PI / 4 * Math.sign(dx);
  } else {
    const sqrt = Math.sqrt(disc);
    angle = highArc
      ? Math.atan2(v2 + sqrt, gravity * Math.abs(dx))
      : Math.atan2(v2 - sqrt, gravity * Math.abs(dx));
    if (dx < 0) angle = Math.PI - angle;
  }
  return fireProjectile(origin, {
    x: Math.cos(angle) * speed,
    y: -Math.sin(angle) * speed,
  }, { gravity });
}

export function updateProjectile(proj: Projectile, dt: number): void {
  if (!proj.active) return;
  proj.vel.y += proj.gravity * dt;
  proj.vel.x *= 1 - proj.drag;
  proj.vel.y *= 1 - proj.drag;
  proj.pos.x += proj.vel.x * dt;
  proj.pos.y += proj.vel.y * dt;
  proj.lifetime += dt;
  // Trail
  proj.trail.push({ ...proj.pos });
  if (proj.trail.length > proj.maxTrail) proj.trail.shift();
  if (proj.lifetime > proj.maxLifetime) proj.active = false;
}

/** Predict where a projectile will land (for aiming UI) */
export function predictTrajectory(
  origin: Vec2,
  velocity: Vec2,
  gravity: number,
  steps: number = 30,
  dt: number = 0.05,
  groundY?: number
): Vec2[] {
  const points: Vec2[] = [{ ...origin }];
  let px = origin.x, py = origin.y;
  let vx = velocity.x, vy = velocity.y;
  for (let i = 0; i < steps; i++) {
    vy += gravity * dt;
    px += vx * dt;
    py += vy * dt;
    points.push(vec2(px, py));
    if (groundY !== undefined && py >= groundY) break;
  }
  return points;
}

// ============================================================================
// 12. SPATIAL HASH GRID
// ============================================================================

export interface SpatialHash<T extends { pos: Vec2; id: string }> {
  cellSize: number;
  cells: Map<string, T[]>;
}

export function createSpatialHash<T extends { pos: Vec2; id: string }>(cellSize: number): SpatialHash<T> {
  return { cellSize, cells: new Map() };
}

function hashKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function spatialClear<T extends { pos: Vec2; id: string }>(grid: SpatialHash<T>): void {
  grid.cells.clear();
}

export function spatialInsert<T extends { pos: Vec2; id: string }>(grid: SpatialHash<T>, entity: T): void {
  const gx = Math.floor(entity.pos.x / grid.cellSize);
  const gy = Math.floor(entity.pos.y / grid.cellSize);
  const key = hashKey(gx, gy);
  const cell = grid.cells.get(key);
  if (cell) cell.push(entity);
  else grid.cells.set(key, [entity]);
}

export function spatialInsertAll<T extends { pos: Vec2; id: string }>(grid: SpatialHash<T>, entities: T[]): void {
  spatialClear(grid);
  for (const e of entities) spatialInsert(grid, e);
}

/** Query all entities near a position within radius */
export function spatialQuery<T extends { pos: Vec2; id: string }>(
  grid: SpatialHash<T>,
  pos: Vec2,
  radius: number
): T[] {
  const results: T[] = [];
  const minGx = Math.floor((pos.x - radius) / grid.cellSize);
  const maxGx = Math.floor((pos.x + radius) / grid.cellSize);
  const minGy = Math.floor((pos.y - radius) / grid.cellSize);
  const maxGy = Math.floor((pos.y + radius) / grid.cellSize);
  const r2 = radius * radius;
  for (let gx = minGx; gx <= maxGx; gx++) {
    for (let gy = minGy; gy <= maxGy; gy++) {
      const cell = grid.cells.get(hashKey(gx, gy));
      if (!cell) continue;
      for (const e of cell) {
        const dx = e.pos.x - pos.x, dy = e.pos.y - pos.y;
        if (dx * dx + dy * dy <= r2) results.push(e);
      }
    }
  }
  return results;
}

/** Broad-phase: find all potential collision pairs */
export function spatialFindPairs<T extends { pos: Vec2; id: string }>(
  grid: SpatialHash<T>
): Array<[T, T]> {
  const pairs: Array<[T, T]> = [];
  const checked = new Set<string>();
  for (const [, cell] of grid.cells) {
    for (let i = 0; i < cell.length; i++) {
      for (let j = i + 1; j < cell.length; j++) {
        const pairKey = cell[i].id < cell[j].id
          ? `${cell[i].id}|${cell[j].id}`
          : `${cell[j].id}|${cell[i].id}`;
        if (!checked.has(pairKey)) {
          checked.add(pairKey);
          pairs.push([cell[i], cell[j]]);
        }
      }
    }
  }
  return pairs;
}

// ============================================================================
// PHYSICS WORLD — ties all 12 systems together
// ============================================================================

export interface PhysicsWorld {
  bodies: RigidBody[];
  characters: CharacterBody[];
  triggers: TriggerZone[];
  projectiles: Projectile[];
  ragdolls: Ragdoll[];
  rails: Rail[];
  navGrid: NavGrid | null;
  spatialHash: SpatialHash<RigidBody>;
  gravity: Vec2;
  groundY: number;
  dt: number;
}

export function createPhysicsWorld(opts?: Partial<PhysicsWorld>): PhysicsWorld {
  return {
    bodies: [],
    characters: [],
    triggers: [],
    projectiles: [],
    ragdolls: [],
    rails: [],
    navGrid: null,
    spatialHash: createSpatialHash(64),
    gravity: vec2(0, 800),
    groundY: 600,
    dt: 1 / 60,
    ...opts,
  };
}

export function stepPhysicsWorld(world: PhysicsWorld, dt?: number): void {
  const d = dt ?? world.dt;

  // 1. Rigid bodies — integrate + gravity
  for (const body of world.bodies) {
    if (!body.isStatic) {
      applyForce(body, v2scale(world.gravity, body.mass));
    }
    integrateBody(body, d);
    // Ground collision
    if (body.pos.y + ('hh' in body.collider ? body.collider.hh : (body.collider as Circle).r) > world.groundY) {
      const penetration = body.pos.y + ('hh' in body.collider ? body.collider.hh : (body.collider as Circle).r) - world.groundY;
      body.pos.y -= penetration;
      body.vel.y = -body.vel.y * body.restitution;
      if (Math.abs(body.vel.y) < 10) body.vel.y = 0;
    }
  }

  // 2. Spatial hash broad phase
  spatialInsertAll(world.spatialHash, world.bodies);
  const pairs = spatialFindPairs(world.spatialHash);
  for (const [a, b] of pairs) {
    let collision: CollisionResult;
    if ('hw' in a.collider && 'hw' in b.collider) {
      collision = aabbVsAabb(a.collider as AABB, b.collider as AABB);
    } else if ('r' in a.collider && 'r' in b.collider) {
      collision = circleVsCircle(a.collider as Circle, b.collider as Circle);
    } else if ('hw' in a.collider) {
      collision = aabbVsCircle(a.collider as AABB, b.collider as Circle);
    } else {
      collision = aabbVsCircle(b.collider as AABB, a.collider as Circle);
    }
    if (collision.hit) resolveCollision(a, b, collision);
  }

  // 3. Characters — gravity
  for (const ch of world.characters) {
    updateCharacterGravity(ch, d);
    if (ch.pos.y > world.groundY) landOnGround(ch, world.groundY);
  }

  // 4. Projectiles
  for (const proj of world.projectiles) {
    updateProjectile(proj, d);
    if (proj.pos.y > world.groundY) {
      proj.active = false;
      proj.onHit?.(proj, 'ground');
    }
  }
  // Remove dead projectiles
  world.projectiles = world.projectiles.filter(p => p.active);

  // 5. Ragdolls
  for (const ragdoll of world.ragdolls) {
    updateRagdoll(ragdoll, d, world.groundY);
  }

  // 6. Triggers
  const triggerEntities = [
    ...world.characters.map((ch, i) => ({ id: `char_${i}`, pos: ch.pos })),
    ...world.bodies.filter(b => !b.isStatic).map(b => ({ id: b.id, pos: b.pos })),
  ];
  updateTriggers(world.triggers, triggerEntities);
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================
// Developer usage:
//
// import {
//   createPhysicsWorld, stepPhysicsWorld,
//   createRigidBody, createCharacterBody, tryJump,
//   createNavGrid, findPath, smoothPath,
//   createTrigger, createRail, startGrind, updateGrind,
//   buildHumanoidRagdoll, applyRagdollImpulse,
//   fireProjectile, fireAtTarget, predictTrajectory,
//   createIKChain, solveIK, footPlacement,
//   createMomentumBody, accelerate, drift,
//   visionCone,
// } from './kasvillage_world_physics';
//
// const world = createPhysicsWorld({ groundY: 500 });
// // Add bodies, characters, triggers...
// // Every frame:
// stepPhysicsWorld(world, 1/60);
