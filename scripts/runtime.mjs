import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const [major, minor, patch] = process.versions.node.split('.').map(Number);
if (major !== 24 || minor < 22 || (minor === 22 && patch < 1)) {
  throw new Error('Pulso requiere Node.js 24.22.1 o posterior de la rama 24 LTS. Actualiza Node antes de continuar.');
}
export const root = resolve(import.meta.dirname, '..');
export const apiDir = resolve(root, 'apps/api-php');
export const php = process.env.PHP_BINARY || (existsSync(resolve(root, '.runtime/php/php.exe')) ? resolve(root, '.runtime/php/php.exe') : 'php');
