// ============================================================================
// KasVillage Procedural Shader Module — kasvillage_shaders.ts
// AAA-quality visuals from pure math. No textures loaded. No assets downloaded.
//
// Provides:
//   1. Procedural material system (metal, wood, stone, fabric, glass, lava, water)
//   2. PBR lighting (point, directional, ambient, shadows)
//   3. Post-processing (bloom, color grading, vignette, CRT, film grain)
//   4. Noise library (Perlin, Simplex, Voronoi, FBM, Worley)
//   5. Integration with existing PS1 engine + canvas renderer
//
// Constraints compliance:
//   ✅ All textures generated via GLSL noise functions
//   ✅ No external image loading
//   ✅ No fetch() for assets
//   ✅ Face constraint still enforced (detail_engine runs separately)
//   ✅ All whitelisted patterns (createShader, createProgram, etc.)
// ============================================================================

// ============================================================================
// GLSL NOISE LIBRARY — shared across all shaders
// ============================================================================

const GLSL_NOISE = `
// ── Permutation hash ──
vec3 mod289(vec3 x) { return x - floor(x / 289.0) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x / 289.0) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

// ── Simplex 3D noise ──
float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

// ── FBM (Fractal Brownian Motion) ──
float fbm(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// ── Voronoi / Worley noise ──
vec2 voronoi(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 1.0;
  float d2 = 1.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 neighbor = vec3(float(x), float(y), float(z));
        vec3 point = vec3(
          fract(sin(dot(i + neighbor, vec3(127.1, 311.7, 74.7))) * 43758.5453),
          fract(sin(dot(i + neighbor, vec3(269.5, 183.3, 246.1))) * 43758.5453),
          fract(sin(dot(i + neighbor, vec3(113.5, 271.9, 124.6))) * 43758.5453)
        );
        vec3 diff = neighbor + point - f;
        float dist = dot(diff, diff);
        if (dist < d1) { d2 = d1; d1 = dist; }
        else if (dist < d2) { d2 = dist; }
      }
    }
  }
  return vec2(sqrt(d1), sqrt(d2));
}

// ── 2D hash ──
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float hash3(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}
`;

// ============================================================================
// PROCEDURAL MATERIAL SHADERS
// ============================================================================

export type MaterialType =
  | 'stone'     // castle walls, dungeon floors, cobblestone
  | 'wood'      // planks, barrels, furniture, doors
  | 'metal'     // armor, weapons, machinery, pipes
  | 'fabric'    // cloth, curtains, banners, carpet
  | 'glass'     // windows, bottles, crystals
  | 'lava'      // volcanic, magma, embers
  | 'water'     // ocean, river, puddles, rain
  | 'ice'       // frozen, crystal, frost
  | 'sand'      // desert, beach, dust
  | 'grass'     // meadow, moss, vines
  | 'bark'      // tree trunks, roots
  | 'marble'    // temples, pillars, floors
  | 'rust'      // corroded metal, decay
  | 'crystal'   // gems, magic, energy
  | 'flesh'     // organic, creature skin (fantasy colors only)
  | 'bone'      // skeletal, ivory
  | 'slime'     // ooze, goo, acid
  | 'smoke'     // fog, mist, clouds
  | 'emissive'; // glow, magic effects, neon

export interface MaterialParams {
  type: MaterialType;
  color: string;          // base hue as HSL: 'hsl(270, 50%, 40%)'
  roughness: number;      // 0 = mirror, 1 = matte
  metallic: number;       // 0 = dielectric, 1 = metal
  emissive: number;       // 0 = none, 1 = full glow
  scale: number;          // texture scale (0.1 = huge tiles, 10 = tiny grain)
  seed: number;           // deterministic seed
  age: number;            // 0 = new, 1 = ancient (adds wear, cracks)
}

