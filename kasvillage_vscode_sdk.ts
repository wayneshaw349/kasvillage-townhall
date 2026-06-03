// ============================================================================
// KasVillage Procedural SDK — VS Code Extension + npm Package
// 
// Dev installs: npm install kasvillage-procedural-sdk
// Dev activates: KasVillage extension in VS Code
// Extension pairs with phone wallet via pubkey → pulls from Arweave
// Every game file gets creator attribution header
// ============================================================================

// ============================================================================
// ARWEAVE IDENTITY LOADER — desktop side, no SecureStore needed
// ============================================================================

const ARWEAVE_GRAPHQL = 'https://arweave.net/graphql';
const ARWEAVE_GATEWAY = 'https://arweave.net';
const KV_APP_NAME = 'KasVillage';

export interface CreatorIdentity {
  pubkey: string;
  name: string;
  race: string;
  gender: string;
  playerClass: string;
  aptAlias: string;
  avatarHash: string;
  traitCount: number;
  l1InscriptionTx: string | null;
  arweaveTx: string;
  createdAt: number;
  avatarPaths: string[];
  colors: Record<string, string>;
}

/**
 * Fetch creator identity from Arweave by pubkey.
 * This is what the VS Code extension calls — no phone needed.
 */
export async function fetchCreatorFromArweave(pubkey: string): Promise<CreatorIdentity | null> {
  try {
    // Hash pubkey for Arweave tag lookup (same algo as arweave_queries.ts)
    const pubkeyHash = await hashPubkeyWeb(pubkey);

    // Query identity record
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["${KV_APP_NAME}"] },
            { name: "Type", values: ["KV_IDENTITY_V1"] },
            { name: "Pubkey-Hash", values: ["${pubkeyHash}"] }
          ],
          first: 1,
          sort: HEIGHT_DESC
        ) {
          edges {
            node {
              id
              tags { name value }
              block { timestamp }
            }
          }
        }
      }
    `;

    const resp = await fetch(ARWEAVE_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    const result = await resp.json();
    const edge = result?.data?.transactions?.edges?.[0];
    if (!edge) return null;

    const tags = edge.node.tags;
    const getTag = (name: string) => tags.find((t: any) => t.name === name)?.value || '';

    // Fetch the full data payload from Arweave
    const txId = edge.node.id;
    let avatarPaths: string[] = [];
    let colors: Record<string, string> = {};
    let name = 'Villager';
    let race = 'human';
    let gender = 'male';
    let playerClass = 'Wanderer';
    let traitCount = 0;

    try {
      const dataResp = await fetch(`${ARWEAVE_GATEWAY}/${txId}`);
      if (dataResp.ok) {
        const data = await dataResp.json();
        avatarPaths = data.paths || data.avatarPaths || [];
        colors = data.colors || {};
        name = data.name || getTag('Name') || 'Villager';
        race = data.race || getTag('Race') || 'human';
        gender = data.gender || getTag('Gender') || 'male';
        playerClass = data.class || getTag('Class') || 'Wanderer';
        traitCount = data.traitCount || parseInt(getTag('Trait-Count') || '0');
      }
    } catch {
      // Tags-only fallback if data fetch fails
      name = getTag('Name') || 'Villager';
      race = getTag('Race') || 'human';
      gender = getTag('Gender') || 'male';
    }

    return {
      pubkey,
      name,
      race,
      gender,
      playerClass,
      aptAlias: getTag('APT-Alias'),
      avatarHash: getTag('Avatar-Hash'),
      traitCount,
      l1InscriptionTx: getTag('L1-Inscription-TX') || null,
      arweaveTx: txId,
      createdAt: edge.node.block?.timestamp || 0,
      avatarPaths,
      colors,
    };
  } catch (e) {
    console.error('[KV SDK] Arweave fetch failed:', e);
    return null;
  }
}

/** SHA256 hash for pubkey lookup — browser/Node compatible (no @noble needed) */
async function hashPubkeyWeb(pubkey: string): Promise<string> {
  const data = new TextEncoder().encode(`PK:${pubkey}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// CREATOR ATTRIBUTION — auto-inserted into every game file
// ============================================================================

/**
 * Generate the attribution header for source files.
 */
export function generateAttribution(creator: CreatorIdentity): string {
  const lines = [
    `/**`,
    ` * Built with KasVillage Procedural SDK`,
    ` * Creator: ${creator.name} the ${creator.playerClass} (${creator.race}, ${creator.gender})`,
    ` * PubKey: ${creator.pubkey.slice(0, 8)}...${creator.pubkey.slice(-8)}`,
  ];

  if (creator.l1InscriptionTx) {
    lines.push(` * Inscription: kaspa:${creator.l1InscriptionTx.slice(0, 16)}...`);
  }
  lines.push(` * Arweave: ar://${creator.arweaveTx}`);

  if (creator.aptAlias) {
    lines.push(` * Apartment: ${creator.aptAlias}`);
  }
  lines.push(` * Traits: ${creator.traitCount}/18`);
  lines.push(` * Created: ${new Date(creator.createdAt * 1000).toISOString().split('T')[0]}`);
  lines.push(` */`);

  return lines.join('\n');
}

