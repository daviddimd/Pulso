import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { php, root, apiDir } from './runtime.mjs';
import { ensureLocalDatabase, listening } from './local-db.mjs';
await ensureLocalDatabase();
const children=[];
if (!await listening(8080, 'localhost')) children.push(spawn(php,['-S','localhost:8080','-t','public','public/router.php'],{cwd:apiDir,stdio:'inherit',windowsHide:true}));
if (!await listening(5177, 'localhost')) children.push(spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','localhost'],{cwd:resolve(root,'apps/web'),stdio:'inherit',windowsHide:true}));
console.log('Pulso: http://localhost:5177 (API PHP: http://localhost:8080)');
function stop(){children.forEach(p=>p.kill());}
process.on('SIGINT',()=>{stop();process.exit(0)});process.on('SIGTERM',()=>{stop();process.exit(0)});
children.forEach(p=>{p.on('error',e=>{console.error(e.message);stop();process.exitCode=1});p.on('exit',code=>{if(code){stop();process.exitCode=code;}})});