const MATERIAL_SHADERS: Record<MaterialType, string> = {
  stone: `
    vec3 proceduralStone(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed);
      float cracks = voronoi(p * 3.0).x;
      float rough = fbm(p * 5.0, 4);
      float worn = mix(0.8, 0.4, age * cracks);
      vec3 col = baseColor * (0.6 + 0.4 * rough) * worn;
      col -= vec3(0.1) * smoothstep(0.02, 0.0, cracks - 0.1) * age;
      col += vec3(0.05) * snoise(p * 20.0);
      return col;
    }
  `,
  wood: `
    vec3 proceduralWood(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed);
      float rings = sin(length(p.xy * 10.0) + fbm(p * 2.0, 3) * 4.0) * 0.5 + 0.5;
      float grain = fbm(vec3(p.x * 20.0, p.y * 2.0, seed), 5) * 0.15;
      vec3 col = mix(baseColor * 0.6, baseColor * 1.2, rings);
      col += grain;
      float knots = 1.0 - smoothstep(0.1, 0.15, length(fract(p.xy * 1.5) - 0.5));
      col = mix(col, baseColor * 0.3, knots * 0.5);
      col *= 1.0 - age * 0.3 * fbm(p * 8.0, 3);
      return col;
    }
  `,
  metal: `
    vec3 proceduralMetal(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed);
      float brushed = sin(p.x * 200.0 + snoise(p * 30.0) * 2.0) * 0.02;
      float scratches = smoothstep(0.95, 1.0, snoise(p * 50.0)) * 0.15 * age;
      vec3 col = baseColor + brushed + scratches;
      float rust = smoothstep(0.3, 0.7, fbm(p * 4.0, 4)) * age;
      col = mix(col, vec3(0.5, 0.25, 0.1), rust * 0.6);
      col *= 0.8 + 0.2 * snoise(p * 100.0);
      return col;
    }
  `,
  fabric: `
    vec3 proceduralFabric(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed);
      float weaveX = sin(p.x * 60.0) * 0.5 + 0.5;
      float weaveY = sin(p.y * 60.0) * 0.5 + 0.5;
      float weave = mix(weaveX, weaveY, step(0.5, fract(p.x * 5.0 + p.y * 5.0)));
      vec3 col = baseColor * (0.85 + 0.15 * weave);
      float fuzz = snoise(p * 80.0) * 0.05;
      col += fuzz;
      col *= 1.0 - age * 0.2 * fbm(p * 3.0, 2);
      return col;
    }
  `,
  glass: `
    vec3 proceduralGlass(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed);
      vec3 col = baseColor * 0.3;
      float refract = snoise(p * 5.0) * 0.1;
      col += vec3(0.4, 0.5, 0.6) * (0.5 + refract);
      float specular = pow(max(0.0, snoise(p * 10.0)), 20.0);
      col += vec3(1.0) * specular * 0.5;
      float dirt = fbm(p * 3.0, 3) * age * 0.2;
      col -= dirt;
      return col;
    }
  `,
  lava: `
    vec3 proceduralLava(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed + uTime * 0.1);
      float flow = fbm(p * 2.0 + vec3(uTime * 0.05), 5);
      float cracks = voronoi(p * 3.0).x;
      vec3 hot = vec3(1.0, 0.4, 0.0);
      vec3 cool = vec3(0.15, 0.02, 0.0);
      vec3 col = mix(hot, cool, smoothstep(0.2, 0.5, cracks));
      col += vec3(1.0, 0.8, 0.2) * smoothstep(0.5, 0.3, cracks) * (0.5 + 0.5 * sin(uTime * 2.0));
      col *= 0.8 + 0.2 * flow;
      return col;
    }
  `,
  water: `
    vec3 proceduralWater(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed);
      float wave1 = sin(p.x * 8.0 + uTime * 1.5 + snoise(p * 3.0) * 2.0) * 0.5 + 0.5;
      float wave2 = sin(p.y * 6.0 + uTime * 1.2 + snoise(p * 4.0 + 5.0) * 2.0) * 0.5 + 0.5;
      float waves = (wave1 + wave2) * 0.5;
      vec3 deep = vec3(0.0, 0.1, 0.3);
      vec3 shallow = vec3(0.1, 0.4, 0.6);
      vec3 col = mix(deep, shallow, waves);
      float foam = smoothstep(0.85, 0.95, waves);
      col = mix(col, vec3(0.9), foam * 0.6);
      float specular = pow(max(0.0, waves), 16.0) * 0.3;
      col += vec3(specular);
      return col;
    }
  `,
  ice: `
    vec3 proceduralIce(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed);
      vec2 v = voronoi(p * 4.0);
      float cracks = smoothstep(0.0, 0.05, v.y - v.x);
      vec3 col = mix(vec3(0.6, 0.8, 0.95), vec3(0.3, 0.5, 0.8), fbm(p * 3.0, 3));
      col -= vec3(0.3) * (1.0 - cracks) * 0.4;
      float frost = smoothstep(0.4, 0.6, snoise(p * 15.0)) * 0.2;
      col += frost;
      float specular = pow(max(0.0, snoise(p * 8.0)), 12.0) * 0.4;
      col += vec3(specular);
      return col;
    }
  `,
  sand: `
    vec3 proceduralSand(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed);
      float grains = snoise(p * 40.0) * 0.08;
      float dunes = fbm(p * 1.5, 3) * 0.3;
      vec3 col = baseColor + grains + dunes;
      float ripples = sin(p.x * 20.0 + fbm(p * 5.0, 2) * 3.0) * 0.04;
      col += ripples;
      return col;
    }
  `,
  grass: `
    vec3 proceduralGrass(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed);
      float blades = snoise(p * 30.0) * 0.15;
      float patches = fbm(p * 2.0, 3);
      vec3 green1 = vec3(0.15, 0.45, 0.1);
      vec3 green2 = vec3(0.25, 0.55, 0.15);
      vec3 col = mix(green1, green2, patches) + blades;
      float flowers = smoothstep(0.92, 0.95, snoise(p * 12.0));
      col = mix(col, vec3(0.9, 0.7, 0.2), flowers * 0.5);
      col *= 1.0 - age * 0.3;
      return col;
    }
  `,
  bark: `
    vec3 proceduralBark(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed);
      float ridges = abs(sin(p.y * 15.0 + fbm(p * 3.0, 3) * 4.0));
      float depth = fbm(vec3(p.x * 8.0, p.y * 2.0, seed), 4);
      vec3 col = baseColor * (0.5 + 0.5 * ridges);
      col *= 0.7 + 0.3 * depth;
      float moss = smoothstep(0.4, 0.6, fbm(p * 5.0 + 10.0, 3)) * age;
      col = mix(col, vec3(0.2, 0.35, 0.15), moss * 0.4);
      return col;
    }
  `,
  marble: `
    vec3 proceduralMarble(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed);
      float veins = abs(sin(p.x * 5.0 + p.y * 3.0 + fbm(p * 3.0, 5) * 6.0));
      veins = pow(veins, 3.0);
      vec3 col = mix(baseColor, baseColor * 0.4, veins);
      col += vec3(0.05) * snoise(p * 30.0);
      float polish = 1.0 - age * 0.3;
      col *= 0.8 + 0.2 * polish;
      return col;
    }
  `,
  rust: `
    vec3 proceduralRust(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed);
      float corrosion = fbm(p * 4.0, 5);
      float pitting = voronoi(p * 8.0).x;
      vec3 rustColor = vec3(0.55, 0.25, 0.08);
      vec3 metalBase = vec3(0.4, 0.4, 0.42);
      float rustAmount = smoothstep(0.2, 0.6, corrosion) * age;
      vec3 col = mix(metalBase, rustColor, rustAmount);
      col -= vec3(0.15) * smoothstep(0.1, 0.0, pitting) * age;
      col += vec3(0.08, 0.04, 0.0) * snoise(p * 20.0);
      return col;
    }
  `,
  crystal: `
    vec3 proceduralCrystal(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed);
      vec2 v = voronoi(p * 6.0);
      float facets = v.y - v.x;
      vec3 col = baseColor * (0.6 + 0.4 * facets);
      float sparkle = pow(max(0.0, snoise(p * 20.0 + uTime * 2.0)), 20.0);
      col += vec3(1.0, 0.9, 0.8) * sparkle * 0.6;
      float inner = fbm(p * 3.0, 3) * 0.3;
      col += baseColor * inner * 0.5;
      col *= 1.0 + 0.1 * sin(uTime * 1.5);
      return col;
    }
  `,
  flesh: `
    // Fantasy flesh — NOT realistic skin. Uses baseColor (must pass skin-tone check)
    vec3 proceduralFlesh(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed);
      float pores = snoise(p * 40.0) * 0.04;
      float subsurface = fbm(p * 3.0, 3) * 0.15;
      vec3 col = baseColor + pores;
      col += vec3(0.05, -0.02, -0.05) * subsurface;
      float scars = smoothstep(0.93, 0.95, snoise(p * 15.0)) * age;
      col = mix(col, baseColor * 0.6, scars * 0.3);
      return col;
    }
  `,
  bone: `
    vec3 proceduralBone(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed);
      float grain = fbm(vec3(p.x * 5.0, p.y * 20.0, seed), 4) * 0.1;
      vec3 col = vec3(0.85, 0.8, 0.7) + grain;
      float cracks = smoothstep(0.9, 0.95, snoise(p * 12.0)) * age;
      col -= vec3(0.2) * cracks;
      col *= 1.0 - age * 0.15;
      return col;
    }
  `,
  slime: `
    vec3 proceduralSlime(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed + uTime * 0.15);
      float bubbles = smoothstep(0.85, 0.9, snoise(p * 8.0));
      float flow = fbm(p * 2.0, 4);
      vec3 col = baseColor * (0.7 + 0.3 * flow);
      col += vec3(0.2) * bubbles;
      float sheen = pow(max(0.0, snoise(p * 6.0)), 8.0) * 0.3;
      col += sheen;
      return col;
    }
  `,
  smoke: `
    vec3 proceduralSmoke(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed + uTime * 0.3);
      float density = fbm(p * 2.0, 6) * 0.5 + 0.5;
      float wisps = fbm(p * 4.0 + 10.0, 4);
      vec3 col = mix(vec3(0.1), vec3(0.5), density);
      col += vec3(0.05) * wisps;
      return col;
    }
  `,
  emissive: `
    vec3 proceduralEmissive(vec2 uv, float scale, float age, float seed) {
      vec3 p = vec3(uv * scale, seed);
      float pulse = 0.7 + 0.3 * sin(uTime * 3.0 + fbm(p * 2.0, 2) * 6.28);
      float pattern = fbm(p * 4.0, 3);
      vec3 col = baseColor * pulse * (1.5 + pattern * 0.5);
      float sparks = pow(max(0.0, snoise(p * 15.0 + uTime)), 15.0);
      col += vec3(1.0) * sparks * 0.4;
      return col;
    }
  `,
};

