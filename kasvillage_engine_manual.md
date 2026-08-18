# KasVillage Scene Engine — Developer Manual

*A complete guide to building games that live on the blockchain.*
*Written so anyone from 8th grade up can follow along.*

---

## Part 1: The Big Idea

### What is this engine?

Most game engines are huge programs. You download gigabytes of tools, and your finished game is hundreds of megabytes.

The KasVillage Scene Engine flips that. The whole engine is **one HTML file** (about 295 KB — smaller than one photo from your phone). Your game is not a program at all. Your game is **data**: a JSON text file that describes what exists and what the rules are. The engine reads that description and runs it.

Think of it like this:

- The engine is a **stage crew** that knows how to build any set and run any show.
- Your game is the **script** — just words on paper.
- Hand the same script to the stage crew anywhere in the world, and you get the same show. Exactly the same, every time.

### Why "games are data" matters

Because your game is a small text file, it can live **on the blockchain**. KasVillage publishes game descriptors to the Kaspa network. That gives you three superpowers:

1. **Permanent.** Once published, your game can't be deleted or secretly changed.
2. **Provable.** A fingerprint (called a hash) of your game is signed on-chain. The wallet checks that fingerprint before running your game. If even one letter changed, it refuses to load.
3. **Tiny and free to share.** No app store. No servers. The description *is* the game.

### The one rule that rules everything: determinism

**Same game + same seed = exactly the same result. Always. On every device.**

The engine never uses `Math.random()`, the clock, or anything unpredictable during gameplay. All "randomness" comes from a **seed** — a starting number. Same seed in, same dice rolls out, forever.

Why so strict? Because two players on two phones must be able to agree on what happened without trusting each other. On a blockchain, agreement is everything.

This has one big consequence for you as a developer: **you never add real randomness or real clocks to a game.** The engine gives you seeded randomness instead (more on that later).

---

## Part 2: Your First Game in 10 Minutes

### What you need

- The file `scene_engine.html`
- A text editor (Notepad works)
- A web browser

That's the whole toolchain.

### The smallest possible game

Every game descriptor has this skeleton:

```json
{
  "engine": "scene",
  "meta": { "id": "my_first_game" },
  "nodes": []
}
```

Three required things:

- `"engine": "scene"` — tells the engine "yes, this file is for you."
- `"meta": { "id": ... }` — a unique name for your game.
- `"nodes": []` — the list of everything in your world. Right now: nothing.

### Add a floor and a hero

```json
{
  "engine": "scene",
  "meta": { "id": "my_first_game" },
  "seed": 12345,
  "nodes": [
    {
      "id": "terrain",
      "mesh": "ground",
      "transform": { "pos": [0, 0, 0] }
    },
    {
      "id": "hero",
      "mesh": "person",
      "tags": ["player"],
      "transform": { "pos": [0, 0, 0] }
    }
  ],
  "resources": {
    "meshes": {
      "ground": { "type": "box" },
      "person": { "type": "humanoid" }
    }
  }
}
```

New ideas here:

- **`seed`** — the number that controls all randomness in your game.
- **Nodes** are the *things* in your world. Each one has an `id` (its name), usually a `mesh` (its shape), and a `transform` (where it is).
- **`transform.pos`** is `[x, y, z]`: left/right, up/down, forward/back.
- **`tags`** are labels. The tag `"player"` tells the engine "this is the one the person controls."
- **`resources.meshes`** is your shape library. Nodes point at shapes by name, so ten goblins can share one goblin shape.

### Run it

The easiest way while learning: look at how the **showcase makers** do it. In the project folder there are files like `make_fight_showcase.cjs`. Each one builds a descriptor and injects it into a copy of the engine, producing a `showcase_*.html` you can double-click. Copy one, change the scene, run it with `node`, open the result. That loop — edit, generate, open — is your development cycle.

Inside the KasVillage wallet, games load through **EngineHost**, which feeds your descriptor to the engine automatically (Part 10 covers publishing).

---

## Part 3: Nodes — The Stuff of Your World

A node is anything that exists: the floor, a hero, a door, an invisible trigger zone. Nodes are objects in the `nodes` array, and they can have `children` (nodes attached to nodes — a lantern hanging on a post).

The fields you'll use most:

