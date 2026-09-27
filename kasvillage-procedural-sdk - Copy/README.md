# kasvillage-procedural-sdk

Constrained procedural generation SDK for KasVillage DApps and Games.

## Features

- **No realistic human faces** - Enforces stylized proportions
- **No image uploads** - Blocks photo/camera bypass attempts
- **User Avatar Plugin** - Bring your L1-verified avatar to any DApp
- **26 fantasy races** - Human, Elf, Orc, Vampire, Alien, etc.

## Install

```bash
npm install kasvillage-procedural-sdk @noble/hashes
```

## Usage

```typescript
import { generateCharacter, initAvatarContext, getAvatar, scanCode } from 'kasvillage-procedural-sdk';

// Generate NPC
const npc = generateCharacter('elf', 'female', 'seed');

// Load user's avatar
const ctx = await initAvatarContext('elf', 'neutral');
const avatar = getAvatar(ctx);

// Scan DApp code
const result = scanCode(code);
if (!result.isValid) console.error(result.violations);
```

## License

MIT