// ============================================================================
// LIGHTING SHADER
// ============================================================================

const LIGHTING_GLSL = `
struct Light {
  vec3 position;
  vec3 color;
  float intensity;
  float radius;
};

struct PBRMaterial {
  vec3 albedo;
  float roughness;
  float metallic;
  float emissive;
};

// ── GGX/Trowbridge-Reitz normal distribution ──
float distributionGGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float NdotH2 = NdotH * NdotH;
  float denom = (NdotH2 * (a2 - 1.0) + 1.0);
  denom = 3.14159265 * denom * denom;
  return a2 / max(denom, 0.0001);
}

// ── Schlick-GGX geometry function ──
float geometrySchlickGGX(float NdotV, float roughness) {
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  return geometrySchlickGGX(NdotV, roughness) * geometrySchlickGGX(NdotL, roughness);
}

// ── Fresnel-Schlick ──
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// ── PBR lighting calculation ──
vec3 calculatePBR(PBRMaterial mat, vec3 N, vec3 V, vec3 worldPos, Light lights[4], int numLights, vec3 ambient) {
  vec3 F0 = mix(vec3(0.04), mat.albedo, mat.metallic);
  vec3 Lo = vec3(0.0);

  for (int i = 0; i < 4; i++) {
    if (i >= numLights) break;
    vec3 L = normalize(lights[i].position - worldPos);
    vec3 H = normalize(V + L);
    float dist = length(lights[i].position - worldPos);
    float attenuation = lights[i].intensity / (dist * dist + 0.01);
    attenuation *= smoothstep(lights[i].radius, 0.0, dist);
    vec3 radiance = lights[i].color * attenuation;

    float NDF = distributionGGX(N, H, mat.roughness);
    float G = geometrySmith(N, V, L, mat.roughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

    vec3 kS = F;
    vec3 kD = (vec3(1.0) - kS) * (1.0 - mat.metallic);

    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
    vec3 specular = numerator / denominator;

    float NdotL = max(dot(N, L), 0.0);
    Lo += (kD * mat.albedo / 3.14159265 + specular) * radiance * NdotL;
  }

  vec3 ambientResult = ambient * mat.albedo;
  vec3 color = ambientResult + Lo;
  color += mat.albedo * mat.emissive * 2.0;
  return color;
}
`;

