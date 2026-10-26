import { spawn } from 'node:child_process';
import { existsSync, realpathSync, cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { root } from './runtime.mjs';
function run(args,cwd){return new Promise((res,rej)=>{const c=spawn(process.execPath,args,{cwd,stdio:'inherit',windowsHide:true});c.on('error',rej);c.on('exit',code=>code===0?res():rej(Error('Build falló: '+code)));});}
const web=resolve(root,'apps/web');
await run(['node_modules/typescript/bin/tsc','-b'],web);
await run(['node_modules/vite/bin/vite.js','build'],web);
const dest=resolve(root,'apps/api-php/public');
mkdirSync(dest,{recursive:true});
// Only Vite's generated assets directory is replaced; never remove PHP entry points.
const assets=join(dest,'assets');
if(existsSync(assets)) {
  if(!realpathSync(assets).startsWith(realpathSync(dest)+sep)) throw Error('Ruta de assets fuera del directorio público.');
  rmSync(assets,{recursive:true});
}
cpSync(join(web,'dist'),dest,{recursive:true});
console.log('Interfaz compilada en apps/api-php/public; lista para el servidor PHP.');