/**
 * Generate a package.json creator field for the game.
 */
export function generateCreatorMetadata(creator: CreatorIdentity): Record<string, any> {
  return {
    kasvillage: {
      creator: {
        name: creator.name,
        race: creator.race,
        class: creator.playerClass,
        pubkey: creator.pubkey,
        arweave: creator.arweaveTx,
        inscription: creator.l1InscriptionTx,
        apt: creator.aptAlias,
        traits: creator.traitCount,
        avatarHash: creator.avatarHash,
      },
      sdk: 'kasvillage-procedural-sdk',
      version: '1.0.0',
    },
  };
}

// ============================================================================
// MOCK AVATAR — for dev testing without a wallet
// ============================================================================

/**
 * Generate a mock avatar for development/testing.
 * Returns the same shape as a real wallet avatar so games work identically.
 */
export function createMockAvatar(options?: {
  race?: string;
  gender?: string;
  name?: string;
}): CreatorIdentity {
  const race = options?.race || 'human';
  const gender = options?.gender || 'male';
  const name = options?.name || 'TestHero';

  return {
    pubkey: 'mock_' + '0'.repeat(60),
    name,
    race,
    gender,
    playerClass: 'Wanderer',
    aptAlias: 'TEST-001',
    avatarHash: 'mock_hash_' + Date.now().toString(16),
    traitCount: 9,
    l1InscriptionTx: null,
    arweaveTx: 'mock_arweave_tx',
    createdAt: Math.floor(Date.now() / 1000),
    avatarPaths: [],  // empty = use fallback silhouette
    colors: {
      skin: '#D4A574',
      hair: '#2C1810',
      eyes: '#4A6741',
      primary: '#4A6741',
      secondary: '#2F3136',
      accent: '#FFD700',
      lips: '#C89B5D',
    },
  };
}

// ============================================================================
// VS CODE EXTENSION — package.json contribution points
// ============================================================================

/**
 * Extension manifest (package.json for the VS Code extension).
 * This defines commands, settings, and activation events.
 */
export const VSCODE_EXTENSION_MANIFEST = {
  name: 'kasvillage-sdk',
  displayName: 'KasVillage Procedural SDK',
  description: 'Build games with KasVillage blockchain avatars. Connect your wallet, get creator attribution.',
  version: '1.0.0',
  publisher: 'kasvillage',
  engines: { vscode: '^1.80.0' },
  categories: ['Other', 'Snippets'],
  activationEvents: ['onStartupFinished'],
  main: './dist/extension.js',
  contributes: {
    commands: [
      {
        command: 'kasvillage.connect',
        title: 'KasVillage: Connect Wallet (Enter Pubkey)',
      },
      {
        command: 'kasvillage.disconnect',
        title: 'KasVillage: Disconnect Wallet',
      },
      {
        command: 'kasvillage.newGame',
        title: 'KasVillage: New Game Project',
      },
      {
        command: 'kasvillage.insertAttribution',
        title: 'KasVillage: Insert Creator Attribution',
      },
      {
        command: 'kasvillage.previewAvatar',
        title: 'KasVillage: Preview Avatar',
      },
      {
        command: 'kasvillage.mockAvatar',
        title: 'KasVillage: Use Mock Avatar (Dev Mode)',
      },
    ],
    configuration: {
      title: 'KasVillage SDK',
      properties: {
        'kasvillage.pubkey': {
          type: 'string',
          default: '',
          description: 'Your KasVillage public key (from phone wallet)',
        },
        'kasvillage.autoAttribution': {
          type: 'boolean',
          default: true,
          description: 'Auto-insert creator attribution in new .ts/.tsx files',
        },
        'kasvillage.defaultShading': {
          type: 'string',
          default: 'daylight',
          enum: ['horror', 'daylight', 'twilight', 'neon', 'moonlit', 'firelit'],
          description: 'Default lighting preset for avatar preview',
        },
      },
    },
    snippets: [
      {
        language: 'typescript',
        path: './snippets/kasvillage.json',
      },
      {
        language: 'typescriptreact',
        path: './snippets/kasvillage.json',
      },
    ],
  },
};

/**
 * VS Code snippets for quick game scaffolding.
 */
