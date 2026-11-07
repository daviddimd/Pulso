import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionLoader } from '../apps/web/src/session.ts';

test('StrictMode shares the in-flight request without caching a previous identity', async t => {
  const calls=[]; let release;
  t.mock.method(globalThis,'fetch',(url,options)=>{calls.push({url,options});return new Promise(resolve=>{release=resolve;});});
  const load=createSessionLoader('/api/auth/session');
  const first=load(), duplicate=load();
  assert.equal(first,duplicate);
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0],{url:'/api/auth/session',options:{credentials:'include',cache:'no-store'}});
  release(Response.json({user:{id:'test-user'}}));
  assert.deepEqual(await first,{user:{id:'test-user'}});
  const fresh=load();
  assert.equal(calls.length,2);
  release(Response.json({user:null}));
  assert.deepEqual(await fresh,{user:null});
});

test('A backend failure does not get cached or become an authenticated session', async t => {
  const fetch=t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:500}));
  const load=createSessionLoader('/api/auth/session');
  await assert.rejects(load(),/Session check failed/);
  fetch.mock.mockImplementation(async()=>Response.json({user:null}));
  assert.deepEqual(await load(),{user:null});
  assert.equal(fetch.mock.callCount(),2);
});
