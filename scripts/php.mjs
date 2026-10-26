import { spawnSync } from 'node:child_process';
import { php,apiDir } from './runtime.mjs';
import { ensureLocalDatabase } from './local-db.mjs';
await ensureLocalDatabase();
const r=spawnSync(php,['spark',...process.argv.slice(2)],{cwd:apiDir,stdio:'inherit',windowsHide:true});
if(r.error) throw r.error;
process.exitCode=r.status??1;