export const VSCODE_SNIPPETS = {
  'KasVillage: Game Loop': {
    prefix: 'kvgame',
    body: [
      "import { initGameSession } from 'kasvillage-procedural-sdk';",
      '',
      'async function startGame() {',
      "  const session = await initGameSession('${1:daylight}');",
      '  if (!session) { console.log("No wallet found"); return; }',
      '',
      '  const canvas = document.getElementById("game") as HTMLCanvasElement;',
      '  const ctx = canvas.getContext("2d")!;',
      '',
      '  let lastTime = 0;',
      '  function frame(time: number) {',
      '    const dt = (time - lastTime) / 1000;',
      '    lastTime = time;',
      '',
      '    ctx.clearRect(0, 0, canvas.width, canvas.height);',
      '',
      '    session.avatar.update(dt, input, groundY);',
      '    session.tick(dt);',
      '    session.draw(ctx, session.avatar.getRenderState().x, session.avatar.getRenderState().y);',
      '    session.drawHUD(ctx, canvas.width, canvas.height);',
      '',
      '    requestAnimationFrame(frame);',
      '  }',
      '  requestAnimationFrame(frame);',
      '}',
      '',
      'startGame();',
    ],
    description: 'KasVillage game loop with avatar, HUD, particles, and audio',
  },

  'KasVillage: Avatar Only': {
    prefix: 'kvavatar',
    body: [
      "import { KasVillageAvatar, loadAvatarFromWallet } from 'kasvillage-procedural-sdk';",
      '',
      'const avatar = await loadAvatarFromWallet();',
      "avatar.attachPhysics('${1:platformer}');",
      "avatar.setCamera('${2:sideScroll}');",
      "avatar.face('${3:east}');",
    ],
    description: 'Load avatar from wallet with physics',
  },

  'KasVillage: Particles': {
    prefix: 'kvparticles',
    body: [
      "import { ParticleSystem } from 'kasvillage-procedural-sdk';",
      '',
      "const particles = new ParticleSystem('${1:human}', avatarColors);",
      "particles.setSplashColor(${2:null}); // null = avatar palette, '#FF0' = single color",
      '',
      '// In game loop:',
      'particles.update(dt, pose, joints, facingRight);',
      'particles.draw(ctx);',
    ],
    description: 'Initialize particle system with paint splash',
  },

  'KasVillage: HUD': {
    prefix: 'kvhud',
    body: [
      "import { GameHUD } from 'kasvillage-procedural-sdk';",
      '',
      "const hud = new GameHUD(avatar.data.colors, '${1:PlayerName}', '${2:Warrior Lv.1}');",
      '',
      '// Update & draw in game loop:',
      'hud.update(dt);',
      'hud.drawAll(ctx, avatarX, avatarY, screenW, screenH);',
      '',
      '// Events:',
      'hud.spawnNumber(-25, x, y);      // damage popup',
      "hud.say('Hello!');                // chat bubble",
      "hud.setItem(0, 'Sword', '⚔️', 'rare');",
    ],
    description: 'Game HUD with themed UI',
  },
};

// ============================================================================
// EXTENSION LOGIC — the activate() function
// ============================================================================

/**
 * VS Code extension entry point.
 * This is pseudocode — actual implementation requires vscode API imports
 * that only work inside VS Code extension host.
 *
 * The extension does:
 * 1. On "Connect Wallet" → prompt for pubkey → query Arweave → store identity
 * 2. On new .ts/.tsx file → auto-insert attribution header
 * 3. On "Preview Avatar" → show webview with avatar rendering
 * 4. On "New Game Project" → scaffold project with SDK + creator metadata
 */
