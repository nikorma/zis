/**
 * Copia l'icona dello zaino nelle cartelle Android (mipmap) e nello splash.
 * Uso: node scripts/make-icons.mjs && node scripts/android-icons.mjs
 */
import { copyFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC_512 = 'public/icons/icon-512.png';
const SRC_192 = 'public/icons/icon-192.png';
const RES = 'android/app/src/main/res';

if (!existsSync(SRC_512)) {
  console.error('Manca', SRC_512, '- esegui prima: node scripts/make-icons.mjs');
  process.exit(1);
}

let n = 0;
for (const dir of readdirSync(RES)) {
  if (!dir.startsWith('mipmap')) continue;
  for (const f of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
    const target = join(RES, dir, f);
    if (existsSync(target)) { copyFileSync(SRC_512, target); n++; }
  }
}
// splash nativo
for (const dir of readdirSync(RES)) {
  if (!dir.startsWith('drawable')) continue;
  const target = join(RES, dir, 'splash.png');
  if (existsSync(target)) { copyFileSync(SRC_512, target); n++; }
}
if (existsSync(join(RES, 'drawable', 'splash.png'))) copyFileSync(SRC_512, join(RES, 'drawable', 'splash.png'));
copyFileSync(SRC_192, join(RES, 'mipmap-mdpi', 'ic_launcher.png'));
console.log('Icone Android aggiornate:', n, 'file');