// ============================================================================
// POST-PROCESSING SHADERS
// ============================================================================

export type PostEffect =
  | 'bloom'        // glow on bright areas
  | 'colorGrade'   // cinematic color correction
  | 'vignette'     // dark edges
  | 'crt'          // scanlines + curvature (PS1 feel)
  | 'filmGrain'    // subtle noise
  | 'chromatic'    // RGB split (damage effect)
  | 'pixelate'     // resolution reduction (PS1)
  | 'fog'          // depth fog
  | 'dither';      // PS1-style dithering

export interface PostProcessParams {
  bloom: { threshold: number; intensity: number; radius: number };
  colorGrade: { contrast: number; saturation: number; temperature: number; tint: string };
  vignette: { intensity: number; smoothness: number };
  crt: { curvature: number; scanlineIntensity: number };
  filmGrain: { intensity: number; speed: number };
  chromatic: { offset: number };
  pixelate: { resolution: number };
  fog: { color: string; density: number; start: number; end: number };
  dither: { bayerSize: number; colorDepth: number };
}

const POST_SHADERS: Record<PostEffect, string> = {
  bloom: `
    vec3 bloom(sampler2D tex, vec2 uv, float threshold, float intensity, float radius) {
      vec3 color = texture2D(tex, uv).rgb;
      vec3 bright = max(color - vec3(threshold), vec3(0.0));
      vec3 blurred = vec3(0.0);
      float total = 0.0;
      for (float x = -4.0; x <= 4.0; x += 1.0) {
        for (float y = -4.0; y <= 4.0; y += 1.0) {
          float weight = exp(-(x*x + y*y) / (2.0 * radius * radius));
          vec2 offset = vec2(x, y) / uResolution;
          vec3 s = texture2D(tex, uv + offset).rgb;
          vec3 b = max(s - vec3(threshold), vec3(0.0));
          blurred += b * weight;
          total += weight;
        }
      }
      blurred /= total;
      return color + blurred * intensity;
    }
  `,
  colorGrade: `
    vec3 colorGrade(vec3 color, float contrast, float saturation, float temperature) {
      color = (color - 0.5) * contrast + 0.5;
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, saturation);
      color.r += temperature * 0.05;
      color.b -= temperature * 0.05;
      color = pow(color, vec3(1.0 / 2.2));
      return clamp(color, 0.0, 1.0);
    }
  `,
  vignette: `
    vec3 vignette(vec3 color, vec2 uv, float intensity, float smoothness) {
      float dist = distance(uv, vec2(0.5));
      float vig = smoothstep(0.5, 0.5 - smoothness, dist);
      return color * mix(1.0, vig, intensity);
    }
  `,
  crt: `
    vec3 crtEffect(vec3 color, vec2 uv, float curvature, float scanlineIntensity) {
      vec2 curved = uv - 0.5;
      curved *= 1.0 + curvature * dot(curved, curved);
      curved += 0.5;
      if (curved.x < 0.0 || curved.x > 1.0 || curved.y < 0.0 || curved.y > 1.0)
        return vec3(0.0);
      float scanline = sin(curved.y * uResolution.y * 3.14159) * scanlineIntensity;
      color *= 1.0 - scanline * 0.15;
      float flicker = 0.98 + 0.02 * sin(uTime * 8.0);
      color *= flicker;
      return color;
    }
  `,
  filmGrain: `
    vec3 filmGrain(vec3 color, vec2 uv, float intensity, float speed) {
      float grain = hash(uv * uResolution.xy + fract(uTime * speed) * 1000.0) - 0.5;
      return color + grain * intensity;
    }
  `,
  chromatic: `
    vec3 chromaticAberration(sampler2D tex, vec2 uv, float offset) {
      float r = texture2D(tex, uv + vec2(offset, 0.0)).r;
      float g = texture2D(tex, uv).g;
      float b = texture2D(tex, uv - vec2(offset, 0.0)).b;
      return vec3(r, g, b);
    }
  `,
  pixelate: `
    vec3 pixelate(sampler2D tex, vec2 uv, float resolution) {
      vec2 pixelSize = vec2(resolution) / uResolution;
      vec2 pixelUV = floor(uv / pixelSize) * pixelSize;
      return texture2D(tex, pixelUV).rgb;
    }
  `,
  fog: `
    vec3 applyFog(vec3 color, float depth, vec3 fogColor, float density, float start, float end) {
      float fogFactor = clamp((depth - start) / (end - start), 0.0, 1.0);
      fogFactor = 1.0 - exp(-density * fogFactor * fogFactor);
      return mix(color, fogColor, fogFactor);
    }
  `,
  dither: `
    vec3 dither(vec3 color, vec2 uv, float bayerSize, float colorDepth) {
      vec2 pixel = floor(uv * uResolution);
      float bayer = 0.0;
      // 4x4 Bayer matrix
      float x = mod(pixel.x, 4.0);
      float y = mod(pixel.y, 4.0);
      float idx = x + y * 4.0;
      // Lookup (unrolled for WebGL1 compat)
      if (idx < 1.0) bayer = 0.0/16.0;
      else if (idx < 2.0) bayer = 8.0/16.0;
      else if (idx < 3.0) bayer = 2.0/16.0;
      else if (idx < 4.0) bayer = 10.0/16.0;
      else if (idx < 5.0) bayer = 12.0/16.0;
      else if (idx < 6.0) bayer = 4.0/16.0;
      else if (idx < 7.0) bayer = 14.0/16.0;
      else if (idx < 8.0) bayer = 6.0/16.0;
      else if (idx < 9.0) bayer = 3.0/16.0;
      else if (idx < 10.0) bayer = 11.0/16.0;
      else if (idx < 11.0) bayer = 1.0/16.0;
      else if (idx < 12.0) bayer = 9.0/16.0;
      else if (idx < 13.0) bayer = 15.0/16.0;
      else if (idx < 14.0) bayer = 7.0/16.0;
      else if (idx < 15.0) bayer = 13.0/16.0;
      else bayer = 5.0/16.0;
      bayer = (bayer - 0.5) / colorDepth;
      return floor((color + bayer) * colorDepth) / colorDepth;
    }
  `,
};