| Field | What it does |
|---|---|
| `id` | The node's unique name. Other parts of the game refer to it by this. |
| `mesh` | Which shape from `resources.meshes` to use. |
| `transform` | `pos` (position), `rot` (rotation in degrees), sometimes scale. |
| `tags` | Labels like `["player"]` or `["enemy", "enemy.goblin"]`. |
| `stats` | Numbers like `{ "hp": 30, "atk": 5, "spd": 3 }`. |
| `collision` | How it blocks movement. `"mesh"` on your terrain node makes it walkable ground. |
| `children` | Nodes attached to this node. |

### The special node: terrain

A node with `id: "terrain"` (or `collision: "mesh"` with height data) becomes the ground. Characters stand on it, and the foot-placement system (Part 6) reads its slopes.

### Tags are hierarchical

Tags use dots to build families. A node tagged `"enemy.goblin.chief"` matches filters for `"enemy"`, `"enemy.goblin"`, and the full tag. A filter for `"enemy.gob"` does **not** match — only whole words between dots count. This lets one rule ("damage all `enemy`") cover every enemy type you'll ever add.

---

## Part 4: Making Things Look Right

### Meshes

Shapes live in `resources.meshes`. The two families:

- **Simple solids** — `{ "type": "box" }` and friends. Good for crates, walls, floors.
- **`humanoid`** — a full rigged character (Part 6). Options like `bulk`, `limbLen`, `quadruped`, `digitigrade`, and `held` (gives them a sword, staff, or club) reshape it into people, beasts, and monsters.

### Materials and textures

`resources.materials` gives surfaces color and texture; nodes reference a material by name. The engine draws in a deliberate PS1 style — low-poly, chunky, honest. Lean into it.

### Lighting

Add a `lighting` block to your scene and the engine **bakes** light when the scene loads: it calculates, once, how much light lands on each surface, including soft shadows (ambient occlusion). Baking is seeded, so it's deterministic like everything else. Scenes without a `lighting` block skip baking entirely.

---

## Part 5: Making Things Move

### Poses: the heart of animation

A **pose** (also called a clip) is a short script of joint rotations over time. Poses live in `resources.poses`:

```json
"poses": {
  "wave": {
    "dur": 0.6,
    "loop": false,
    "tracks": {
      "armR":  [[0, 0], [0.2, { "rx": -140 }], [0.4, { "rx": -140, "rz": 20 }], [0.6, 0]],
      "handR": [[0, 0], [0.3, { "rz": 25 }], [0.45, { "rz": -25 }], [0.6, 0]]
    }
  }
}
```

Read a track like a timeline. Each entry is `[time_in_seconds, rotation]`:

- `[0, 0]` — at the start, neutral.
- `[0.2, { "rx": -140 }]` — by 0.2 seconds, the right arm has swung up 140 degrees.
- The engine smoothly fills in every frame between your keyframes.

Rotations: `rx` tilts forward/back, `ry` twists, `rz` tilts sideways. A plain number means `rx` only.

### Free mirrored moves

Name a pose `punch`, and the engine gives you `punch_m` for free — the same move mirrored to the other side of the body. Left jab from a right jab, no extra work.

### Events inside poses

Poses can carry `events` that fire at a chosen time — play a sound at the moment of impact, spawn a particle burst at the top of a jump.

### Built-in poses

The engine ships with universal reactions every character can use, no authoring needed: `__jump`, `__land`, `__stumble`, `__flinch`, `__flutter` (for wings). They articulate the whole body — including wrists and ankles: hands reach on a jump, feet flex to absorb a landing, hands rise to cover on a flinch.

### Layers and blending

Animations stack politely:

- A **gait** (walk cycle) runs underneath everything.
- A pose clip **blends over** the gait — but only for the joints it uses. Play a wave while walking, and the legs keep walking.
- **Additive** clips stack on top of other clips (a breathing motion over an idle).
- **Blend trees** cross-fade by speed: standing → walking → running, smoothly, driven by how fast the character actually moves.
- **Root motion** lets an animation itself move the character forward (a lunge that really lunges).

---

## Part 6: The Character Rig

Every `humanoid` mesh is built from named body parts in a parent-child tree:

