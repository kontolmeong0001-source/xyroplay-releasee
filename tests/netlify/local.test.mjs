import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';

test('loopback server serves static assets and real DB-backed API but never private source',async()=>{
  const connection=process.env.TEST_DATABASE_URL;
  assert.ok(connection);
  const url=new URL(connection);
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
  assert.match(url.pathname,/_test$/);
  const child=spawn(process.execPath,['scripts/netlify-local.mjs'],{cwd:fileURLToPath(new URL('../../',import.meta.url)),env:{...process.env,DATABASE_URL:connection,XYRO_ALLOW_LOCAL_DB:'true',PORT:'18888'},stdio:['ignore','pipe','pipe']});
  const stopped=once(child,'exit');
  try{
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Local server startup timeout')),8000);
      child.stdout.on('data',data=>{if(String(data).includes('127.0.0.1:18888')){clearTimeout(timer);resolve();}});
      child.once('error',e=>{clearTimeout(timer);reject(e);});
      child.once('exit',code=>{clearTimeout(timer);reject(Error(`Server exited ${code}`));});
    });
    const base='http://127.0.0.1:18888';
    const page=await fetch(base);
    assert.equal(page.status,200);
    assert.match(await page.text(),/XyroPlay/i);
    const health=await fetch(base+'/api/health');
    assert.equal(health.status,200);
    assert.deepEqual(await health.json(),{status:'ok'});
    assert.equal(health.headers.get('cache-control'),'no-store');
    const caps=await fetch(base+'/api/capabilities');
    assert.deepEqual(await caps.json(),{online:false,tools:[]});
    assert.equal((await fetch(base+'/api/auth/me')).status,401);
    for(const name of ['.env','backend/app.py','backend/data/xyroplay.sqlite3','package.json','netlify/functions/api.mjs'])assert.equal((await fetch(base+'/'+name)).status,404);
  }finally{
    child.kill('SIGTERM');
    await stopped;
  }
});