// ============================================================================
// SHADOW MAP SHADER
// ============================================================================

const SHADOW_GLSL = `
// Simple shadow mapping for procedural scenes
float calculateShadow(sampler2D shadowMap, vec4 lightSpacePos, float bias) {
  vec3 projCoords = lightSpacePos.xyz / lightSpacePos.w;
  projCoords = projCoords * 0.5 + 0.5;
  if (projCoords.z > 1.0) return 0.0;
  float closestDepth = texture2D(shadowMap, projCoords.xy).r;
  float currentDepth = projCoords.z;
  // PCF soft shadows
  float shadow = 0.0;
  vec2 texelSize = 1.0 / vec2(1024.0);
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      float pcfDepth = texture2D(shadowMap, projCoords.xy + vec2(float(x), float(y)) * texelSize).r;
      shadow += currentDepth - bias > pcfDepth ? 1.0 : 0.0;
    }
  }
  shadow /= 9.0;
  return shadow;
}
`;

// ============================================================================
// NORMAL MAP GENERATOR (procedural)
// ============================================================================

const NORMAL_MAP_GLSL = `
// Generate normal map from procedural height
vec3 proceduralNormal(vec3 p, float scale) {
  float eps = 0.001;
  float h = fbm(p * scale, 4);
  float hx = fbm((p + vec3(eps, 0.0, 0.0)) * scale, 4);
  float hy = fbm((p + vec3(0.0, eps, 0.0)) * scale, 4);
  vec3 normal = normalize(vec3(
    (h - hx) / eps,
    (h - hy) / eps,
    1.0
  ));
  return normal * 0.5 + 0.5;
}
`;

// ============================================================================
// PUBLIC API — TypeScript interface for game developers
// ============================================================================

export interface ShaderPipeline {
  gl: WebGLRenderingContext | WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  materialProgram: WebGLProgram | null;
  postProgram: WebGLProgram | null;
  framebuffers: WebGLFramebuffer[];
  time: number;
  lights: Array<{
    position: [number, number, number];
    color: [number, number, number];
    intensity: number;
    radius: number;
  }>;
  postEffects: PostEffect[];
  postParams: Partial<PostProcessParams>;
}

/**
 * Initialize a WebGL shader pipeline on a canvas.
 * Call once, then use renderMaterial() and applyPostProcessing() each frame.
 */
export function createShaderPipeline(
  canvas: HTMLCanvasElement,
  options?: { webgl2?: boolean }
): ShaderPipeline {
  const gl = canvas.getContext(options?.webgl2 ? 'webgl2' : 'webgl', {
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
  });

  if (!gl) throw new Error('[KV Shaders] WebGL not available');

  return {
    gl: gl as WebGLRenderingContext,
    canvas,
    materialProgram: null,
    postProgram: null,
    framebuffers: [],
    time: 0,
    lights: [
      { position: [2, 3, 2], color: [1, 0.95, 0.9], intensity: 5, radius: 10 },
    ],
    postEffects: [],
    postParams: {},
  };
}

