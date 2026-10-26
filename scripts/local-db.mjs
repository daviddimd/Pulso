import { spawn } from 'node:child_process';
import { existsSync, openSync } from 'node:fs';
import { resolve } from 'node:path';
import net from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { root } from './runtime.mjs';
export async function listening(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const socket = net.connect({ port, host });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(1500);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}
export async function ensureLocalDatabase() {
  const bin=resolve(root,'.runtime/mysql/mysql-8.4.11-winx64/bin/mysqld.exe');
  if(!existsSync(bin) || await listening(3317)) return;
  const logfile=openSync(resolve(root,'.runtime/mysql-server.log'),'a');
  const p=spawn(bin,['--no-defaults',`--basedir=${resolve(root,'.runtime/mysql/mysql-8.4.11-winx64')}`,`--datadir=${resolve(root,'.runtime/mysql-data')}`,'--port=3317','--bind-address=127.0.0.1','--mysqlx=OFF','--console'],{windowsHide:true,detached:true,stdio:['ignore',logfile,logfile]});
  p.unref();
  for(let i=0;i<100;i++){if(await listening(3317)) return;await sleep(100);}
  throw Error('MySQL local no pudo iniciar. Revisa .runtime/mysql-server.log');
}