export const EXTENSION_ACTIVATE_PSEUDOCODE = `
import * as vscode from 'vscode';
import { fetchCreatorFromArweave, generateAttribution, createMockAvatar } from './arweave_loader';

let creator: CreatorIdentity | null = null;

export function activate(context: vscode.ExtensionContext) {

  // --- Connect Wallet ---
  context.subscriptions.push(
    vscode.commands.registerCommand('kasvillage.connect', async () => {
      const pubkey = await vscode.window.showInputBox({
        prompt: 'Enter your KasVillage public key (from phone wallet)',
        placeHolder: '32-byte hex public key',
      });
      if (!pubkey) return;

      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Connecting to KasVillage...' },
        async () => {
          creator = await fetchCreatorFromArweave(pubkey);
          if (creator) {
            vscode.window.showInformationMessage(
              'Connected: ' + creator.name + ' the ' + creator.playerClass +
              ' (' + creator.race + ') | Traits: ' + creator.traitCount + '/18'
            );
            context.globalState.update('kasvillage.pubkey', pubkey);
            context.globalState.update('kasvillage.creator', creator);
          } else {
            vscode.window.showErrorMessage('No KasVillage identity found for this pubkey. Complete the identity ritual on your phone first.');
          }
        }
      );
    })
  );

  // --- Auto Attribution on new files ---
  context.subscriptions.push(
    vscode.workspace.onDidCreateFiles(async (e) => {
      const autoAttr = vscode.workspace.getConfiguration('kasvillage').get('autoAttribution', true);
      if (!autoAttr || !creator) return;

      for (const file of e.files) {
        if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
          const doc = await vscode.workspace.openTextDocument(file);
          const edit = new vscode.WorkspaceEdit();
          const header = generateAttribution(creator) + '\\n\\n';
          edit.insert(file, new vscode.Position(0, 0), header);
          await vscode.workspace.applyEdit(edit);
        }
      }
    })
  );

  // --- Insert Attribution manually ---
  context.subscriptions.push(
    vscode.commands.registerCommand('kasvillage.insertAttribution', async () => {
      const c = creator || createMockAvatar();
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      editor.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(0, 0), generateAttribution(c) + '\\n\\n');
      });
    })
  );

  // --- Mock Avatar for dev testing ---
  context.subscriptions.push(
    vscode.commands.registerCommand('kasvillage.mockAvatar', async () => {
      const race = await vscode.window.showQuickPick(
        ['human','elf','orc','dwarf','angel','dragonkin','vampire','golem','sprite','phoenix'],
        { placeHolder: 'Pick a race for mock avatar' }
      );
      creator = createMockAvatar({ race: race || 'human' });
      vscode.window.showInformationMessage('Mock avatar active: ' + creator.name + ' (' + creator.race + ')');
    })
  );

  // --- Restore saved connection ---
  const savedPubkey = context.globalState.get<string>('kasvillage.pubkey');
  if (savedPubkey) {
    fetchCreatorFromArweave(savedPubkey).then(c => {
      if (c) {
        creator = c;
        vscode.window.setStatusBarMessage('KasVillage: ' + c.name + ' connected', 5000);
      }
    });
  }
}
`;

// ============================================================================
// NPM PACKAGE — barrel export
// ============================================================================

// Re-export everything from all SDK modules
// This is what devs import from 'kasvillage-procedural-sdk'

export {
  // Engine
  KasVillageAvatar,
  deriveJoints,
  deriveSideJoints,
  applyPose,
  lerpJoints,
  trailJoint,
  blendPoses,
  projectAngle,
  computeAvatarShading,
  computePathShading,
  getShadingPresets,
  createCustomLighting,
  updatePlatformer,
  updateTopdown,
  createPhysicsState,
  snapToAngle,
  getFrameIndex,
  ALL_POSES,
  TOTAL_ANGLES,
  ANGLE_STEP,
  SPRITE_SIZE,
  TOTAL_FRAMES,
  POSES_PER_ANGLE,
  Z_LAYERS,
} from './kasvillage_avatar_engine';

export type {
  AvatarData,
  JointSet,
  DepthPath,
  AngleProjection,
  ShadedColor,
  AnimationPose,
  BodyRegion,
  CameraMode,
  PhysicsPackage,
  ShadingPreset,
  LightSource,
  Race,
  Gender,
} from './kasvillage_avatar_engine';

// Renderer
export {
  renderFrame,
  generateSpriteSheet,
  blitSprite,
  blitByAngleAndPose,
  prepareAvatar,
  cacheSpriteSheet,
  loadCachedSpriteSheet,
  clearSpriteCache,
} from './kasvillage_canvas_renderer';

export type {
  RenderOptions,
  SpriteSheet,
} from './kasvillage_canvas_renderer';

// Audio + UI
export {
  AudioHooks,
  GameHUD,
  deriveUITheme,
  DEFAULT_SOUND_FILES,
} from './kasvillage_audio_ui';

export type {
  SoundEvent,
  AudioEvent,
  AudioCallback,
  SpatialInfo,
  UITheme,
  BarState,
  NamePlate,
  ActionButton,
  InventorySlot,
  ChatBubble,
  FloatingNumber,
} from './kasvillage_audio_ui';

// Particles
export {
  ParticleSystem,
  EFFECTS as PARTICLE_EFFECTS,
  RACE_AMBIENT_EFFECT,
} from './kasvillage_particles';

export type {
  Particle,
  EmitterConfig,
  ParticleShape,
} from './kasvillage_particles';

// Wallet Bridge (phone runtime)
export {
  initGameSession,
  readWalletProfile,
  isWalletReady,
  isAvatarReady,
  isInscribed,
  getTraitCount,
  getWalletAddress,
  getPublicKey,
} from './kasvillage_wallet_bridge';

export type {
  WalletProfile,
  GameSession,
} from './kasvillage_wallet_bridge';

// VS Code / Desktop
export {
  fetchCreatorFromArweave,
  generateAttribution,
  generateCreatorMetadata,
  createMockAvatar,
};

export type {
  CreatorIdentity,
};