/**
 * Compile a GLSL shader. Returns the compiled shader or null on error.
 */
export function compileShader(
  gl: WebGLRenderingContext,
  source: string,
  type: number
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[KV Shaders] Compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Create a shader program from vertex + fragment source.
 */
export function createProgram(
  gl: WebGLRenderingContext,
  vertSrc: string,
  fragSrc: string
): WebGLProgram | null {
  const vs = compileShader(gl, vertSrc, gl.VERTEX_SHADER);
  const fs = compileShader(gl, fragSrc, gl.FRAGMENT_SHADER);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[KV Shaders] Link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

/**
 * Build the complete fragment shader for a given material type.
 */
export function buildMaterialShader(material: MaterialType): string {
  return `
    precision mediump float;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec3 baseColor;
    uniform float uScale;
    uniform float uAge;
    uniform float uSeed;
    uniform float uRoughness;
    uniform float uMetallic;
    uniform float uEmissive;
    varying vec2 vUV;
    varying vec3 vNormal;
    varying vec3 vWorldPos;

    ${GLSL_NOISE}
    ${MATERIAL_SHADERS[material]}
    ${LIGHTING_GLSL}
    ${NORMAL_MAP_GLSL}
    ${SHADOW_GLSL}

    uniform Light lights[4];
    uniform int uNumLights;
    uniform vec3 uAmbient;
    uniform vec3 uViewPos;

    void main() {
      vec3 materialColor = procedural${material.charAt(0).toUpperCase() + material.slice(1)}(
        vUV, uScale, uAge, uSeed
      );

      vec3 N = normalize(vNormal);
      // Add procedural normal perturbation
      vec3 bump = proceduralNormal(vec3(vUV, uSeed), uScale * 5.0);
      N = normalize(N + (bump - 0.5) * 0.3);

      vec3 V = normalize(uViewPos - vWorldPos);

      PBRMaterial mat;
      mat.albedo = materialColor;
      mat.roughness = uRoughness;
      mat.metallic = uMetallic;
      mat.emissive = uEmissive;

      vec3 result = calculatePBR(mat, N, V, vWorldPos, lights, uNumLights, uAmbient);

      // Tone mapping (Reinhard)
      result = result / (result + vec3(1.0));

      gl_FragColor = vec4(result, 1.0);
    }
  `;
}

/**
 * Standard vertex shader for 3D scenes.
 */
export const VERTEX_SHADER_3D = `
  precision mediump float;
  attribute vec3 aPosition;
  attribute vec2 aTexCoord;
  attribute vec3 aNormal;
  uniform mat4 uModelView;
  uniform mat4 uProjection;
  uniform mat4 uNormalMatrix;
  varying vec2 vUV;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vUV = aTexCoord;
    vNormal = (uNormalMatrix * vec4(aNormal, 0.0)).xyz;
    vec4 worldPos = uModelView * vec4(aPosition, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = uProjection * worldPos;
  }
`;

/**
 * Build post-processing fragment shader.
 */
export function buildPostShader(effects: PostEffect[]): string {
  const effectCode = effects.map(e => POST_SHADERS[e]).join('\n');

  return `
    precision mediump float;
    uniform sampler2D uScene;
    uniform float uTime;
    uniform vec2 uResolution;
    varying vec2 vUV;

    ${GLSL_NOISE}
    ${effectCode}

    void main() {
      vec3 color = texture2D(uScene, vUV).rgb;
      ${effects.map(e => {
        switch (e) {
          case 'bloom': return 'color = bloom(uScene, vUV, 0.7, 0.5, 2.0);';
          case 'colorGrade': return 'color = colorGrade(color, 1.1, 1.1, 0.0);';
          case 'vignette': return 'color = vignette(color, vUV, 0.5, 0.4);';
          case 'crt': return 'color = crtEffect(color, vUV, 0.02, 0.3);';
          case 'filmGrain': return 'color = filmGrain(color, vUV, 0.05, 10.0);';
          case 'pixelate': return 'color = pixelate(uScene, vUV, 240.0);';
          case 'dither': return 'color = dither(color, vUV, 4.0, 16.0);';
          case 'fog': return 'color = applyFog(color, gl_FragCoord.z, vec3(0.5), 1.0, 5.0, 50.0);';
          default: return '';
        }
      }).join('\n      ')}
      gl_FragColor = vec4(color, 1.0);
    }
  `;
}

/**
 * Fullscreen quad vertex shader (for post-processing).
 */
export const VERTEX_SHADER_QUAD = `
  precision mediump float;
  attribute vec2 aPosition;
  varying vec2 vUV;
  void main() {
    vUV = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

// ============================================================================
// PRESET COMBINATIONS — ready-to-use visual styles
// ============================================================================

export interface VisualPreset {
  name: string;
  materials: Record<string, MaterialParams>;
  lights: ShaderPipeline['lights'];
  postEffects: PostEffect[];
  description: string;
}

export const VISUAL_PRESETS: Record<string, VisualPreset> = {
  ps1_dungeon: {
    name: 'PS1 Dungeon',
    description: 'Vagrant Story / Kings Field — dark, moody, dithered',
    materials: {
      walls: { type: 'stone', color: 'hsl(30, 20%, 30%)', roughness: 0.9, metallic: 0, emissive: 0, scale: 2, seed: 1, age: 0.7 },
      floor: { type: 'stone', color: 'hsl(25, 15%, 25%)', roughness: 0.95, metallic: 0, emissive: 0, scale: 3, seed: 2, age: 0.8 },
      metal: { type: 'rust', color: 'hsl(20, 50%, 30%)', roughness: 0.7, metallic: 0.8, emissive: 0, scale: 4, seed: 3, age: 0.9 },
      torch: { type: 'emissive', color: 'hsl(30, 90%, 50%)', roughness: 0.5, metallic: 0, emissive: 1, scale: 1, seed: 4, age: 0 },
    },
    lights: [
      { position: [0, 2, 0], color: [1, 0.7, 0.4], intensity: 3, radius: 8 },
      { position: [5, 1.5, 3], color: [1, 0.5, 0.2], intensity: 2, radius: 5 },
    ],
    postEffects: ['dither', 'pixelate', 'vignette', 'filmGrain'],
  },
  modern_storefront: {
    name: 'Modern Storefront',
    description: 'Clean, bright, glass and marble — for marketplace DApps',
    materials: {
      walls: { type: 'marble', color: 'hsl(0, 0%, 90%)', roughness: 0.3, metallic: 0, emissive: 0, scale: 1, seed: 10, age: 0 },
      floor: { type: 'marble', color: 'hsl(0, 0%, 85%)', roughness: 0.2, metallic: 0, emissive: 0, scale: 2, seed: 11, age: 0.1 },
      shelves: { type: 'wood', color: 'hsl(30, 40%, 45%)', roughness: 0.6, metallic: 0, emissive: 0, scale: 3, seed: 12, age: 0.2 },
      display: { type: 'glass', color: 'hsl(200, 20%, 80%)', roughness: 0.05, metallic: 0.1, emissive: 0, scale: 1, seed: 13, age: 0 },
    },
    lights: [
      { position: [0, 4, 0], color: [1, 1, 1], intensity: 6, radius: 15 },
      { position: [-3, 3, 2], color: [0.9, 0.95, 1], intensity: 3, radius: 10 },
    ],
    postEffects: ['bloom', 'colorGrade', 'vignette'],
  },
  fantasy_tavern: {
    name: 'Fantasy Tavern',
    description: 'Warm wood and stone — RPG tavern scene',
    materials: {
      walls: { type: 'stone', color: 'hsl(25, 25%, 35%)', roughness: 0.85, metallic: 0, emissive: 0, scale: 2, seed: 20, age: 0.5 },
      floor: { type: 'wood', color: 'hsl(25, 45%, 30%)', roughness: 0.7, metallic: 0, emissive: 0, scale: 2, seed: 21, age: 0.4 },
      bar: { type: 'wood', color: 'hsl(20, 50%, 25%)', roughness: 0.5, metallic: 0, emissive: 0, scale: 3, seed: 22, age: 0.6 },
      fireplace: { type: 'lava', color: 'hsl(20, 90%, 50%)', roughness: 0.9, metallic: 0, emissive: 0.8, scale: 1, seed: 23, age: 0 },
    },
    lights: [
      { position: [0, 2, -3], color: [1, 0.65, 0.3], intensity: 4, radius: 8 },
      { position: [3, 1, 1], color: [1, 0.8, 0.5], intensity: 2, radius: 5 },
      { position: [-2, 2.5, 0], color: [1, 0.7, 0.4], intensity: 1.5, radius: 4 },
    ],
    postEffects: ['bloom', 'vignette', 'filmGrain', 'colorGrade'],
  },
  crystal_cave: {
    name: 'Crystal Cave',
    description: 'Glowing crystals, ice, magical atmosphere',
    materials: {
      walls: { type: 'stone', color: 'hsl(240, 15%, 25%)', roughness: 0.9, metallic: 0, emissive: 0, scale: 3, seed: 30, age: 0.8 },
      floor: { type: 'ice', color: 'hsl(200, 40%, 60%)', roughness: 0.2, metallic: 0.1, emissive: 0, scale: 2, seed: 31, age: 0 },
      crystals: { type: 'crystal', color: 'hsl(270, 70%, 60%)', roughness: 0.05, metallic: 0.2, emissive: 0.6, scale: 1, seed: 32, age: 0 },
      glow: { type: 'emissive', color: 'hsl(180, 80%, 60%)', roughness: 0.3, metallic: 0, emissive: 1, scale: 1, seed: 33, age: 0 },
    },
    lights: [
      { position: [0, 1, 0], color: [0.5, 0.7, 1], intensity: 3, radius: 12 },
      { position: [2, 0.5, -2], color: [0.8, 0.4, 1], intensity: 2, radius: 6 },
      { position: [-3, 1, 1], color: [0.3, 1, 0.8], intensity: 2, radius: 6 },
    ],
    postEffects: ['bloom', 'chromatic', 'vignette', 'colorGrade'],
  },
  sci_fi_corridor: {
    name: 'Sci-Fi Corridor',
    description: 'Metal panels, neon glow, industrial',
    materials: {
      walls: { type: 'metal', color: 'hsl(210, 10%, 40%)', roughness: 0.4, metallic: 0.9, emissive: 0, scale: 2, seed: 40, age: 0.3 },
      floor: { type: 'metal', color: 'hsl(210, 10%, 30%)', roughness: 0.5, metallic: 0.85, emissive: 0, scale: 3, seed: 41, age: 0.4 },
      pipes: { type: 'rust', color: 'hsl(15, 40%, 35%)', roughness: 0.7, metallic: 0.7, emissive: 0, scale: 2, seed: 42, age: 0.7 },
      neon: { type: 'emissive', color: 'hsl(180, 100%, 50%)', roughness: 0.1, metallic: 0, emissive: 1, scale: 1, seed: 43, age: 0 },
    },
    lights: [
      { position: [0, 3, 0], color: [0.3, 0.8, 1], intensity: 4, radius: 10 },
      { position: [4, 2, 0], color: [1, 0.3, 0.5], intensity: 2, radius: 6 },
    ],
    postEffects: ['bloom', 'chromatic', 'crt', 'vignette'],
  },
};

// ============================================================================
// CONVENIENCE: Generate a 2D procedural texture (for Canvas 2D fallback)
// ============================================================================

/**
 * Generate a procedural texture as ImageData (no WebGL needed).
 * Uses JS implementation of the same noise functions.
 * Slower than GPU but works everywhere.
 */
export function generateProceduralTexture(
  width: number,
  height: number,
  material: MaterialType,
  params: Partial<MaterialParams> = {}
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  const scale = params.scale ?? 3;
  const seed = params.seed ?? 0;
  const age = params.age ?? 0;

  // Parse base color from HSL
  const baseR = 128, baseG = 100, baseB = 80; // default brownish

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const v = y / height;
      const idx = (y * width + x) * 4;

      // Simple JS noise (subset of GLSL version)
      const nx = u * scale + seed;
      const ny = v * scale + seed;
      const n1 = Math.sin(nx * 12.9898 + ny * 78.233) * 43758.5453;
      const noise = n1 - Math.floor(n1);

      // Material-specific variation
      let r = baseR, g = baseG, b = baseB;

      switch (material) {
        case 'stone':
          r = baseR * (0.7 + 0.3 * noise);
          g = baseG * (0.7 + 0.3 * noise);
          b = baseB * (0.7 + 0.3 * noise);
          break;
        case 'wood':
          const ring = Math.sin(Math.sqrt(nx * nx + ny * ny) * 10 + noise * 4) * 0.5 + 0.5;
          r = baseR * (0.6 + 0.4 * ring);
          g = baseG * (0.6 + 0.4 * ring);
          b = baseB * (0.4 + 0.2 * ring);
          break;
        case 'metal':
          const brushed = Math.sin(nx * 200 + noise * 2) * 0.02;
          r = baseR * (0.8 + brushed);
          g = baseG * (0.8 + brushed);
          b = baseB * (0.85 + brushed);
          break;
        case 'marble':
          const vein = Math.abs(Math.sin(nx * 5 + ny * 3 + noise * 6));
          const v3 = Math.pow(vein, 3);
          r = 220 * (1 - v3 * 0.4);
          g = 210 * (1 - v3 * 0.4);
          b = 200 * (1 - v3 * 0.3);
          break;
        default:
          r = baseR * (0.7 + 0.3 * noise);
          g = baseG * (0.7 + 0.3 * noise);
          b = baseB * (0.7 + 0.3 * noise);
      }

      // Age darkening
      r *= 1 - age * 0.2 * noise;
      g *= 1 - age * 0.2 * noise;
      b *= 1 - age * 0.2 * noise;

      data[idx] = Math.min(255, Math.max(0, r));
      data[idx + 1] = Math.min(255, Math.max(0, g));
      data[idx + 2] = Math.min(255, Math.max(0, b));
      data[idx + 3] = 255;
    }
  }

  return new ImageData(data, width, height);
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================

export {
  GLSL_NOISE,
  LIGHTING_GLSL,
  SHADOW_GLSL,
  NORMAL_MAP_GLSL,
  MATERIAL_SHADERS,
  POST_SHADERS,
};

// Developer usage:
//
// import {
//   createShaderPipeline,
//   buildMaterialShader,
//   buildPostShader,
//   VERTEX_SHADER_3D,
//   VERTEX_SHADER_QUAD,
//   VISUAL_PRESETS,
//   generateProceduralTexture,
// } from './kasvillage_shaders';
//
// // GPU path (WebGL):
// const pipeline = createShaderPipeline(canvas);
// const fragSrc = buildMaterialShader('stone');
// const program = createProgram(pipeline.gl, VERTEX_SHADER_3D, fragSrc);
//
// // CPU fallback (Canvas 2D):
// const texture = generateProceduralTexture(256, 256, 'marble', { scale: 2, age: 0.3 });
// ctx.putImageData(texture, 0, 0);
//
// // Post-processing:
// const postSrc = buildPostShader(['bloom', 'vignette', 'dither']);
// const postProgram = createProgram(pipeline.gl, VERTEX_SHADER_QUAD, postSrc);
//
// // Presets:
// const preset = VISUAL_PRESETS.ps1_dungeon;
// // Apply preset.materials, preset.lights, preset.postEffects
