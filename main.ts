// SPDX-License-Identifier: MIT
// make.fun bounty entry — builds the submission dossier from game/ + screenshots/.
// Run with Node 24 (TypeScript runs as-is, no build step):
//   MAKEFUN_OUTPUT_DIR=/tmp/flight-out node main.ts

import { mkdirSync, cpSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(out, { recursive: true });
cpSync('game', join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync('screenshots')) {
  cpSync('screenshots', join(out, 'screenshots'), { recursive: true });
}
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
// buildDossier returns the dossier file bytes — write them as-is.
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`dossier written to ${join(out, 'dossier.json')} (${dossier.length} bytes)`);