```
torso
 ├─ head
 ├─ armL ─ foreL ─ handL
 ├─ armR ─ foreR ─ handR      (weapon attaches to foreR)
legL ─ shinL ─ footL
legR ─ shinR ─ footR
```

Rotate a parent and everything below it comes along — turn the torso and the arms, head, and hands all follow. Each joint pivots where a real joint would: shoulders, elbows, **wrists**, hips, knees, **ankles**.

Every part name is a valid track name in your poses. Wrists and ankles are what make animation feel alive: a punch where the fist cocks back and *snaps* at impact reads ten times better than a stiff arm swing. Small joints, big difference.

### Automatic leg intelligence

You get these without writing anything:

- **Gait** — a procedural walk driven by real movement speed. Knees flex, elbows counter-swing, soles stay level with the ground mid-stride. Tune it per node with `gait: { swing, knee, elbow, armSwing }`. Beast options: `quadruped` (four-legged rhythm), `digitigrade` (bent-leg stance like a wolf), `hunch`.
- **Foot IK** — on slopes, the engine solves each leg so feet plant *on* the ground instead of floating or sinking: hips and knees adjust, the pelvis drops toward the lower foot, and each sole pitches to match the slope under it. Airborne characters fade it out automatically.
- **Foot lock** — `footLock` on a node stops feet from sliding during turns.

### Ragdolls

When a character dies (hp hits 0) or you trigger it manually, the rig becomes a physics ragdoll. Every bone — down to hands and feet — becomes a small physics body. Distance links keep the body connected; fold limits stop elbows and knees (and wrists and ankles) from bending backwards. The corpse tumbles, settles, and goes to sleep. It's automatic and it's deterministic.

---

## Part 7: Making Things Happen — Gameplay Systems

### Physics

Solid objects fall, stack, collide, and come to rest. Sleeping bodies wake when pushed. Raycasts ("what's in a straight line from here?") support ground checks and hit detection. All seeded, all deterministic.

### Combat

Attach a `combat` block to a pose and it becomes an attack:

```json
"combat": {
  "phases": { "active": 0.12, "recovery": 0.18 },
  "hitbox": { "forward": 0.95, "height": 1.3, "r": 0.45,
              "damage": 5, "filter": "enemy", "level": "high", "pushback": 3 }
}
```

- **Phases** are fighting-game timing: windup (before `active`), the active window (when the hitbox is live), then recovery (you're vulnerable).
- The **hitbox** is an invisible sphere placed in front of the attacker. `filter` uses tags — this attack only hits things tagged `enemy`.
- `level` ("high"/"mid") interacts with **stances**: a defender in a blocking stance guards attacks at the matching level.

Hit reactions come free: `__flinch` on light hits, `__stumble` on heavy ones, ragdoll on death.

### Behavior trees: giving characters a brain

A behavior tree is a to-do list a character re-reads constantly. Classic guard:

1. Can I see the player? → chase them.
2. Close enough? → attack (with a cooldown between strikes).
3. Otherwise → patrol.

Trees support sequences (do steps in order, resume where you left off), inverters (succeed when a check fails), waits, and cooldown gates. Combine with **state machines** (idle → alert → chase as named states with transition rules) for characters that feel deliberate.

### Prefabs: build once, stamp many

Define a template once in `prefabs`, then instance it:

- Instances inherit everything — type, stats, tags.
- Each instance can **override** anything ("this goblin has 50 hp").
- **Variants** are prefabs based on other prefabs ("goblin_chief" extends "goblin"). Their own values win; everything else inherits, and they still match the base's tag family.

### Areas, alarms, actions

- **Area3D** — an invisible zone that fires when the right thing enters (filtered by tags, of course). Damage floors, healing shrines, door triggers, checkpoints.
- **Alarms** — timers. One-shot ("in 3 seconds, open the gate") or repeating ("every 10 seconds, spawn a wave").
- **Actions** — small instructions (give gold, set a flag, teleport, start a battle) that triggers and events run.

### Turn-based battles

A built-in battle subsystem with two modes:

- **ATB** — active-time battle: bars fill by speed, units act when full.
- **Grid** — tactics mode: flood-fill movement ranges, Manhattan-distance attack ranges, turn order by speed.

Damage uses `atk² / (atk + def)` with a small **seeded** variance — the wobble in damage numbers replays identically from the same seed. Victories pay out `rewards` (xp, gold, items) and can run `onWin`/`onLose` actions.

### Rooms and inventory

- **Rooms** split your game into areas. Each room can carry its own soundscape; `gotoRoom` moves the play space.
- **Inventory** tracks items and equipment, and battle rewards feed it.

### Score, flags, world state

`world.score` and `world.flags` are your scratchpad — quest progress, door-opened switches, currency. Flags persist (Part 9).

---

## Part 8: Sound

Sounds are **synthesized** — described as recipes, not audio files (files would bloat the descriptor and break byte-identical distribution):

```json
"resources": {
  "sounds": {
    "coin": { "type": "tone", "wave": "sine", "freq": 900, "sweep": 400, "dur": 0.12, "vol": 0.4 }
  }
}
```

- `type` — `"tone"` (a pitch) or `"noise"` (a hiss/thump).
- `wave` — sine (smooth), square (buzzy), sawtooth (harsh), triangle (soft).
- `freq` / `sweep` — starting pitch and how it slides (negative = falling).
- `dur`, `vol`, `drive` (distortion), `filter` (noise brightness).
- Layer up to 6 of these in one `layers` array for rich sounds.

Built-ins cover the basics: `__hit`, `__kick`, `__block`, `__step`, `__jump`, `__land`, `__thud`, `__boom`.

**Safety caps** (the engine enforces these at load; break one and the scene is rejected with a clear error): at most 32 custom sounds; 6 layers each; duration ≤ 2s; volume ≤ 1.5; frequency 20–8000 Hz; every number must be a real, finite number. This is armor: a malicious descriptor can't screech at max volume or stall the audio system. Rooms can also carry ambient **soundscapes**.

---

## Part 9: Input, Saving, and Determinism (The Serious Parts)

### Touch input

Set the scheme in your descriptor:

```json
"input": { "scheme": "tap" }
```

- **tap** — tap to move, tap things to interact. Best for boards and adventures.
- **stroke** — draw gestures. A $1-style recognizer turns strokes into commands.
- **button** — on-screen buttons. Best for action games; they fire in ~22ms, close to a real controller.

Design tip from real measurements: on-screen buttons and continuous-heading movement feel great on phones; rapid tap-to-move is limited by how fast heading updates (about 7 per second), not by latency. Give mobile players generous decision windows — the validator will warn you if yours look too tight.

### Saving

Persistence is **on-chain only** — there is no localStorage. A game that wants to save state must declare the `persist` permission, and saves ride KasVillage's payload rail. The save system also refuses dangerous keys (no `__proto__` tricks) and never saves engine internals (anything starting with `_`) or session data.

### Permissions

Your descriptor declares what it needs, and only these four exist:

- `identity` — read the player's avatar identity
- `stats` — read/report player stats (rides the dual-signed KVSTAT3 rail)
- `balance` — read wallet balance
- `persist` — save state on-chain

Unknown permissions are rejected. The player's wallet grants only what's declared.

### Determinism: your responsibilities

The engine's simulation is proven pure — no `Math.random`, `Date.now`, or `performance.now` anywhere in the tick, verified by an automated harness. Your part:

1. Always set a `seed`.
2. Never wish for real time or real randomness — use alarms and seeded variance.
3. Node order matters: the same nodes in a different order can simulate differently. Keep your descriptor stable; don't shuffle it between versions.

### Validation: the bouncer at the door

Before any scene runs, `validate()` checks it. Rejections include:

- Wrong or missing skeleton (`engine`, `meta.id`, `nodes`)
- Too many nodes (512 default; raisable via a `compliance` block)
- **Forbidden keys** — a scene may *mention* words like "script" in text, but may never use `script`, `eval`, `fetch`, `url`, `src`, `href`, `onload`, `html`, `endpoint`, `__proto__`, `constructor`, or `prototype` as **keys**. Keys are what could smuggle behavior; the engine bans them at any depth.
- Unknown permissions, NaN/Infinity numbers, oversized meshes, over-budget particle emitters, out-of-range sound values

The philosophy: a descriptor downloaded from a blockchain is a stranger. The engine treats every scene as potentially hostile and runs it anyway — safely — because the data physically cannot express anything dangerous.

### Debug console

Add `"debug": true` and a developer console unlocks in-game: `spawn` prefabs, `tp` (teleport), `hp`, `gold`, `cvar` to tweak physics live. Without the flag it doesn't exist — players can't cheat with it. Ship with debug off.

---

## Part 10: Publishing to KasVillage

The full journey of your game:

**1. Author** — write the descriptor, iterate with a showcase-style HTML.

**2. Publish (Workspace → Games).** Costs about 6.2 KAS + fees: a 5 KAS pledge (yours, staked — skin in the game), 1 KAS announce (burned), ~0.2 KAS for the descriptor chunks. At publish time the wallet computes the **SHA-256 fingerprint** of your game and signs it into the on-chain record along with the name and category. Your descriptor itself is chunked and published on-chain.

**3. Discovery.** Your game appears in the Entertainment Center's DApps directory, ranked with pledge-gated visibility.

**4. Play.** When someone taps your game, the wallet fetches the descriptor and hands it to **EngineHost** with the on-chain fingerprint. EngineHost re-hashes what it fetched (whitespace-tolerantly — pretty-printing won't break it, but key order must match the published object) and compares. **Match** → the engine's validator takes over, then the game boots inside the wallet. **Mismatch** → a warning screen, and the game does not load. Nobody can swap your game's content after publishing.

**5. Results.** Game outcomes surface through the host protocol and ride the dual-signed stat rail — provable match results.

One honest note on multiplayer: **turn-based** works today (moves as on-chain records or relay messages through TownHall). **Real-time** netcode does not exist yet. Design for turns, or single-player.

---

## Part 11: Testing Like the Engine's Own Developers

The engine ships with headless test harnesses (they run the engine in Node, no browser window). Run them after any engine change; steal their patterns for your own game tests.

- **`scene_engine_test.cjs`** — 122 assertions across physics, tags, alarms, prefabs, areas, behavior trees, rigs, animation, ragdolls, lighting, console, and joint anatomy. All green or something's wrong.
- **`smoke_showcases.cjs`** — regenerates every showcase from its maker script, boots each one headlessly for 30 frames, and asserts it actually draws. If your change breaks any of 21 game types, this catches it.
- **`determinism_test.cjs`** — runs the same scene twice from the same seed for 600 ticks and demands bit-identical state; verifies the sim never touches real randomness or clocks. Cross-device: `--emit determinism_ref.json` on one machine, `--check determinism_ref.json` on another.

The discipline that keeps this codebase healthy, in one line: **change → build → test → smoke → commit.** Never skip the middle.

---

## Part 12: Quick Reference

### Descriptor skeleton (everything optional except the first three)

```json
{
  "engine": "scene",
  "meta": { "id": "..." },
  "nodes": [],
  "seed": 12345,
  "debug": false,
  "permissions": ["persist"],
  "compliance": { "maxNodes": 512 },
  "input": { "scheme": "tap" },
  "lighting": {},
  "rooms": {},
  "prefabs": {},
  "resources": { "meshes": {}, "materials": {}, "textures": {}, "poses": {}, "sounds": {}, "stances": {} }
}
```

### Rig part names (all poseable)

`torso, head, armL, armR, foreL, foreR, handL, handR, legL, legR, shinL, shinR, footL, footR, weapon` (+ `wingL/wingR`, `horn`, tail segments on creatures that have them)

### Built-in poses
`__jump, __land, __stumble, __flinch, __flutter` — and any pose `x` gives you `x_m` mirrored free.

### Built-in sounds
`__hit, __kick, __block, __step, __jump, __land, __thud, __boom`

### Hard limits (validator-enforced)
512 nodes (default) · 32 sounds, 6 layers, 2s, vol 1.5, 20–8000 Hz · no forbidden keys at any depth · 4 permissions only · finite numbers everywhere

### What the engine does NOT have (honest edges)
- Real-time multiplayer netcode (turn-based via chain/relay works)
- Audio file playback (synthesis only, by design)
- Skinned/imported 3D models (procedural rigs only, by design)
- A visual editor (descriptors are hand-authored or generated by scripts)

---

*Manual current as of engine build 295 KB, tests at 122 green, August 2026.*
